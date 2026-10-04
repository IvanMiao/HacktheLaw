import type { ChainResult } from '../engine/chains';
import { FACTS, QUALIFICATIONS } from '../data/case.ts';

export const ACTIONS = ['show_evidence', 'explain_link', 'preview_scenario', 'reset_scenario', 'show_mode', 'challenge_defence', 'unsupported'] as const;
export type Intent = { action: typeof ACTIONS[number]; target: string | null; value: boolean | null; sourceIds: string[] };
export type VoiceContext = {
  hypothetical: boolean;
  decisions: Record<string, string>;
  qualifications: typeof QUALIFICATIONS;
  chains: ChainResult[];
  sources: { id: string; title: string; provenance: 'real' | 'mock' }[];
};
export const SOURCE_IDS = ['contract', 'invoice', 'email', 'notice', 'writ1', 'registry', 'order', 'writ2', 'pieces', 'cass2003', 'cass2014', 'cassC1', 'cpc', 'civ'];
export const LINK_IDS = ['c1-fact','c1-req','c1-breach','c1-sanction','c1-lost','c1-cons','c1-out','c2-fact','c2-req','c2-breach','c2-sanction','c2-lost','c2-out'];
const invalid = () => { throw new Error('Unsupported or ungrounded command. No changes made.'); };
export function validateIntent(raw: unknown, context: VoiceContext): Intent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).sort().join(',') !== 'action,sourceIds,target,value' || !ACTIONS.includes(r.action as Intent['action']) ||
      !(r.target === null || typeof r.target === 'string') || !(r.value === null || typeof r.value === 'boolean') ||
      !Array.isArray(r.sourceIds) || r.sourceIds.length > SOURCE_IDS.length || !r.sourceIds.every(id => typeof id === 'string' && context.sources.some(s => s.id === id) && SOURCE_IDS.includes(id))) return invalid();
  const i = r as Intent;
  const chains = context.chains.filter(c => c.id === i.target);
  const links = context.chains.flatMap(c => c.links).filter(l => l.id === i.target);
  let allowedSources: string[] = [];
  switch (i.action) {
    case 'preview_scenario':
      if (!QUALIFICATIONS.some(q => q.id === i.target) || typeof i.value !== 'boolean') return invalid();
      allowedSources = FACTS.filter(f=>f.qualification===i.target).flatMap(f=>f.anchors.map(a=>a.doc)); break;
    case 'show_mode':
      if (!['facts','chains','memo'].includes(i.target ?? '') || i.sourceIds.length) return invalid(); break;
    case 'show_evidence':
      if (!SOURCE_IDS.includes(i.target ?? '') || !context.sources.some(s => s.id === i.target)) return invalid();
      allowedSources = [i.target!]; break;
    case 'explain_link':
      if (!chains.length && !links.length) return invalid();
      allowedSources = [...chains.flatMap(c => c.links), ...links].flatMap(l => l.anchors.map(a => a.doc)); break;
    case 'challenge_defence':
      if (!['C1','C2','all'].includes(i.target ?? '')) return invalid();
      allowedSources = context.chains.filter(c => i.target === 'all' || c.id === i.target).flatMap(c => c.links.flatMap(l => l.anchors.map(a => a.doc))); break;
    default:
      if (i.target !== null || i.sourceIds.length) return invalid();
  }
  if (i.action !== 'preview_scenario' && i.value !== null) return invalid();
  if (!i.sourceIds.every(id => allowedSources.includes(id))) return invalid();
  return { action: i.action, target: i.target, value: i.value, sourceIds: [...new Set(i.sourceIds)] };
}
const TARGETS: Record<Intent['action'], string[]> = {
  preview_scenario: QUALIFICATIONS.map(q=>q.id), show_evidence: SOURCE_IDS,
  explain_link: [...LINK_IDS,'C1','C2'], show_mode:['facts','chains','memo'],
  challenge_defence:['C1','C2','all'], reset_scenario:[], unsupported:[],
};
export const INTENT_SCHEMA = {
  type:'object',
  anyOf:ACTIONS.map(action=>({
    type:'object',additionalProperties:false,required:['action','target','value','sourceIds'],
    properties:{
      action:{type:'string',enum:[action]},
      target:TARGETS[action].length ? {type:'string',enum:TARGETS[action]} : {type:'null'},
      value:{type:action==='preview_scenario'?'boolean':'null'},
      sourceIds:{type:'array',items:{type:'string',enum:SOURCE_IDS}},
    },
  })),
};
