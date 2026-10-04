import { describe, expect, it } from 'vitest';
import { SAMPLE } from '../data/sample';
import type { CaseBundle } from '../data/bundle';
import { analyse, counterfactuals, deriveCase, initialState } from './chains';
import { translator } from '../i18n/translate';

const grounds = (bundle: CaseBundle) => analyse(bundle, initialState(bundle)).chains
  .filter((chain) => chain.status === 'holds' || chain.status === 'contested').length;

describe('CaseBundle-driven analysis', () => {
  it('does not depend on sample fact or qualification ids', () => {
    expect(deriveCase(SAMPLE)).toMatchObject({
      limitationStart: { id: 'f2' },
      periodYears: 5,
      regimeRule: 'art. L110-4 C. com.',
      firstWrit: { id: 'f5' },
      lastWrit: { id: 'f8' },
      placement: { id: 'f6' },
      sanction: { id: 'f7' },
      clause: { id: 'f1' },
    });
    const factIds = new Map(SAMPLE.facts.map((fact, i) => [fact.id, `x${i + 1}`]));
    const qualIds = new Map(SAMPLE.qualifications.map((qualification, i) => [qualification.id, `qa${i + 1}`]));
    const renamed: CaseBundle = {
      ...SAMPLE,
      facts: SAMPLE.facts.map((fact) => ({
        ...fact,
        id: factIds.get(fact.id)!,
        ...(fact.qualification ? { qualification: qualIds.get(fact.qualification)! } : {}),
        attrs: { ...fact.attrs, ...(fact.attrs.writFactId ? { writFactId: factIds.get(fact.attrs.writFactId)! } : {}) },
      })),
      qualifications: SAMPLE.qualifications.map((qualification) => ({
        ...qualification,
        id: qualIds.get(qualification.id)!,
        factId: factIds.get(qualification.factId)!,
      })),
    };
    const baseAnalysis = analyse(SAMPLE, initialState(SAMPLE));
    const renamedAnalysis = analyse(renamed, initialState(renamed));
    const effects = (bundle: CaseBundle) => {
      const reverse = new Map([...qualIds].map(([original, replacement]) => [replacement, original]));
      return counterfactuals(bundle, initialState(bundle)).map((counterfactual) => [
        reverse.get(counterfactual.qid) ?? counterfactual.qid,
        counterfactual.effects.map(({ chain, from, to }) => [chain, from, to]),
      ]);
    };
    expect(renamedAnalysis.chains.map((chain) => [chain.id, chain.status])).toEqual(baseAnalysis.chains.map((chain) => [chain.id, chain.status]));
    expect(renamedAnalysis.limitation?.expiry).toBe(baseAnalysis.limitation?.expiry);
    expect(effects(renamed)).toEqual(effects(SAMPLE));
  });

  it('makes C1 unavailable without the second writ while preserving C2', () => {
    const bundle = { ...SAMPLE, facts: SAMPLE.facts.filter((fact) => fact.id !== 'f8') };
    const result = analyse(bundle, initialState(bundle));
    expect(result.chains.find((chain) => chain.id === 'C1')?.status).toBe('not_applicable');
    expect(result.chains.find((chain) => chain.id === 'C1')?.missing).toContain('No second writ in the file');
    expect(result.chains.find((chain) => chain.id === 'C2')?.status).toBe('contested');
    expect(grounds(bundle)).toBe(1);
  });

  it('excludes an unverified placement from C1', () => {
    const bundle = { ...SAMPLE, facts: SAMPLE.facts.map((fact) => fact.id === 'f6' ? { ...fact, verified: false } : fact) };
    expect(analyse(bundle, initialState(bundle)).chains.find((chain) => chain.id === 'C1')?.status).toBe('not_applicable');
  });

  it('uses the consumer limitation period and still evaluates C1', () => {
    const bundle = { ...SAMPLE, profile: { ...SAMPLE.profile, relationship: 'consumer' as const } };
    const result = analyse(bundle, initialState(bundle));
    expect(result.limitation?.expiry).toBe('2023-03-15');
    expect(result.chains.find((chain) => chain.id === 'C1')?.status).not.toBe('not_applicable');
  });

  it('keeps C1 when the contract clause fact is absent', () => {
    const bundle = { ...SAMPLE, facts: SAMPLE.facts.filter((fact) => fact.id !== 'f1') };
    const result = analyse(bundle, initialState(bundle));
    expect(result.chains.find((chain) => chain.id === 'C2')?.status).toBe('not_applicable');
    expect(result.chains.find((chain) => chain.id === 'C1')).toEqual(analyse(SAMPLE, initialState(SAMPLE)).chains[0]);
  });

  it('translates bilingual Text values for the active locale', () => {
    const qualification = { ...SAMPLE.qualifications[0], question: { en: 'Question {number} in English', fr: 'Question {number} en français' } };
    expect(translator('en')(qualification.question, { number: 1 })).toBe('Question 1 in English');
    expect(translator('fr')(qualification.question, { number: 1 })).toBe('Question 1 en français');
  });
});
