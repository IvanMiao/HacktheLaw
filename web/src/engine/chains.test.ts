import { describe, expect, it } from 'vitest';
import { analyse, counterfactuals, initialState, type AnalysisState } from './chains';

const confirmAll = (s: AnalysisState): AnalysisState => ({ ...s, decisions: Object.fromEntries(Object.keys(s.decisions).map((k) => [k, 'confirmed'])) });
const status = (s: AnalysisState) => Object.fromEntries(analyse(s).chains.map((c) => [c.id, c.status]));

describe('Domino engine on the sample case', () => {
  it('starts provisional: both chains hold but hinge on AI-inferred qualifications', () => {
    const a = analyse(initialState());
    expect(status(initialState())).toEqual({ C1: 'contested', C2: 'contested' });
    expect(a.contestedQuals.sort()).toEqual(['q-clause', 'q-email']);
  });

  it('computes the limitation date with and without the art. 642 flag', () => {
    expect(analyse(initialState()).limitation.expiry).toBe('2026-03-16');
    expect(analyse({ ...initialState(), art642: false }).limitation.expiry).toBe('2026-03-15');
  });

  it('formal notice never changes the date', () => {
    const steps = analyse(initialState()).limitation.steps;
    expect(steps.find((s) => s.factId === 'f4')?.effect).toBe('none');
  });

  it('both chains hold once the lawyer confirms everything', () => {
    expect(status(confirmAll(initialState()))).toEqual({ C1: 'holds', C2: 'holds' });
  });

  it('acknowledgment counterfactual breaks C1 only', () => {
    const s = { ...confirmAll(initialState()), whatIf: { 'q-email': true } };
    expect(status(s)).toEqual({ C1: 'fails', C2: 'holds' });
    expect(analyse(s).limitation.expiry).toBe('2027-06-02');
  });

  it('annulled instead of lapsed keeps the interruption and breaks C1', () => {
    const s = { ...confirmAll(initialState()), whatIf: { 'q-writ1': false } };
    expect(status(s).C1).toBe('fails');
    expect(analyse(s).limitation.expiry).toBe('2031-02-20');
    expect(analyse(s).chains[0].links.find((l) => l.status === 'broken')?.id).toBe('c1-sanction');
  });

  it('lists which chains each counterfactual knocks down', () => {
    const cf = Object.fromEntries(counterfactuals(initialState()).map((c) => [c.qid, c.effects.map((e) => e.chain)]));
    expect(cf).toEqual({ 'q-clause': ['C2'], 'q-email': ['C1'], 'q-notice': ['C1'], 'q-writ1': ['C1'], 'q-concil': ['C2'] });
  });
});
