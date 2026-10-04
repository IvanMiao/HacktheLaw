import type { CaseBundle, Qualification } from '../data/bundle.js';
import { getCase, type CaseId } from '../data/catalog.js';
import type { AnalysisState, ChainResult } from '../engine/chains.js';
import { analyse, initialState } from '../engine/chains.js';

export const ACTIONS = ['show_evidence', 'explain_link', 'preview_scenario', 'reset_scenario', 'show_mode', 'challenge_defence', 'unsupported'] as const;
export type Intent = { action: typeof ACTIONS[number]; target: string | null; value: boolean | null; sourceIds: string[] };
export type VoiceContext = {
  caseId: CaseId;
  hypothetical: boolean;
  decisions: Record<string, string>;
  interpretations?: Record<string, boolean>;
  whatIf: Record<string, boolean>;
  qualifications: Qualification[];
  chains: ChainResult[];
  sources: { id: string; title: string; provenance: CaseBundle['docs'][number]['provenance'] }[];
};

export const SOURCE_IDS = getCase('c1-c2').docs.map((doc) => doc.id);
export const LINK_IDS = analyse(getCase('c1-c2'), initialState(getCase('c1-c2'))).chains.flatMap((chain) => chain.links.map((link) => link.id));
const invalid = (): never => { throw new Error('Unsupported or ungrounded command. No changes made.'); };

export function validateCaseContext(raw: unknown): VoiceContext {
  try {
    const context = raw as VoiceContext;
    const bundle = getCase(context.caseId);
    if (typeof context.hypothetical !== 'boolean' || !context.decisions || !context.whatIf
      || !Array.isArray(context.qualifications) || !Array.isArray(context.chains) || !Array.isArray(context.sources)) return invalid();
    const ids = bundle.qualifications.map((qualification) => qualification.id);
    if (Object.keys(context.decisions).length !== ids.length
      || !ids.every((id) => ['proposed', 'confirmed', 'rejected', 'pending', 'disagreed'].includes(context.decisions[id]))) return invalid();
    if (!Object.entries(context.whatIf).every(([id, value]) => ids.includes(id) && typeof value === 'boolean')
      || context.hypothetical !== Boolean(Object.keys(context.whatIf).length)) return invalid();
    if (JSON.stringify(context.qualifications) !== JSON.stringify(bundle.qualifications)) return invalid();
    const sources = bundle.docs.map(({ id, title, provenance }) => ({ id, title, provenance }));
    if (JSON.stringify(context.sources) !== JSON.stringify(sources)) return invalid();
    const interpretations = context.interpretations ?? {};
    if (typeof interpretations !== 'object' || Array.isArray(interpretations)
      || !Object.entries(interpretations).every(([id, value]) => ids.includes(id) && typeof value === 'boolean')) return invalid();
    const state: AnalysisState = { ...initialState(bundle), decisions: context.decisions as AnalysisState['decisions'], interpretations, whatIf: context.whatIf, art642: true };
    const canonical = analyse(bundle, state).chains;
    const alternate = analyse(bundle, { ...state, art642: false }).chains;
    if (JSON.stringify(context.chains) !== JSON.stringify(canonical) && JSON.stringify(context.chains) !== JSON.stringify(alternate)) return invalid();
    return { ...context, qualifications: bundle.qualifications, sources, chains: context.chains };
  } catch {
    return invalid();
  }
}

