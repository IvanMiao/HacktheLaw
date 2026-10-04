import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseBundle } from '../src/data/bundle';
import { counterfactuals, analyse, deriveCase, initialState } from '../src/engine/chains';
import { english } from '../src/i18n/translate';
import { SAMPLE_DATA } from '../src/data/sampleData';
import { loadLibrary } from '../server/library';
import { providerConfig, type Provider } from '../server/config';
import { runCase } from '../server/pipeline';

type Check = { name: string; pass: boolean; detail: string };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const arg = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const providerValue = arg('--provider') ?? 'openai';
if (providerValue !== 'openai' && providerValue !== 'mistral') throw new Error(`Unsupported provider: ${providerValue}`);
const provider: Provider = providerValue;
const model = arg('--model');
const runs = Number(arg('--runs') ?? 1);
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');

function metric(bundle: CaseBundle) {
  const state = initialState(bundle);
  const analysis = analyse(bundle, state, english);
  const derived = deriveCase(bundle);
  const lastWritDate = derived.lastWrit?.attrs.servedAt ?? derived.lastWrit?.date;
  const sensitiveKinds = [...new Set(counterfactuals(bundle, state, english)
    .filter((item) => item.effects.length > 0)
    .map((item) => bundle.qualifications.find((qualification) => qualification.id === item.qid)?.kind)
    .filter((kind): kind is string => !!kind))].sort();
  return {
    statuses: analysis.chains.map((chain) => [chain.id, chain.status]),
    expiry: analysis.limitation?.expiry ?? '',
    lastWritAfterExpiry: Boolean(analysis.limitation && lastWritDate && analysis.limitation.expiry < lastWritDate),
    sensitiveKinds,
  };
}

function checksFor(bundle: CaseBundle, libraryIds: Set<string>): Check[] {
  const facts = bundle.facts;
  const verified = facts.filter((fact) => fact.verified).length;
  const verifiedPercent = facts.length ? verified / facts.length : 0;
  const docIds = new Set(bundle.docs.map((doc) => doc.id));
  const knownIds = new Set([...docIds, ...libraryIds]);
  const missingIds = new Set<string>();
  facts.forEach((fact) => {
    if (!docIds.has(fact.doc)) missingIds.add(fact.doc);
    fact.anchors.forEach((anchor) => { if (!docIds.has(anchor.doc)) missingIds.add(anchor.doc); });
  });
  bundle.qualifications.forEach((qualification) => qualification.anchors?.forEach((anchor) => {
    if (!knownIds.has(anchor.doc)) missingIds.add(anchor.doc);
  }));
  const role = (name: string) => facts.filter((fact) => fact.role === name && fact.verified);
  const limitation = role('limitation_start').some((fact) => fact.date === '2021-03-15');
  const communication = role('debtor_communication').some((fact) => fact.date === '2022-06-02');
  const notice = role('formal_notice').some((fact) => fact.date === '2023-02-10');
  const writs = role('writ');
  const firstWrits = writs.filter((fact) => (fact.attrs.servedAt ?? fact.date) === '2026-01-12');
  const secondWrits = writs.filter((fact) => (fact.attrs.servedAt ?? fact.date) === '2026-04-08');
  const firstWrit = firstWrits[0];
  const secondWrit = secondWrits[0];
  const hasWrits = Boolean(firstWrits.length === 1 && secondWrits.length === 1
    && firstWrit?.attrs.hearingDate === '2026-02-20' && secondWrit?.attrs.hearingDate === '2026-10-20');
  const placements = role('writ_placement');
  const misplacedSecondWrit = placements.some((fact) =>
    (fact.attrs.placedAt ?? fact.date) === '2026-04-15' && fact.attrs.writFactId === firstWrit?.id,
  );
  const placement = Boolean(firstWrit && placements.some((fact) =>
    (fact.attrs.placedAt ?? fact.date) === '2026-02-16' && fact.attrs.writFactId === firstWrit.id,
  )) && !misplacedSecondWrit;
  const sanction = role('writ_sanction').some((fact) =>
    fact.date === '2026-02-20' && fact.attrs.writFactId === firstWrit?.id,
  );
  const clause = role('conciliation_clause').some((fact) => fact.doc === 'contract');
  const exhibits = role('exhibits_list').some((fact) => fact.doc === 'pieces');
  const qualification = (kind: string) => bundle.qualifications.find((item) => item.kind === kind);
  const clauseQ = qualification('conciliation_clause');
  const acknowledgmentQ = qualification('acknowledgment');
  const noticeQ = qualification('formal_notice');
  const outcomeQ = qualification('writ_outcome');
  const attemptedQ = qualification('conciliation_attempted');
  const fallbackKinds = [...new Set(bundle.qualifications.filter((item) => item.fallback).map((item) => item.kind))].sort();
  const qualifications = Boolean(clauseQ?.proposed && acknowledgmentQ?.proposed === false
    && noticeQ?.proposed === false && outcomeQ?.proposed === true && attemptedQ?.proposed === true);
  const allQualificationsAnswered = qualifications && fallbackKinds.length === 0;

  const sample: CaseBundle = { ...SAMPLE_DATA, docs: [] };
  const parity = metric(bundle);
  const sampleParity = metric(sample);
  const parityOkay = JSON.stringify(parity) === JSON.stringify(sampleParity);

  return [
    { name: 'Anchoring', pass: verifiedPercent >= 0.9 && missingIds.size === 0, detail: `${verified}/${facts.length} verified (${(verifiedPercent * 100).toFixed(1)}%); ${missingIds.size} hallucinated doc ids${missingIds.size ? `: ${[...missingIds].join(', ')}` : ''}` },
    { name: 'Profile', pass: bundle.profile.relationship === 'commercial' && bundle.profile.courtType === 'tribunal_commerce'
      && bundle.profile.claimant.includes('Atelier Lumière') && bundle.profile.defendant.includes('Bâtiself')
      && String(bundle.profile.side).startsWith('Defendant'), detail: `${bundle.profile.relationship}; ${bundle.profile.courtType}; ${bundle.profile.claimant}; ${bundle.profile.defendant}; ${String(bundle.profile.side)}` },
    { name: 'Limitation start', pass: limitation, detail: role('limitation_start').map((fact) => fact.date).join(', ') || 'not found' },
    { name: 'Communication and notice dates', pass: communication && notice, detail: `communication: ${role('debtor_communication').map((fact) => fact.date).join(', ') || 'not found'}; notice: ${role('formal_notice').map((fact) => fact.date).join(', ') || 'not found'}` },
    { name: 'Writ dates', pass: hasWrits, detail: writs.map((fact) => `${fact.attrs.servedAt ?? fact.date} → ${fact.attrs.hearingDate ?? 'no hearing'}`).join('; ') || 'not found' },
    { name: 'First-writ placement link', pass: placement, detail: `${placements.map((fact) => `${fact.attrs.placedAt ?? fact.date} → ${fact.attrs.writFactId ?? 'unlinked'}`).join('; ') || 'not found'}; 15 April placement linked to first writ: ${misplacedSecondWrit}` },
    { name: 'Sanction, clause, exhibits', pass: sanction && clause && exhibits, detail: `sanction ${sanction ? 'ok' : 'missing'}; clause ${clause ? 'contract' : 'missing'}; exhibits ${exhibits ? 'pieces' : 'missing'}` },
    { name: 'Qualification results', pass: allQualificationsAnswered, detail: `clause ${clauseQ?.proposed}; acknowledgment ${acknowledgmentQ?.proposed}; formal notice ${noticeQ?.proposed}; writ outcome ${outcomeQ?.proposed}; no conciliation attempt ${attemptedQ?.proposed}; fallback kinds ${fallbackKinds.join(', ') || 'none'}` },
    { name: 'Engine parity with SAMPLE', pass: parityOkay, detail: `AI ${JSON.stringify(parity)}; SAMPLE ${JSON.stringify(sampleParity)}` },
  ];
}

