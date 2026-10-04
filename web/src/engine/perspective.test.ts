import { describe, expect, it } from 'vitest';
import { getCase, CASE_CATALOG } from '../data/catalog';
import { translator } from '../i18n/translate';
import { adoptInterpretation, analyse, initialState } from './chains';
import { buildMemo, toMd } from './memo';
import { defaultSide, perspectiveImpact, representedParty, sideLabel } from './perspective';
import { serializeReviews } from './reviewStorage';

describe('party perspectives', () => {
  it('uses the case default and the correct appellate role labels', () => {
    expect(defaultSide(getCase('c1-c2'))).toBe('defendant');
    const bundle = getCase('c5');
    expect(defaultSide(bundle)).toBe('defendant');
    expect(sideLabel(bundle, 'claimant')).toBe('Appellant');
    expect(sideLabel(bundle, 'defendant', translator('fr'))).toBe('Intimé');
    expect(defaultSide({ ...bundle, profile: { ...bundle.profile, side: 'Appellant (A)' } })).toBe('claimant');
  });

  it('explains the same C1/C2 chain as a risk or a ground without changing its result', () => {
    const bundle = getCase('c1-c2'), state = initialState(bundle);
    const analysis = analyse(bundle, state);
    const before = JSON.stringify({ bundle, state, analysis });
    for (const chain of analysis.chains) {
      expect(perspectiveImpact(bundle, chain, 'claimant').label).toContain('Potential risk');
      expect(perspectiveImpact(bundle, chain, 'defendant').label).toContain('Potential ground');
      expect(perspectiveImpact(bundle, { ...chain, status: 'pending' }, 'claimant').label).toBe('Needs reassessment');
      expect(perspectiveImpact(bundle, { ...chain, status: 'fails' }, 'defendant').label).toBe('Chain not established');
    }
    expect(JSON.stringify({ bundle, state, analysis })).toBe(before);
  });

  it.each(CASE_CATALOG)('keeps evidence and reviews identical in both $id memo perspectives', bundle => {
    const q = bundle.qualifications[0];
    const state = adoptInterpretation(bundle, initialState(bundle), q.id, q.proposed, { note: 'Shared lawyer review', nextStep: '' });
    const saved = serializeReviews(bundle, state);
    for (const locale of ['en', 'fr'] as const) {
      const t = translator(locale), analysis = analyse(bundle, state, t);
      const claimant = buildMemo(bundle, analysis, state, t, 'claimant');
      const defendant = buildMemo(bundle, analysis, state, t, 'defendant');
      const citations = (blocks: typeof claimant) => blocks.flatMap(block => block.parts.filter(part => typeof part !== 'string'));
      expect(citations(claimant)).toEqual(citations(defendant));
      expect(toMd(bundle, claimant, t)).toContain('Shared lawyer review');
      expect(toMd(bundle, defendant, t)).toContain('Shared lawyer review');
      expect(serializeReviews(bundle, state)).toBe(saved);
    }
  });

  it('gives the claimant a risk memo rather than instructions to raise defences against itself', () => {
    const bundle = getCase('c1-c2'), state = initialState(bundle);
    const claimant = toMd(bundle, buildMemo(bundle, analyse(bundle, state), state, undefined, 'claimant'));
    expect(claimant).toContain('We act for the claimant, Atelier Lumière');
    expect(claimant).toContain('Risk A');
    expect(claimant).toContain('Review the limitation timeline');
    expect(claimant).not.toContain('Serve written submissions raising');
    expect(claimant).not.toContain('Ask the claimant');
  });

  it('does not infer party advantage from the inconsistent C4 metadata', () => {
    const bundle = getCase('c4'), analysis = analyse(bundle, initialState(bundle));
    for (const side of ['claimant', 'defendant'] as const) {
      expect(representedParty(bundle, side)).toBe('Party identity to verify');
      expect(perspectiveImpact(bundle, analysis.chains[0], side).label).toBe('Party roles need verification');
    }
  });
});
