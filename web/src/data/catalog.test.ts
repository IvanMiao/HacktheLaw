import { describe, expect, it } from 'vitest';
import { CASE_CATALOG, PRESETS, getCase } from './catalog';
import { allDocs } from './bundle';
import './documents';
import { analyse, counterfactuals, initialState } from '../engine/chains';
import { buildMemo, toMd } from '../engine/memo';
import { proceduralDeadline, franceHolidays } from '../engine/proceduralDates';

describe('CaseBundle presets', () => {
  it('keeps the server-safe C1/C2 catalog entry and exports C3/C4/C5 as presets', () => {
    expect(CASE_CATALOG.map((bundle) => bundle.id)).toEqual(['c1-c2', 'c3', 'c4', 'c5']);
    expect(PRESETS.map((bundle) => bundle.id)).toEqual(['c3', 'c4', 'c5']);
    for (const bundle of CASE_CATALOG) {
      const state = initialState(bundle);
      expect(Object.keys(state.decisions)).toEqual(bundle.qualifications.map((qualification) => qualification.id));
    }
    for (const bundle of PRESETS) {
      expect(bundle.origin).toBe('cached');
      expect(bundle.preset).toBe(bundle.id);
      expect(bundle.qualifications.every((qualification) => qualification.kind === 'preset')).toBe(true);
      expect(bundle.facts.every((fact) => fact.role === 'other' && fact.verified && Object.keys(fact.attrs).length === 0)).toBe(true);
      expect(bundle.facts.length).toBeGreaterThan(4);
      const analysis = analyse(bundle, initialState(bundle));
      const anchors = [
        ...bundle.facts.flatMap((fact) => fact.anchors),
        ...analysis.chains.flatMap((chain) => chain.links.flatMap((link) => link.anchors)),
      ];
      for (const anchor of anchors) {
        expect(bundle.docs.find((doc) => doc.id === anchor.doc)?.text).toContain(anchor.quote);
      }
      const state = initialState(bundle);
      const markdown = toMd(bundle, buildMemo(bundle, analysis, state));
      expect(markdown).toContain(bundle.profile.title as string);
      expect(markdown).not.toContain('Bâtiself');
      expect(markdown).toContain('SYNTHETIC');
    }
    expect(getCase('c3').profile.courtType).toBe('tribunal_commerce');
    expect(getCase('c3').profile.relationship).toBe('commercial');
    expect(getCase('c4').profile.courtType).toBe('tribunal_judiciaire');
    expect(getCase('c4').profile.relationship).toBe('consumer');
    expect(getCase('c5').profile.courtType).toBe('other');
    expect(getCase('c5').profile.relationship).toBe('commercial');
    expect(getCase('c4').profile.claimant).toBe('M. Antoine Rigal');
    expect(getCase('c4').profile.defendant).toBe('MobiPlus Distribution SAS');
    expect(() => getCase('unknown')).toThrow();
  });

  it('includes library metadata once in every catalog bundle while retaining browser document text', () => {
    const library = getCase('c1-c2').docs.filter((doc) => doc.group !== 'case');
    const libraryIds = new Set(library.map((doc) => doc.id));
    for (const bundle of CASE_CATALOG) {
      expect(bundle.docs.filter((doc) => libraryIds.has(doc.id)).map(({ id, title, provenance }) => ({ id, title, provenance })))
        .toEqual(library.map(({ id, title, provenance }) => ({ id, title, provenance })));
      const docs = allDocs(bundle);
      expect(new Set(docs.map((doc) => doc.id)).size).toBe(docs.length);
      expect(docs.find((doc) => doc.id === library[0].id)?.text).not.toBe('');
    }
  });

  it('keeps payment stay independently when C3 timely declaration removes forclusion', () => {
    const bundle = getCase('c3');
    const state = initialState(bundle);
    const before = analyse(bundle, state);
    expect(before.chains.map((chain) => chain.id)).toEqual(['C3-stay', 'C3']);
    const after = analyse(bundle, { ...state, whatIf: { 'q-declared': true } });
    expect(after.chains.find((chain) => chain.id === 'C3-stay')?.status).toBe('holds');
    expect(after.chains.find((chain) => chain.id === 'C3')?.status).toBe('fails');
    expect(before.notices?.join(' ')).toContain('137');
    expect(before.notices?.join(' ')).toContain('existence of the debt');
    const relief = analyse(bundle, { ...state, whatIf: { 'q-listed': true, 'q-knowledge': true } });
    expect(relief.chains.find((chain) => chain.id === 'C3')?.status).not.toBe('fails');
    expect(relief.notices?.join(' ')).toContain('court order');
  });

  it('removes C4 timing bar only, never guarantees transfer or validates clause', () => {
    const bundle = getCase('c4');
    const state = initialState(bundle);
    expect(analyse(bundle, state).chains[0].status).toBe('holds');
    expect(analyse(bundle, { ...state, whatIf: { 'q-merits-first': false } }).chains[0].status).toBe('fails');
    expect(analyse(bundle, { ...state, whatIf: { 'q-clause-void': false } }).chains[0].status).toBe('holds');
    expect(analyse(bundle, state).notices?.join(' ')).toContain('does not validate');
    expect(counterfactuals(bundle, state).find((item) => item.qid === 'q-merits-first')?.effects).toHaveLength(1);
  });

  it('computes C5 procedural deadline independently of substantive limitation toggle', () => {
    const bundle = getCase('c5');
    const state = initialState(bundle);
    const analysis = analyse(bundle, { ...state, art642: false });
    expect(analysis.timeline?.map((event) => event.date)).toEqual(analysis.timeline?.map((event) => event.date).sort());
    expect(analysis.timeline?.find((event) => event.label === 'Raw deadline')?.date).toBe('2025-11-01');
    expect(analysis.timeline?.find((event) => event.label === 'Adjusted deadline')?.date).toBe('2025-11-03');
    expect(analysis.notices?.join(' ')).toContain('17 days');
    expect(analysis.chains[0].status).toBe('contested');
    expect(analyse(bundle, { ...state, whatIf: { 'q-late': true } }).chains[0].status).toBe('fails');
    const force = analyse(bundle, { ...state, whatIf: { 'q-force-majeure': true } });
    expect(force.chains[0].status).toBe('fails');
    expect(force.notices?.join(' ')).toContain('pre-order');
    expect(force.notices?.join(' ')).toContain('cannot undo');
    expect(analysis.notices?.join(' ')).toContain('incidental appeal');
  });
});

describe('CPC 641/642 France procedural calendar', () => {
  it('uses same numbered day then next working day, including holidays and month end', () => {
    expect(proceduralDeadline('2025-08-01', 3)).toEqual({ raw: '2025-11-01', adjusted: '2025-11-03' });
    expect(proceduralDeadline('2025-01-31', 1)).toEqual({ raw: '2025-02-28', adjusted: '2025-02-28' });
    expect(proceduralDeadline('2025-03-01', 2).adjusted).toBe('2025-05-02');
    expect(franceHolidays(2025)).toContain('2025-04-21');
    expect(franceHolidays(2025)).toContain('2025-05-29');
  });
});
