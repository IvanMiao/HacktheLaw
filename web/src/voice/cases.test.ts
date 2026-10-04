import { describe, expect, it } from 'vitest';
import { getCase, CASE_CATALOG } from '../data/catalog';
import { initialState } from '../engine/chains';
import { buildContext, applyIntent, describeIntent } from './commands';
import { intentSchemaFor, validateIntent, validateCaseContext } from './contract';

describe('case-scoped command boundary', () => {
  it('requires citation-free reset mode and unsupported schema outputs', () => {
    const schema = intentSchemaFor({ caseId: 'c5' });
    for (const action of ['reset_scenario', 'show_mode', 'unsupported']) {
      const branch = schema.anyOf.find((item) => item.properties.action.enum[0] === action)!;
      expect(branch.properties.sourceIds).toMatchObject({ maxItems: 0 });
    }
  });

  it('constrains provider preview citations to the selected qualification evidence', () => {
    const schema = intentSchemaFor({ caseId: 'c3' });
    const preview = schema.anyOf.find((branch) => branch.properties.action.enum[0] === 'preview_scenario'
      && branch.properties.target.enum?.includes('q-declared'))!;
    expect(preview.properties.target.enum).toEqual(['q-declared']);
    expect(preview.properties.sourceIds.items.enum).toEqual(['c3-register']);
  });

  it.each(['c3', 'c4', 'c5'])('routes %s hypotheses and evidence against only its known bundle', (id) => {
    const bundle = getCase(id);
    const state = initialState(bundle);
    const context = buildContext(state, bundle);
    expect(context.caseId).toBe(id);
    const qualification = bundle.qualifications[0];
    const doc = bundle.facts.find((fact) => fact.qualification === qualification.id)!.doc;
    const intent = { action: 'preview_scenario' as const, target: qualification.id, value: !qualification.proposed, sourceIds: [doc] };
    expect(validateIntent(intent, context)).toEqual(intent);
    const next = applyIntent(state, intent, bundle);
    expect(next.whatIf[qualification.id]).toBe(!qualification.proposed);
    expect(next.decisions).toEqual(state.decisions);
    expect(describeIntent(next, intent, bundle)).toContain(qualification.id);
    expect(JSON.stringify(intentSchemaFor(context))).toContain(qualification.id);
    expect(JSON.stringify(intentSchemaFor(context))).not.toContain('q-email');
    expect(() => validateIntent({ ...intent, target: 'q-email', sourceIds: ['email'] }, context)).toThrow();
    expect(() => validateIntent({ ...intent, sourceIds: [bundle.docs.find((item) => item.id !== doc)!.id] }, context)).toThrow();
    expect(validateCaseContext(context).caseId).toBe(id);
    expect(() => validateCaseContext({ ...context, caseId: 'c1-c2' })).toThrow();
  });

  it('rejects forged source content, quotes, statuses and cross-case legal IDs on server context', () => {
    for (const bundle of CASE_CATALOG) {
      const context = buildContext(initialState(bundle), bundle);
      const forged = structuredClone(context);
      forged.sources[0].title = 'Forged';
      expect(() => validateCaseContext(forged)).toThrow();
      const anchor = structuredClone(context);
      anchor.chains[0].links[0].anchors[0].quote = 'Invented';
      expect(() => validateCaseContext(anchor)).toThrow();
      const status = structuredClone(context);
      status.chains[0].links[0].status = 'broken';
      expect(() => validateCaseContext(status)).toThrow();
    }
  });

  it('explicit case identity mismatch rejects even generic navigation or reset', () => {
    const bundle = getCase('c3');
    const state = initialState(bundle);
    const intent = { action: 'reset_scenario' as const, target: null, value: null, sourceIds: [] };
    expect(() => applyIntent(state, intent, bundle, 'c4')).toThrow();
  });
});
