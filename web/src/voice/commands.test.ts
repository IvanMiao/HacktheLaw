import { describe, expect, it } from 'vitest';
import { initialState, analyse } from '../engine/chains';
import { buildContext, applyIntent, describeIntent } from './commands';
import { INTENT_SCHEMA, validateIntent } from './contract';

const intent = (action: string, target: string | null = null, value: boolean | null = null, sourceIds: string[] = []) => ({ action, target, value, sourceIds });
describe('voice safety boundary', () => {
  it('uses per-action schemas: preview has known non-null IDs; reset is null only', () => {
    const schema = INTENT_SCHEMA as unknown as {anyOf?:{properties:{action:{enum:string[]};target:{type:string;enum?:string[]};value:{type:string}}}[]};
    expect(schema.anyOf).toBeInstanceOf(Array);
    const previews = schema.anyOf!.filter(s=>s.properties.action.enum[0]==='preview_scenario');
    expect(previews.flatMap(s => s.properties.target.enum ?? [])).toEqual(expect.arrayContaining(['q-email','q-concil']));
    expect(previews.every(s => s.properties.target.type === 'string' && s.properties.value.type === 'boolean')).toBe(true);
    const reset = schema.anyOf!.find(s=>s.properties.action.enum[0]==='reset_scenario')!;
    expect(reset.properties.target.type).toBe('null');
  });
  it('supplies real chain statements, qualification polarity, sources and provisional decisions', () => {
    const c = buildContext(initialState());
    expect(c.chains[0].links.find(l => l.id === 'c1-cons')?.statement).toContain('16/03/2026');
    expect(c.qualifications.find(q => q.id === 'q-concil')?.yes).toBe('No attempt on file');
    expect(c.sources.find(s => s.id === 'contract')?.provenance).toBe('mock');
    expect(c.decisions['q-email']).toBe('proposed');
  });
  it('sets acknowledgment idempotently, changes only C1, never decisions', () => {
    const state = initialState(); const c = buildContext(state);
    const i = validateIntent(intent('preview_scenario', 'q-email', true), c);
    const next = applyIntent(state, i);
    expect(applyIntent(next, i)).toEqual(next);
    expect(next.decisions).toEqual(state.decisions);
    expect(analyse(next).chains.map(c => c.status)).toEqual(['fails', 'contested']);
    expect(describeIntent(next, i)).toContain('Hypothetical');
  });
  it('allows only the actual qualification source on a hypothetical preview', () => {
    const c = buildContext(initialState());
    expect(validateIntent(intent('preview_scenario','q-email',true,['email']), c).sourceIds).toEqual(['email']);
    expect(() => validateIntent(intent('preview_scenario','q-email',true,['contract']), c)).toThrow();
  });
  it('uses false for conciliation attempted before filing, breaking C2', () => {
    const state = initialState();
    const next = applyIntent(state, validateIntent(intent('preview_scenario', 'q-concil', false), buildContext(state)));
    expect(analyse(next).chains.map(c => c.status)).toEqual(['contested', 'fails']);
  });
  it('resets only hypothetical overrides preserving lawyer decisions and art642', () => {
    const state = { ...initialState(), decisions: { ...initialState().decisions, 'q-email': 'confirmed' as const }, whatIf: { 'q-email': true }, art642: false };
    expect(applyIntent(state, validateIntent(intent('reset_scenario'), buildContext(state)))).toEqual({ ...state, whatIf: {} });
  });
  it.each([
    intent('confirm', 'q-email', true), intent('preview_scenario', null, true), intent('preview_scenario', 'q-unknown', true),
    intent('preview_scenario', 'q-email', 'true' as unknown as boolean),
    intent('show_mode', 'terminal'), intent('show_evidence', 'secret'),
    intent('explain_link', 'c9-out'), intent('explain_link', 'c1-cons', null, ['invented']),
    { ...intent('reset_scenario'), decisions: {} }, intent('reset_scenario', 'q-email'),
    intent('show_evidence', 'contract', null, ['email']),
  ])('rejects unsafe, unknown, irrelevant or ungrounded output %j', raw => {
    expect(() => validateIntent(raw, buildContext(initialState()))).toThrow();
  });
  it('explanations are deterministic engine text, not model legal claims', () => {
    const state = initialState(); const c = buildContext(state);
    const i = validateIntent(intent('explain_link', 'c1-lost', null, ['civ']), c);
    expect(describeIntent(state, i)).toContain(c.chains[0].links.find(l => l.id === 'c1-lost')!.statement);
    expect(() => validateIntent(intent('explain_link', 'c1-lost', null, ['contract']), c)).toThrow();
  });
  it('unsupported commands cannot change state; challenges are grounded and read-only', () => {
    const state = initialState();
    const i = validateIntent(intent('challenge_defence', 'C1'), buildContext(state));
    expect(applyIntent(state, i)).toEqual(state);
    expect(describeIntent(state, i)).toContain('q-email');
    expect(describeIntent(state, validateIntent(intent('unsupported'), buildContext(state)))).toContain('not supported');
  });
});
