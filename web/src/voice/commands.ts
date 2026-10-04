import { QUALIFICATIONS } from '../data/case';
import { DOCS } from '../data/documents';
import { analyse, counterfactuals, type AnalysisState } from '../engine/chains';
import { validateIntent, type Intent, type VoiceContext } from './contract';

export function buildContext(state: AnalysisState): VoiceContext {
  return { hypothetical: Object.keys(state.whatIf).length > 0, decisions: {...state.decisions}, qualifications: QUALIFICATIONS,
    chains: analyse(state).chains, sources: DOCS.map(({id,title,provenance})=>({id,title,provenance})) };
}
export function applyIntent(state: AnalysisState, raw: Intent): AnalysisState {
  const i = validateIntent(raw, buildContext(state));
  if (i.action === 'preview_scenario') return { ...state, whatIf: { ...state.whatIf, [i.target!]: i.value! } };
  if (i.action === 'reset_scenario') return { ...state, whatIf: {} };
  return state;
}
export function describeIntent(state: AnalysisState, raw: Intent): string {
  const i = validateIntent(raw, buildContext(state)); const a = analyse(state);
  const prefix = Object.keys(state.whatIf).length ? 'Hypothetical preview — ' : 'Demo engine — ';
  if (i.action === 'preview_scenario') {
    const q = QUALIFICATIONS.find(q=>q.id===i.target)!;
    return `Hypothetical only: ${i.target} = ${i.value ? q.yes : q.no}. ${a.chains.map(c=>`${c.id}: ${c.status}`).join(' · ')}. Lawyer decisions unchanged.`;
  }
  if (i.action === 'reset_scenario') return 'Scenario restored. Hypothetical overrides cleared; lawyer decisions unchanged.';
  if (i.action === 'show_evidence') return `Source: ${DOCS.find(d=>d.id===i.target)!.title}. Source provenance remains labelled in the viewer.`;
  if (i.action === 'show_mode') return `Opened ${i.target}.`;
  if (i.action === 'unsupported') return 'This request is not supported. Use evidence, explanations, hypothetical previews, modes or reset. Voice cannot confirm or reject legal facts.';
  if (i.action === 'explain_link') {
    const chain = a.chains.find(c=>c.id===i.target);
    const links = chain ? chain.links : a.chains.flatMap(c=>c.links).filter(l=>l.id===i.target);
    return prefix + links.map(l=>`${l.title} [${l.status}]: ${l.statement}${l.brokenReason ? ` — ${l.brokenReason}` : ''} Sources: ${l.anchors.map(a=>a.doc).join(', ')}.`).join('\n') + '\nEngine summary, not a legal outcome guarantee.';
  }
  const cfs = counterfactuals(state).filter(cf=>cf.effects.some(e=>i.target==='all'||e.chain===i.target));
  return prefix + 'Defence stress-test (read-only; not a factual finding):\n' + cfs.map(cf=>`${cf.qid}: ${cf.label}. Hypothetical effect: ${cf.effects.map(e=>`${e.chain} ${e.from} → ${e.to}`).join(', ')}.`).join('\n') + '\nReview the original sources and lawyer qualifications; no decisions changed.';
}
