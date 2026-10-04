import { describe, expect, it } from 'vitest';
import { getCase } from '../data/catalog';
import { SAMPLE } from '../data/sample';
import { initialState, analyse } from '../engine/chains';
import { buildContext, applyIntent, describeIntent } from './commands';
import { INTENT_SCHEMA, validateIntent } from './contract';

const sample = getCase('c1-c2');
const intent = (action: string, target: string | null = null, value: boolean | null = null, sourceIds: string[] = []) => ({ action, target, value, sourceIds });

describe('voice safety boundary', () => {
  it('uses the selected catalog ID for the main sample bundle', () => {
    expect(buildContext(initialState(SAMPLE), SAMPLE).caseId).toBe('c1-c2');
  });

  it('uses per-action schemas: preview has known non-null IDs; reset is null only', () => {
    const schema = INTENT_SCHEMA as unknown as { anyOf?: { properties: { action: { enum: string[] }; target: { type: string; enum?: string[] }; value: { type: string } } }[] };
    expect(schema.anyOf).toBeInstanceOf(Array);
    const previews = schema.anyOf!.filter((item) => item.properties.action.enum[0] === 'preview_scenario');
    expect(previews.flatMap((item) => item.properties.target.enum ?? [])).toEqual(expect.arrayContaining(['q-email', 'q-concil']));
    expect(previews.every((item) => item.properties.target.type === 'string' && item.properties.value.type === 'boolean')).toBe(true);
    const reset = schema.anyOf!.find((item) => item.properties.action.enum[0] === 'reset_scenario')!;
    expect(reset.properties.target.type).toBe('null');
  });

  it('supplies real chain statements, qualification polarity, sources and provisional decisions', () => {
    const context = buildContext(initialState(sample), sample);
    expect(context.chains[0].links.find((link) => link.id === 'c1-cons')?.statement).toContain('16/03/2026');
    expect(context.qualifications.find((qualification) => qualification.id === 'q-concil')?.yes).toBe('No attempt on file');
    expect(context.sources.find((source) => source.id === 'contract')?.provenance).toBe('mock');
    expect(context.decisions['q-email']).toBe('proposed');
  });

  it('sets acknowledgment idempotently, changes only C1, never decisions', () => {
    const state = initialState(sample);
    const context = buildContext(state, sample);
    const preview = validateIntent(intent('preview_scenario', 'q-email', true), context);
    const next = applyIntent(state, preview, sample);
    expect(applyIntent(next, preview, sample)).toEqual(next);
    expect(next.decisions).toEqual(state.decisions);
    expect(analyse(sample, next).chains.map((chain) => chain.status)).toEqual(['fails', 'contested']);
    expect(describeIntent(next, preview, sample)).toContain('Hypothetical');
  });

  it('allows only the actual qualification source on a hypothetical preview', () => {
    const context = buildContext(initialState(sample), sample);
    expect(validateIntent(intent('preview_scenario', 'q-email', true, ['email']), context).sourceIds).toEqual(['email']);
    expect(() => validateIntent(intent('preview_scenario', 'q-email', true, ['contract']), context)).toThrow();
  });

  it('uses false for conciliation attempted before filing, breaking C2', () => {
    const state = initialState(sample);
    const next = applyIntent(state, validateIntent(intent('preview_scenario', 'q-concil', false), buildContext(state, sample)), sample);
    expect(analyse(sample, next).chains.map((chain) => chain.status)).toEqual(['contested', 'fails']);
  });

  it('resets only hypothetical overrides preserving lawyer decisions and art642', () => {
    const initial = initialState(sample);
    const state = { ...initial, decisions: { ...initial.decisions, 'q-email': 'confirmed' as const }, whatIf: { 'q-email': true }, art642: false };
    expect(applyIntent(state, validateIntent(intent('reset_scenario'), buildContext(state, sample)), sample)).toEqual({ ...state, whatIf: {} });
  });

  it.each([
    intent('confirm', 'q-email', true), intent('preview_scenario', null, true), intent('preview_scenario', 'q-unknown', true),
    intent('preview_scenario', 'q-email', 'true' as unknown as boolean),
    intent('show_mode', 'terminal'), intent('show_evidence', 'secret'),
    intent('explain_link', 'c9-out'), intent('explain_link', 'c1-cons', null, ['invented']),
    { ...intent('reset_scenario'), decisions: {} }, intent('reset_scenario', 'q-email'),
    intent('show_evidence', 'contract', null, ['email']),
  ])('rejects unsafe, unknown, irrelevant or ungrounded output %j', (raw) => {
    expect(() => validateIntent(raw, buildContext(initialState(sample), sample))).toThrow();
  });

  it('explanations are deterministic engine text, not model legal claims', () => {
    const state = initialState(sample);
    const context = buildContext(state, sample);
    const explanation = validateIntent(intent('explain_link', 'c1-lost', null, ['civ']), context);
    expect(describeIntent(state, explanation, sample)).toContain(context.chains[0].links.find((link) => link.id === 'c1-lost')!.statement);
    expect(() => validateIntent(intent('explain_link', 'c1-lost', null, ['contract']), context)).toThrow();
  });

  it('unsupported commands cannot change state; challenges are grounded and read-only', () => {
    const state = initialState(sample);
    const challenge = validateIntent(intent('challenge_defence', 'C1'), buildContext(state, sample));
    expect(applyIntent(state, challenge, sample)).toEqual(state);
    expect(describeIntent(state, challenge, sample)).toContain('q-email');
    expect(describeIntent(state, validateIntent(intent('unsupported'), buildContext(state, sample),), sample)).toContain('not supported');
  });
});
