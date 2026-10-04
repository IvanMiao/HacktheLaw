import { describe, expect, it } from 'vitest';
import { CASE_CATALOG, getCase } from './catalog';
import { analyse, initialState, counterfactuals } from '../engine/chains';
import { buildMemo, toMd } from '../engine/memo';
import { proceduralDeadline, franceHolidays } from '../engine/proceduralDates';

describe('isolated synthetic case catalog', () => {
  it('retains original and embeds all three additional samples with resolvable anchors', () => {
    expect(CASE_CATALOG.map(c => c.id)).toEqual(['c1-c2', 'c3', 'c4', 'c5']);
    for (const c of CASE_CATALOG) {
      const state = initialState(c);
      expect(Object.keys(state.decisions)).toEqual(c.qualifications.map(q => q.id));
      expect(c.facts.length).toBeGreaterThan(4);
      const a = analyse(state, undefined, c);
      for (const anchor of [...c.facts.flatMap(f => f.anchors), ...a.chains.flatMap(x => x.links.flatMap(l => l.anchors))]) {
        expect(c.docs.find(d => d.id === anchor.doc)?.text).toContain(anchor.quote);
      }
      const memo = toMd(buildMemo(a, state, undefined, c), undefined, c);
      expect(memo).toContain(c.meta.title);
      if (c.id !== 'c1-c2') { expect(memo).not.toContain('Bâtiself'); expect(memo).toContain('SYNTHETIC'); }
    }
    expect(() => getCase('unknown')).toThrow();
  });
  it('keeps payment stay independently when C3 timely declaration removes forclusion', () => {
    const c = getCase('c3'); const s = initialState(c);
    const before = analyse(s, undefined, c);
    expect(before.chains.map(x => x.id)).toEqual(['C3-stay', 'C3']);
    const after = analyse({...s, whatIf:{'q-declared':true}}, undefined, c);
    expect(after.chains.find(x => x.id === 'C3-stay')?.status).toBe('holds');
    expect(after.chains.find(x => x.id === 'C3')?.status).toBe('fails');
    expect(before.notices?.join(' ')).toContain('137');
    expect(before.notices?.join(' ')).toContain('existence of the debt');
    const relief = analyse({...s, whatIf:{'q-listed':true,'q-knowledge':true}}, undefined, c);
    expect(relief.chains.find(x => x.id === 'C3')?.status).not.toBe('fails');
    expect(relief.notices?.join(' ')).toContain('court order');
  });
  it('removes C4 timing bar only, never guarantees transfer or validates clause', () => {
    const c = getCase('c4'); const s = initialState(c);
    expect(analyse(s, undefined, c).chains[0].status).toBe('holds');
    expect(analyse({...s, whatIf:{'q-merits-first':false}}, undefined, c).chains[0].status).toBe('fails');
    expect(analyse({...s, whatIf:{'q-clause-void':false}}, undefined, c).chains[0].status).toBe('holds');
    expect(analyse(s, undefined, c).notices?.join(' ')).toContain('does not validate');
    expect(counterfactuals(s, undefined, c).find(x => x.qid === 'q-merits-first')?.effects).toHaveLength(1);
  });
  it('computes C5 procedural deadline independently of substantive limitation toggle', () => {
    const c = getCase('c5'); const s = initialState(c);
    const a = analyse({...s, art642:false}, undefined, c);
    expect(a.timeline?.map(x => x.date)).toEqual(a.timeline?.map(x => x.date).sort());
    expect(a.timeline?.find(x => x.label === 'Raw deadline')?.date).toBe('2025-11-01');
    expect(a.timeline?.find(x => x.label === 'Adjusted deadline')?.date).toBe('2025-11-03');
    expect(a.notices?.join(' ')).toContain('17 days');
    expect(a.chains[0].status).toBe('contested');
    expect(analyse({...s, whatIf:{'q-late':true}}, undefined, c).chains[0].status).toBe('fails');
    const force = analyse({...s, whatIf:{'q-force-majeure':true}}, undefined, c);
    expect(force.chains[0].status).toBe('fails');
    expect(force.notices?.join(' ')).toContain('pre-order');
    expect(force.notices?.join(' ')).toContain('cannot undo');
    expect(a.notices?.join(' ')).toContain('incidental appeal');
  });
});
describe('CPC 641/642 France procedural calendar', () => {
  it('uses same numbered day then next working day, including holidays and month end', () => {
    expect(proceduralDeadline('2025-08-01',3)).toEqual({raw:'2025-11-01', adjusted:'2025-11-03'});
    expect(proceduralDeadline('2025-01-31',1)).toEqual({raw:'2025-02-28', adjusted:'2025-02-28'});
    expect(proceduralDeadline('2025-03-01',2).adjusted).toBe('2025-05-02');
    expect(franceHolidays(2025)).toContain('2025-04-21');
    expect(franceHolidays(2025)).toContain('2025-05-29');
  });
});