export function validateIntent(raw: unknown, context: VoiceContext): Intent {
  const bundle = getCase(context.caseId);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const record = raw as Record<string, unknown>;
  const sources = bundle.docs.map((doc) => doc.id);
  if (Object.keys(record).sort().join(',') !== 'action,sourceIds,target,value'
    || !ACTIONS.includes(record.action as Intent['action'])
    || !(record.target === null || typeof record.target === 'string')
    || !(record.value === null || typeof record.value === 'boolean')
    || !Array.isArray(record.sourceIds) || record.sourceIds.length > sources.length
    || !record.sourceIds.every((id) => typeof id === 'string' && context.sources.some((source) => source.id === id) && sources.includes(id))) return invalid();
  const intent = record as Intent;
  const chains = context.chains.filter((chain) => chain.id === intent.target);
  const links = context.chains.flatMap((chain) => chain.links).filter((link) => link.id === intent.target);
  let allowedSources: string[] = [];
  switch (intent.action) {
    case 'preview_scenario':
      if (!bundle.qualifications.some((qualification) => qualification.id === intent.target) || typeof intent.value !== 'boolean') return invalid();
      allowedSources = bundle.facts.filter((fact) => fact.qualification === intent.target).flatMap((fact) => fact.anchors.map((anchor) => anchor.doc));
      break;
    case 'show_mode':
      if (!['facts', 'chains', 'memo'].includes(intent.target ?? '') || intent.sourceIds.length) return invalid();
      break;
    case 'show_evidence':
      if (!sources.includes(intent.target ?? '') || !context.sources.some((source) => source.id === intent.target)) return invalid();
      allowedSources = [intent.target!];
      break;
    case 'explain_link':
      if (!chains.length && !links.length) return invalid();
      allowedSources = [...chains.flatMap((chain) => chain.links), ...links].flatMap((link) => link.anchors.map((anchor) => anchor.doc));
      break;
    case 'challenge_defence':
      if (intent.target !== 'all' && !context.chains.some((chain) => chain.id === intent.target)) return invalid();
      allowedSources = context.chains.filter((chain) => intent.target === 'all' || chain.id === intent.target)
        .flatMap((chain) => chain.links.flatMap((link) => link.anchors.map((anchor) => anchor.doc)));
      break;
    default:
      if (intent.target !== null || intent.sourceIds.length) return invalid();
  }
  if (intent.action !== 'preview_scenario' && intent.value !== null) return invalid();
  if (!intent.sourceIds.every((id) => allowedSources.includes(id))) return invalid();
  return { action: intent.action, target: intent.target, value: intent.value, sourceIds: [...new Set(intent.sourceIds)] };
}

export function intentSchemaFor(context: Pick<VoiceContext, 'caseId'>) {
  const bundle = getCase(context.caseId);
  const chains = analyse(bundle, initialState(bundle)).chains;
  const sources = bundle.docs.map((doc) => doc.id);
  const targets: Record<Intent['action'], string[]> = {
    preview_scenario: bundle.qualifications.map((qualification) => qualification.id),
    show_evidence: sources,
    explain_link: [...chains.map((chain) => chain.id), ...chains.flatMap((chain) => chain.links.map((link) => link.id))],
    show_mode: ['facts', 'chains', 'memo'],
    challenge_defence: [...chains.map((chain) => chain.id), 'all'],
    reset_scenario: [],
    unsupported: [],
  };
  return {
    type: 'object',
    anyOf: ACTIONS.flatMap((action) => {
      const variants = action === 'preview_scenario' ? targets[action].map((target) => [target]) : [targets[action]];
      return variants.map((targetIds) => {
        const evidence = action === 'preview_scenario'
          ? [...new Set(bundle.facts.filter((fact) => fact.qualification === targetIds[0]).flatMap((fact) => fact.anchors.map((anchor) => anchor.doc)))]
          : sources;
        return {
          type: 'object',
          additionalProperties: false,
          required: ['action', 'target', 'value', 'sourceIds'],
          properties: {
            action: { type: 'string', enum: [action] },
            target: targetIds.length ? { type: 'string', enum: targetIds } : { type: 'null' },
            value: { type: action === 'preview_scenario' ? 'boolean' : 'null' },
            sourceIds: {
              type: 'array',
              maxItems: ['reset_scenario', 'show_mode', 'unsupported'].includes(action) ? 0 : evidence.length,
              items: { type: 'string', enum: evidence },
            },
          },
        };
      });
    }),
  };
}

export const INTENT_SCHEMA = intentSchemaFor({ caseId: 'c1-c2' });
