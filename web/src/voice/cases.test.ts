import { describe, expect, it } from 'vitest';
import { getCase, CASE_CATALOG } from '../data/catalog';
import { initialState } from '../engine/chains';
import { buildContext, applyIntent, describeIntent } from './commands';
import { intentSchemaFor, validateIntent, validateCaseContext } from './contract';

describe('case-scoped command boundary', () => {
  it.each(['c3','c4','c5'])('routes %s hypotheses and evidence against only its known dataset', id => {
    const c = getCase(id); const s = initialState(c); const context = buildContext(s,c);
    expect(context.caseId).toBe(id);
    const q = c.qualifications[0]; const doc = c.facts.find(f => f.qualification === q.id)!.doc;
    const intent = {action:'preview_scenario' as const,target:q.id,value:!q.proposed,sourceIds:[doc]};
    expect(validateIntent(intent,context)).toEqual(intent);
    const next = applyIntent(s,intent,c);
    expect(next.whatIf[q.id]).toBe(!q.proposed);
    expect(next.decisions).toEqual(s.decisions);
    expect(describeIntent(next,intent,c)).toContain(q.id);
    expect(JSON.stringify(intentSchemaFor(context))).toContain(q.id);
    expect(JSON.stringify(intentSchemaFor(context))).not.toContain('q-email');
    expect(() => validateIntent({...intent,target:'q-email',sourceIds:['email']},context)).toThrow();
    expect(() => validateIntent({...intent,sourceIds:[c.docs.find(d => d.id !== doc)!.id]},context)).toThrow();
    expect(validateCaseContext(context).caseId).toBe(id);
    expect(() => validateCaseContext({...context,caseId:'c1-c2'})).toThrow();
  });
  it('rejects forged source content, quotes, statuses and cross-case legal IDs on server context', () => {
    for (const c of CASE_CATALOG) {
      const context = buildContext(initialState(c),c);
      const forged = structuredClone(context); forged.sources[0].title = 'Forged';
      expect(() => validateCaseContext(forged)).toThrow();
      const anchor = structuredClone(context); anchor.chains[0].links[0].anchors[0].quote = 'Invented';
      expect(() => validateCaseContext(anchor)).toThrow();
      const status = structuredClone(context); status.chains[0].links[0].status = 'broken';
      expect(() => validateCaseContext(status)).toThrow();
    }
  });
  it('explicit case identity mismatch rejects even generic navigation or reset', () => {
    const c = getCase('c3'); const s = initialState(c);
    const intent = {action:'reset_scenario' as const,target:null,value:null,sourceIds:[]};
    expect(() => applyIntent(s,intent,c,'c4')).toThrow();
  });
});
