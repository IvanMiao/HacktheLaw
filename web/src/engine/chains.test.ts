import { describe, expect, it } from 'vitest';
import { analyse, counterfactuals, initialState, isContested, value, type AnalysisState, type Decision } from './chains';

const supportAll = (s: AnalysisState): AnalysisState => ({ ...s, decisions: Object.fromEntries(Object.keys(s.decisions).map((k) => [k, 'supported'])) });
const withDecision = (qid: string, decision: Decision): AnalysisState => {
  const state = supportAll(initialState());
  return { ...state, decisions: { ...state.decisions, [qid]: decision } };
};
const status = (s: AnalysisState) => Object.fromEntries(analyse(s).chains.map((c) => [c.id, c.status]));

describe('Domino engine on the sample case', () => {
  it('starts provisional and treats the missing conciliation record as insufficient', () => {
    const a = analyse(initialState());
    expect(status(initialState())).toEqual({ C1: 'contested', C2: 'insufficient' });
    expect(a.contestedQuals.sort()).toEqual(['q-clause', 'q-email', 'q-notice', 'q-writ1']);
    expect(a.chains[1].links.find((l) => l.id === 'c2-breach')?.status).toBe('insufficient');
    expect(a.chains[1].links.find((l) => l.id === 'c2-sanction')?.status).toBe('not_reached');
  });

  it('computes the limitation date with and without the art. 642 flag', () => {
    expect(analyse(initialState()).limitation.expiry).toBe('2026-03-16');
    expect(analyse({ ...initialState(), art642: false }).limitation.expiry).toBe('2026-03-15');
  });

  it('formal notice never changes the date', () => {
    const steps = analyse(initialState()).limitation.steps;
    expect(steps.find((s) => s.factId === 'f4')?.effect).toBe('none');
  });

  it('both chains hold once the lawyer supports every required premise', () => {
    expect(status(supportAll(initialState()))).toEqual({ C1: 'holds', C2: 'holds' });
  });

  it('acknowledgment counterfactual breaks C1 only', () => {
    const s = { ...supportAll(initialState()), whatIf: { 'q-email': true } };
    expect(status(s)).toEqual({ C1: 'fails', C2: 'holds' });
    expect(analyse(s).limitation.expiry).toBe('2027-06-02');
  });

  it('annulled instead of lapsed keeps the interruption and breaks C1', () => {
    const s = { ...supportAll(initialState()), whatIf: { 'q-writ1': false } };
    expect(status(s).C1).toBe('fails');
    expect(analyse(s).limitation.expiry).toBe('2031-02-20');
    expect(analyse(s).chains[0].links.find((l) => l.status === 'broken')?.id).toBe('c1-sanction');
  });

  it('lists which chains each counterfactual knocks down', () => {
    const cf = Object.fromEntries(counterfactuals(supportAll(initialState())).map((c) => [c.qid, c.effects.map((e) => e.chain)]));
    expect(cf).toEqual({ 'q-clause': ['C2'], 'q-email': ['C1'], 'q-notice': ['C1'], 'q-writ1': ['C1'], 'q-concil': ['C2'] });
  });
});

describe('Evidence review is separate from the proposed legal interpretation', () => {
  it('unsupported lapse does not turn the court order into a nullity', () => {
    const s = withDecision('q-writ1', 'unsupported');
    const a = analyse(s);
    expect(value(s, 'q-writ1')).toBe(true);
    expect(a.limitation.expiry).toBe('2026-03-16');
    expect(a.chains[0].status).toBe('unsupported');
    expect(a.chains[0].links.find((l) => l.id === 'c1-sanction')).toMatchObject({ title: 'Caducité', status: 'unsupported' });
    expect(a.chains[0].links.find((l) => l.id === 'c1-lost')?.status).toBe('not_reached');
    expect(a.chains[0].links.some((l) => l.status === 'broken')).toBe(false);
  });

  it('unsupported non-acknowledgment does not acknowledge the debt or reset the clock', () => {
    const s = withDecision('q-email', 'unsupported');
    const a = analyse(s);
    expect(value(s, 'q-email')).toBe(false);
    expect(a.limitation.steps.find((step) => step.factId === 'f3')?.effect).toBe('none');
    expect(a.chains[0].status).toBe('unsupported');
    expect(a.chains[0].links.find((l) => l.id === 'c1-cons')?.status).toBe('unsupported');
    expect(a.chains[0].links.find((l) => l.id === 'c1-out')?.status).toBe('not_reached');
  });

  it.each(['unreviewed', 'unsupported', 'insufficient'] as const)('does not certify any chain with a required %s review', (decision) => {
    for (const qid of Object.keys(initialState().decisions)) {
      const a = analyse(withDecision(qid, decision));
      const affected = a.chains.filter((chain) => chain.links.some((link) => link.deps.includes(qid)));
      expect(affected.length).toBeGreaterThan(0);
      for (const chain of affected) {
        expect(chain.status).toBe(decision === 'unreviewed' ? 'contested' : decision);
        expect(chain.hingesOn).toContain(qid);
      }
    }
  });

  it('includes rule-sourced premises in review and keeps their downstream conclusions provisional', () => {
    const s = withDecision('q-writ1', 'unreviewed');
    expect(isContested(s, 'q-writ1')).toBe(true);
    const a = analyse(s);
    expect(a.chains[0].links.find((l) => l.id === 'c1-out')?.status).toBe('contested');
    expect(a.contestedQuals).toContain('q-writ1');
  });

  it.each(['unreviewed', 'unsupported', 'insufficient'] as const)('does not present a computed negative outcome as established while the email is %s', (decision) => {
    const s = { ...withDecision('q-email', decision), whatIf: { 'q-notice': true } };
    const a = analyse(s);
    expect(a.limitation.expiry > '2026-04-08').toBe(true);
    expect(a.chains[0].status).toBe(decision === 'unreviewed' ? 'contested' : decision);
    expect(a.chains[0].hingesOn).toContain('q-email');
    expect(a.chains[0].links.find((l) => l.id === 'c1-cons')?.status).toBe(decision === 'unreviewed' ? 'contested' : decision);
    expect(a.chains[0].links.find((l) => l.id === 'c1-out')?.status).toBe('not_reached');
  });

  it('retains all unresolved prerequisites even when an earlier link stops the graph', () => {
    const s = withDecision('q-email', 'insufficient');
    s.decisions['q-writ1'] = 'unsupported';
    const a = analyse(s);
    expect(a.chains[0].hingesOn).toEqual(['q-writ1', 'q-email']);
    expect(a.chains[0].links.find((l) => l.id === 'c1-cons')?.status).toBe('not_reached');
  });

  it('previews a hypothetical without changing saved review decisions or follow-up work', () => {
    const s = withDecision('q-email', 'insufficient');
    s.reviews['q-email'] = { note: 'Need the full email thread.', nextStep: 'Request supporting evidence' };
    const before = structuredClone(s);
    const hypothetical = { ...s, whatIf: { 'q-email': true } };
    expect(value(hypothetical, 'q-email')).toBe(true);
    expect(status(hypothetical).C1).toBe('fails');
    expect(isContested(hypothetical, 'q-email')).toBe(false);
    counterfactuals(hypothetical);
    expect(s).toEqual(before);
    expect(hypothetical.decisions['q-email']).toBe('insufficient');
    expect(status(s).C1).toBe('insufficient');
    expect(value(s, 'q-email')).toBe(false);
  });
});
