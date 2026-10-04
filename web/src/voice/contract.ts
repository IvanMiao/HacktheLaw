import type { ChainResult, AnalysisState } from '../engine/chains.ts';
import { analyse, initialState } from '../engine/chains.ts';
import { getCase, ORIGINAL_CASE, type CaseId } from '../data/catalog.ts';
import type { Qualification } from '../data/case.ts';

export const ACTIONS = ['show_evidence', 'explain_link', 'preview_scenario', 'reset_scenario', 'show_mode', 'challenge_defence', 'unsupported'] as const;
export type Intent = { action: typeof ACTIONS[number]; target: string | null; value: boolean | null; sourceIds: string[] };
export type VoiceContext = {
  caseId: CaseId;
  hypothetical: boolean;
  decisions: Record<string, string>;
  whatIf: Record<string, boolean>;
  qualifications: Qualification[];
  chains: ChainResult[];
  sources: { id: string; title: string; provenance: 'real' | 'mock' }[];
};
// Compatibility exports describe the original case only, never a cross-case ID union.
export const SOURCE_IDS = ORIGINAL_CASE.docs.map(d => d.id);
export const LINK_IDS = analyse(initialState()).chains.flatMap(c => c.links.map(l => l.id));
const invalid = (): never => { throw new Error('Unsupported or ungrounded command. No changes made.'); };

/** Rebuild from server-owned fixtures; reject forged facts, evidence or computed output. */
export function validateCaseContext(raw: unknown): VoiceContext {
  try {
    const c = raw as VoiceContext; const dataset = getCase(c.caseId);
    if (typeof c.hypothetical !== 'boolean' || !c.decisions || !c.whatIf || !Array.isArray(c.qualifications) || !Array.isArray(c.chains) || !Array.isArray(c.sources)) return invalid();
    const ids = dataset.qualifications.map(q => q.id);
    if (Object.keys(c.decisions).length !== ids.length || !ids.every(id => ['proposed','confirmed','rejected'].includes(c.decisions[id]))) return invalid();
    if (!Object.entries(c.whatIf).every(([id,v]) => ids.includes(id) && typeof v === 'boolean') || c.hypothetical !== Boolean(Object.keys(c.whatIf).length)) return invalid();
    if (JSON.stringify(c.qualifications) !== JSON.stringify(dataset.qualifications)) return invalid();
    const sources = dataset.docs.map(({id,title,provenance}) => ({id,title,provenance}));
    if (JSON.stringify(c.sources) !== JSON.stringify(sources)) return invalid();
    // The legacy substantive-limitation flag can affect C1/C2, so validate either exact known computation.
    const state:AnalysisState = {decisions:c.decisions as AnalysisState['decisions'],whatIf:c.whatIf,art642:true};
    const canonical = analyse(state, undefined, dataset).chains;
    const alternate = analyse({...state,art642:false}, undefined, dataset).chains;
    if (JSON.stringify(c.chains) !== JSON.stringify(canonical) && JSON.stringify(c.chains) !== JSON.stringify(alternate)) return invalid();
    return {...c, qualifications:dataset.qualifications, sources, chains:c.chains};
  } catch { return invalid(); }
}
export function validateIntent(raw: unknown, context: VoiceContext): Intent {
  const dataset = getCase(context.caseId);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const r = raw as Record<string, unknown>;
  const sources = dataset.docs.map(d => d.id);
  if (Object.keys(r).sort().join(',') !== 'action,sourceIds,target,value' || !ACTIONS.includes(r.action as Intent['action']) ||
      !(r.target === null || typeof r.target === 'string') || !(r.value === null || typeof r.value === 'boolean') ||
      !Array.isArray(r.sourceIds) || r.sourceIds.length > sources.length || !r.sourceIds.every(id => typeof id === 'string' && context.sources.some(s => s.id === id) && sources.includes(id))) return invalid();
  const i = r as Intent;
  const chains = context.chains.filter(c => c.id === i.target);
  const links = context.chains.flatMap(c => c.links).filter(l => l.id === i.target);
  let allowedSources: string[] = [];
  switch (i.action) {
    case 'preview_scenario':
      if (!dataset.qualifications.some(q => q.id === i.target) || typeof i.value !== 'boolean') return invalid();
      allowedSources = dataset.facts.filter(f => f.qualification === i.target).flatMap(f => f.anchors.map(a => a.doc)); break;
    case 'show_mode':
      if (!['facts','chains','memo'].includes(i.target ?? '') || i.sourceIds.length) return invalid(); break;
    case 'show_evidence':
      if (!sources.includes(i.target ?? '') || !context.sources.some(s => s.id === i.target)) return invalid();
      allowedSources = [i.target!]; break;
    case 'explain_link':
      if (!chains.length && !links.length) return invalid();
      allowedSources = [...chains.flatMap(c => c.links), ...links].flatMap(l => l.anchors.map(a => a.doc)); break;
    case 'challenge_defence':
      if (i.target !== 'all' && !context.chains.some(c => c.id === i.target)) return invalid();
      allowedSources = context.chains.filter(c => i.target === 'all' || c.id === i.target).flatMap(c => c.links.flatMap(l => l.anchors.map(a => a.doc))); break;
    default:
      if (i.target !== null || i.sourceIds.length) return invalid();
  }
  if (i.action !== 'preview_scenario' && i.value !== null) return invalid();
  if (!i.sourceIds.every(id => allowedSources.includes(id))) return invalid();
  return { action:i.action, target:i.target, value:i.value, sourceIds:[...new Set(i.sourceIds)] };
}
export function intentSchemaFor(context: Pick<VoiceContext,'caseId'>) {
  const dataset = getCase(context.caseId);
  const chains = analyse(initialState(dataset), undefined, dataset).chains;
  const sources = dataset.docs.map(d => d.id);
  const targets:Record<Intent['action'],string[]> = {
    preview_scenario:dataset.qualifications.map(q => q.id), show_evidence:sources,
    explain_link:[...chains.map(c => c.id),...chains.flatMap(c => c.links.map(l => l.id))],
    show_mode:['facts','chains','memo'], challenge_defence:[...chains.map(c => c.id),'all'], reset_scenario:[], unsupported:[],
  };
  return {type:'object',anyOf:ACTIONS.flatMap(action => {
    const variants = action === 'preview_scenario' ? targets[action].map(target => [target]) : [targets[action]];
    return variants.map(targetIds => {
      const evidence = action === 'preview_scenario'
        ? [...new Set(dataset.facts.filter(f => f.qualification === targetIds[0]).flatMap(f => f.anchors.map(a => a.doc)))]
        : sources;
      return {type:'object',additionalProperties:false,required:['action','target','value','sourceIds'],
        properties:{action:{type:'string',enum:[action]},target:targetIds.length ? {type:'string',enum:targetIds} : {type:'null'},
          value:{type:action === 'preview_scenario' ? 'boolean' : 'null'},sourceIds:{type:'array',maxItems:['reset_scenario','show_mode','unsupported'].includes(action) ? 0 : evidence.length,items:{type:'string',enum:evidence}}}};
    });
  })};
}
export const INTENT_SCHEMA = intentSchemaFor({caseId:'c1-c2'});