function table(checks: Check[]) {
  console.log('| Check | Result | Detail |');
  console.log('| --- | --- | --- |');
  for (const check of checks) console.log(`| ${check.name} | ${check.pass ? 'PASS' : 'FAIL'} | ${check.detail.replaceAll('|', '\\|')} |`);
}

function summaryTable(bundle: CaseBundle, elapsedMs: number, passed: number, modelUsage: string[]) {
  const verified = bundle.facts.filter((fact) => fact.verified).length;
  const percent = bundle.facts.length ? (verified / bundle.facts.length) * 100 : 0;
  console.log('| Metric | Value |');
  console.log('| --- | --- |');
  console.log(`| Checks passed | ${passed} |`);
  console.log(`| Facts | ${bundle.facts.length} |`);
  console.log(`| Verified | ${verified}/${bundle.facts.length} (${percent.toFixed(1)}%) |`);
  console.log(`| Wall time | ${(elapsedMs / 1000).toFixed(1)}s |`);
  console.log(`| Tokens per model | ${(modelUsage.join('; ') || 'none reported').replaceAll('|', '\\|')} |`);
  console.log(`| Steps | ${bundle.steps ?? 0} |`);
}

for (let run = 1; run <= runs; run++) {
  const config = providerConfig(provider, model ? { agent: model } : {});
  const started = Date.now();
  const bundle = await runCase({ sample: true }, () => undefined, {
    provider,
    models: model ? { agent: model } : undefined,
    asOf: '2026-10-04',
    fresh: true,
  });
  const elapsedMs = Date.now() - started;
  const library = await loadLibrary();
  const checks = checksFor(bundle, new Set(library.map((doc) => doc.id)));
  const passed = checks.filter((check) => check.pass).length;
  const modelUsage = Object.entries(bundle.usage ?? {}).map(([name, count]) =>
    `${name}: ${count.input} in / ${count.output} out / ${count.reasoning} reasoning`,
  );
  console.log(`\n${provider} eval (${config.models.agent}) — ${passed}/${checks.length} checks, ${bundle.facts.length} facts, ${bundle.facts.filter((fact) => fact.verified).length} verified, ${(elapsedMs / 1000).toFixed(1)}s`);
  table(checks);
  summaryTable(bundle, elapsedMs, passed, modelUsage);
  if (checks.some((check) => !check.pass)) {
    console.log('Trace excerpt:');
    for (const event of (bundle.trace ?? []).slice(-20)) console.log(`  ${event.stage}/${event.kind}: ${event.text}`);
  }
  const path = resolve(ROOT, 'web/.cache/eval');
  await mkdir(path, { recursive: true });
  const file = resolve(path, `${provider}-${config.models.agent.replace(/[^a-z0-9.-]/giu, '_')}-${Date.now()}.json`);
  await writeFile(file, JSON.stringify({
    provider,
    model: config.models.agent,
    asOf: '2026-10-04',
    elapsedMs,
    checks,
    bundle,
    trace: bundle.trace ?? [],
  }, null, 2), 'utf8');
  console.log(`Eval JSON: ${file}`);
  if (passed !== checks.length) process.exitCode = 1;
}
