import { allDocs, type CaseBundle } from '../data/bundle.js';
import type { CaseId } from '../data/catalog.js';
import { analyse, counterfactuals, type AnalysisState } from '../engine/chains.js';
import { validateIntent, type Intent, type VoiceContext } from './contract.js';

export function caseIdForBundle(bundle: CaseBundle): CaseId {
  return (bundle.id === 'sample-case' ? 'c1-c2' : bundle.id) as CaseId;
}

export function buildContext(state: AnalysisState, bundle: CaseBundle): VoiceContext {
  return {
    caseId: caseIdForBundle(bundle),
    whatIf: { ...state.whatIf },
    hypothetical: Object.keys(state.whatIf).length > 0,
    decisions: { ...state.decisions },
    qualifications: bundle.qualifications,
    chains: analyse(bundle, state).chains,
    sources: allDocs(bundle).map(({ id, title, provenance }) => ({ id, title, provenance })),
  };
}

export function applyIntent(state: AnalysisState, raw: Intent, bundle: CaseBundle, expectedCaseId: string = caseIdForBundle(bundle)): AnalysisState {
  if (expectedCaseId !== caseIdForBundle(bundle)) throw new Error('Stale case command. No changes made.');
  const intent = validateIntent(raw, buildContext(state, bundle));
  if (intent.action === 'preview_scenario') return { ...state, whatIf: { ...state.whatIf, [intent.target!]: intent.value! } };
  if (intent.action === 'reset_scenario') return { ...state, whatIf: {} };
  return state;
}

export function describeIntent(state: AnalysisState, raw: Intent, bundle: CaseBundle): string {
  const intent = validateIntent(raw, buildContext(state, bundle));
  const analysis = analyse(bundle, state);
  const prefix = Object.keys(state.whatIf).length ? 'Hypothetical preview — ' : 'Demo engine — ';
  if (intent.action === 'preview_scenario') {
    const qualification = bundle.qualifications.find((item) => item.id === intent.target)!;
    return `Hypothetical only: ${intent.target} = ${intent.value ? qualification.yes : qualification.no}. ${analysis.chains.map((chain) => `${chain.id}: ${chain.status}`).join(' · ')}. Lawyer decisions unchanged.`;
  }
  if (intent.action === 'reset_scenario') return 'Scenario restored. Hypothetical overrides cleared; lawyer decisions unchanged.';
  if (intent.action === 'show_evidence') return `Source: ${allDocs(bundle).find((doc) => doc.id === intent.target)!.title}. Source provenance remains labelled in the viewer.`;
  if (intent.action === 'show_mode') return `Opened ${intent.target}.`;
  if (intent.action === 'unsupported') return 'This request is not supported. Use evidence, explanations, hypothetical previews, modes or reset. Voice cannot confirm or reject legal facts.';
  if (intent.action === 'explain_link') {
    const chain = analysis.chains.find((item) => item.id === intent.target);
    const links = chain ? chain.links : analysis.chains.flatMap((item) => item.links).filter((link) => link.id === intent.target);
    return prefix + links.map((link) => `${link.title} [${link.status}]: ${link.statement}${link.brokenReason ? ` — ${link.brokenReason}` : ''} Sources: ${link.anchors.map((anchor) => anchor.doc).join(', ')}.`).join('\n') + '\nEngine summary, not a legal outcome guarantee.';
  }
  const counterfactual = counterfactuals(bundle, state).filter((item) => item.effects.some((effect) => intent.target === 'all' || effect.chain === intent.target));
  return prefix + 'Defence stress-test (read-only; not a factual finding):\n' + counterfactual.map((item) => `${item.qid}: ${item.label}. Hypothetical effect: ${item.effects.map((effect) => `${effect.chain} ${effect.from} → ${effect.to}`).join(', ')}.`).join('\n') + '\nReview the original sources and lawyer qualifications; no decisions changed.';
}
