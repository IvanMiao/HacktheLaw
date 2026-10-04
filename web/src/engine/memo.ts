import { docOf, qualOf, type Anchor, type CaseBundle } from '../data/bundle';
import { deriveCase, value, type Analysis, type AnalysisState } from './chains';
import { daysBetween, fr } from './dates';
import { REGIMES } from './regimes';
import { english, type Translator } from '../i18n/translate';

export type Part = string | Anchor;
export type Block = { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; parts: Part[] };

export function buildMemo(bundle: CaseBundle, analysis: Analysis, state: AnalysisState, t: Translator = english): Block[] {
  const b: Block[] = [];
  const { profile } = bundle;
  const facts = bundle.facts.filter((fact) => fact.verified);
  const derived = deriveCase(bundle);
  const { firstWrit, lastWrit, sanction, limitationStart, writOutcomeQ: outcome } = derived;
  const hearing = lastWrit?.attrs.hearingDate ?? profile.nextHearing;
  const days = profile.nextHearing ? daysBetween(profile.asOf, profile.nextHearing) : undefined;
  const live = analysis.chains.filter((chain) => chain.status === 'holds' || chain.status === 'contested')
    .sort((x, y) => x.hingesOn.length - y.hingesOn.length);
  const dead = analysis.chains.filter((chain) => chain.status === 'fails');

  b.push({ t: 'h1', parts: [t('Defence memo — {title}', { title: t(profile.title) })] });
  b.push({ t: 'h2', parts: [t('1. Case summary')] });
  const summary: Part[] = [t('We act for {side}, in {title} before the {court}.', {
    side: t(profile.side), title: t(profile.title), court: profile.court,
  })];
  if (profile.amount) {
    summary.push(t(' Amount in dispute: {amount}.', { amount: profile.amount }));
    if (limitationStart?.anchors[0]) summary.push(limitationStart.anchors[0]);
  }
  if (firstWrit && sanction && lastWrit) {
    const firstDate = firstWrit.attrs.servedAt ?? firstWrit.date;
    const lastDate = lastWrit.attrs.servedAt ?? lastWrit.date;
    const lapsed = outcome ? value(bundle, state, outcome.id) : false;
    summary.push(t(lapsed ? ' A first writ of {date} lapsed ' : ' A first writ of {date} was annulled ', { date: fr(firstDate) }));
    summary.push(...sanction.anchors);
    summary.push(t(' The claim is now brought by a second writ of {date} ', { date: fr(lastDate) }));
    summary.push(...lastWrit.anchors.slice(0, 1));
    if (hearing) summary.push(t(', hearing on {date}.', { date: fr(hearing) }));
    else summary.push('.');
  }
  b.push({ t: 'p', parts: summary });

  b.push({ t: 'h2', parts: [t('2. Defences, in procedural order')] });
  b.push({ t: 'p', parts: [t('No exception de procédure requiring to be raised in limine litis was identified. The grounds below are fins de non-recevoir: they may be raised at any stage (art. 123 CPC) without proof of prejudice (art. 124 CPC). We nevertheless recommend raising them in the first written submissions.')] });
  if (!live.length) b.push({ t: 'note', parts: [t('In the current scenario, no ground holds among the enabled chains.')] });
  live.forEach((chain, i) => {
    b.push({ t: 'h3', parts: [t('Ground {letter} — {outcome}{independent}', {
      letter: String.fromCharCode(65 + i), outcome: chain.outcome, independent: live.length > 1 ? t(' (independent of the other ground)') : '',
    })] });
    chain.links.forEach((link) => b.push({ t: 'li', parts: [`${link.title}: ${link.statement}${link.rule ? ` (${link.rule})` : ''} `, ...link.anchors] }));
    const regime = chain.links.find((link) => link.kind === 'sanction' || link.kind === 'outcome')?.regime;
    if (regime) b.push({ t: 'p', parts: [t('Regime: {name} — {when}; prejudice: {prejudice}; curable: {curable}.', {
      name: t(REGIMES[regime].name), when: t(REGIMES[regime].when), prejudice: t(REGIMES[regime].prejudice), curable: t(REGIMES[regime].curable),
    })] });
    chain.hingesOn.forEach((qid) => {
      const qualification = qualOf(bundle, qid);
      b.push({ t: 'note', parts: [t('Weak link — {question} Our position: {answer}. Expect the claimant to argue the opposite. {reasoning}', {
        question: t(qualification.question), answer: t(value(bundle, state, qid) ? qualification.yes : qualification.no), reasoning: t(qualification.reasoning),
      })] });
    });
  });
  dead.forEach((chain) => {
    const broken = chain.links.find((link) => link.status === 'broken');
    b.push({ t: 'note', parts: [t('Not available in this scenario — {title}: breaks at “{link}” ({reason}).', {
      title: chain.title, link: broken?.title ?? '', reason: broken?.brokenReason ?? '',
    })] });
  });

  b.push({ t: 'h2', parts: [t('3. Next steps')] });
  const defences = t(live.length > 1 ? 'both fins de non-recevoir' : live.length ? 'the fin de non-recevoir' : 'our defences');
  b.push({ t: 'li', parts: [profile.nextHearing
    ? t('Serve written submissions raising {defences} before the hearing of {date} ({days} days).', {
      defences, date: fr(profile.nextHearing), days: days!,
    })
    : t('Serve written submissions raising {defences} before the next hearing.', { defences })] });
  if (live.some((chain) => chain.id === 'C2')) b.push({ t: 'li', parts: [t('Ask the claimant to produce any referral to a conciliator under the conciliation clause; absent any, ground C2 is established.')] });
  if (live.some((chain) => chain.id === 'C1') && sanction) b.push({ t: 'li', parts: [t('Produce the registry record and the order of caducité of {date} as exhibits.', { date: fr(sanction.date) })] });

  b.push({ t: 'h2', parts: [t('4. Points for lawyer review')] });
  analysis.contestedQuals.forEach((qid) => b.push({ t: 'li', parts: [t('AI-inferred, not yet confirmed: {question}', { question: t(qualOf(bundle, qid).question) })] }));
  if (facts.some((fact) => fact.role === 'writ_sanction')) b.push({ t: 'li', parts: [t('Replace the placeholder Cass. 2e civ. authority on caducité and interruption (C1).')] });
  b.push({ t: 'li', parts: [t('Check statutory excerpts against the current Légifrance versions (arts. 857, 122–126 CPC; arts. 2224–2243 C. civ.).')] });
  if (state.art642) b.push({ t: 'li', parts: [t('Confirm whether art. 642 CPC applies to the limitation period (affects 15/03 vs 16/03/2026).')] });
  return b;
}

export const toMd = (bundle: CaseBundle, blocks: Block[], t: Translator = english) => blocks.map(({ t: kind, parts }) => {
  const text = parts.map((part) => (typeof part === 'string' ? part : `[${t(docOf(bundle, part.doc).short)}]`)).join('');
  return { h1: `# ${text}`, h2: `\n## ${text}`, h3: `\n### ${text}`, p: text, li: `- ${text}`, note: `> ${text}` }[kind];
}).join('\n');
