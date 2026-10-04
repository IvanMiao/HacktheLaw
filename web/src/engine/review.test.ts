import { describe, expect, it } from 'vitest';
import { SAMPLE } from '../data/sample';
import { getCase } from '../data/catalog';
import { applyIntent, buildContext } from '../voice/commands';
import { validateCaseContext } from '../voice/contract';
import { translator } from '../i18n/translate';
import { adoptInterpretation, analyse, counterfactuals, initialState, value } from './chains';
import { buildMemo, toMd } from './memo';
import { restoreReviews, reviewStorageKey, serializeReviews } from './reviewStorage';

const review = { note: 'Read with the complete email thread.', nextStep: 'Obtain the payment records.' };

describe('explicit lawyer interpretations on CaseBundle', () => {
  it('adopts either interpretation and recalculates without editing the AI suggestion or source', () => {
    const before = JSON.stringify(SAMPLE);
    const state = adoptInterpretation(SAMPLE, initialState(SAMPLE), 'q-email', true, review);
    expect(state.decisions['q-email']).toBe('confirmed');
    expect(analyse(SAMPLE, state).limitation?.expiry).toBe('2027-06-02');
    expect(analyse(SAMPLE, state).chains[0].status).toBe('fails');
    expect(analyse(SAMPLE, adoptInterpretation(SAMPLE, state, 'q-email', false, review)).limitation?.expiry).toBe('2026-03-16');
    expect(JSON.stringify(SAMPLE)).toBe(before);
  });

  it('uses dynamic qualification IDs from an uploaded bundle', () => {
    const bundle = { ...SAMPLE, id: 'uploaded-case',
      qualifications: SAMPLE.qualifications.map((q) => ({ ...q, id: `uploaded-${q.id}` })),
      facts: SAMPLE.facts.map((fact) => ({ ...fact, qualification: fact.qualification ? `uploaded-${fact.qualification}` : undefined })),
    };
    const state = adoptInterpretation(bundle, initialState(bundle), 'uploaded-q-email', true, review);
    expect(analyse(bundle, state).limitation?.expiry).toBe('2027-06-02');
    expect(adoptInterpretation(bundle, state, 'q-email', false)).toBe(state);
  });

  it('marks affected conclusions pending without adopting the opposite reading', () => {
    const state = initialState(SAMPLE);
    const before = value(SAMPLE, state, 'q-email');
    state.decisions['q-email'] = 'pending';
    expect(value(SAMPLE, state, 'q-email')).toBe(before);
    const result = analyse(SAMPLE, state);
    expect(result.chains.map((chain) => chain.status)).toEqual(['pending', 'pending']);
    expect(result.chains[0].links.find((link) => link.id === 'c1-out')?.status).toBe('not_reached');
    expect(result.chains.map((chain) => chain.links.length)).toEqual([7, 6]);
  });

  it('keeps what-if scenarios separate and flips the currently adopted interpretation', () => {
    const adopted = adoptInterpretation(SAMPLE, initialState(SAMPLE), 'q-email', true, review);
    const alternative = counterfactuals(SAMPLE, adopted).find((item) => item.qid === 'q-email')!;
    expect(alternative.flipsTo).toBe(false);
    expect(alternative.label).toBe('Not an acknowledgment — no effect');
    const preview = { ...adopted, whatIf: { 'q-email': alternative.flipsTo } };
    expect(analyse(SAMPLE, preview).limitation?.expiry).toBe('2026-03-16');
    expect(adoptInterpretation(SAMPLE, preview, 'q-email', false, review)).toBe(preview);
    expect(analyse(SAMPLE, { ...preview, whatIf: {} }).limitation?.expiry).toBe('2027-06-02');
  });

  it('records the saved reading, notes and follow-up in both memo languages, including during a scenario', () => {
    const state = adoptInterpretation(SAMPLE, initialState(SAMPLE), 'q-email', true, review);
    state.whatIf['q-email'] = false;
    for (const locale of ['en', 'fr'] as const) {
      const t = translator(locale);
      const markdown = toMd(SAMPLE, buildMemo(SAMPLE, analyse(SAMPLE, state, t), state, t), t);
      expect(markdown).toContain(review.note);
      expect(markdown).toContain(review.nextStep);
      expect(markdown).toContain(t('Acknowledgment of debt — interrupts'));
      expect(markdown).toContain(t('Temporary scenario — saved interpretations are unchanged.'));
      expect(markdown).toContain(`[${t('Email')}]`);
    }
  });
});

describe('case-scoped review storage', () => {
  it('restores adopted readings and notes, never the scenario or date flags', () => {
    const state = adoptInterpretation(SAMPLE, initialState(SAMPLE), 'q-email', true, review);
    const restored = restoreReviews(SAMPLE, serializeReviews(SAMPLE, { ...state, whatIf: { 'q-email': false }, art642: false }));
    expect(restored.interpretations).toEqual({ 'q-email': true });
    expect(restored.reviews['q-email']).toEqual(review);
    expect(restored.whatIf).toEqual({});
    expect(restored.art642).toBe(true);
    expect(analyse(SAMPLE, restored).limitation?.expiry).toBe('2027-06-02');
  });

  it('does not carry reviews to another case or a regenerated qualification', () => {
    const saved = serializeReviews(SAMPLE, adoptInterpretation(SAMPLE, initialState(SAMPLE), 'q-email', true, review));
    const other = { ...SAMPLE, id: 'another-case' };
    expect(reviewStorageKey(other)).not.toBe(reviewStorageKey(SAMPLE));
    expect(restoreReviews(other, saved)).toEqual(initialState(other));
    const revised = { ...SAMPLE, qualifications: SAMPLE.qualifications.map((q) => ({ ...q, confidence: 'low' as const })) };
    expect(restoreReviews(revised, saved)).toEqual(initialState(revised));
    expect(restoreReviews(SAMPLE, 'broken json')).toEqual(initialState(SAMPLE));
  });

  it('ignores unknown decisions and qualifications in stored data', () => {
    const data = JSON.parse(serializeReviews(SAMPLE, initialState(SAMPLE)));
    data.decisions = { 'q-email': 'invalid', 'unknown': 'confirmed' };
    data.interpretations = { 'q-email': 'true', 'unknown': true };
    const state = restoreReviews(SAMPLE, JSON.stringify(data));
    expect(state.decisions['q-email']).toBe('proposed');
    expect(state.decisions.unknown).toBeUndefined();
    expect(state.interpretations).toEqual({});
  });
});


describe('review compatibility with the additional cases and voice', () => {
  it.each([
    ['c1-c2', 'q-email', 'C1'],
    ['c3', 'q-declared', 'C3'],
    ['c4', 'q-merits-first', 'C4'],
    ['c5', 'q-late', 'C5'],
  ] as const)('preserves full %s chains, reviews and grounded voice previews', (caseId, qid, chainId) => {
    const bundle = getCase(caseId);
    const initial = initialState(bundle);
    const original = value(bundle, initial, qid);
    const adopted = adoptInterpretation(bundle, initial, qid, !original, review);
    const result = analyse(bundle, adopted);
    expect(result.chains.find(chain => chain.id === chainId)?.status).toBe('fails');
    expect(result.chains.map(chain => chain.links.length)).toEqual(analyse(bundle, initial).chains.map(chain => chain.links.length));
    expect(validateCaseContext(buildContext(adopted, bundle)).interpretations?.[qid]).toBe(!original);
    const pending = { ...adopted, decisions: { ...adopted.decisions, [qid]: 'pending' as const } };
    expect(analyse(bundle, pending).chains.find(chain => chain.id === chainId)?.status).toBe('pending');
    expect(value(bundle, pending, qid)).toBe(!original);
    expect(() => validateCaseContext(buildContext(pending, bundle))).not.toThrow();
    const preview = applyIntent(pending, { action: 'preview_scenario', target: qid, value: original, sourceIds: [] }, bundle);
    expect(analyse(bundle, preview).chains.find(chain => chain.id === chainId)?.status).not.toBe('pending');
    expect(preview.interpretations).toEqual(adopted.interpretations);
    expect(preview.reviews).toEqual(adopted.reviews);
    expect(() => validateCaseContext(buildContext(preview, bundle))).not.toThrow();
    const reset = applyIntent(preview, { action: 'reset_scenario', target: null, value: null, sourceIds: [] }, bundle);
    expect(reset).toEqual(pending);
    for (const locale of ['en', 'fr'] as const) {
      const t = translator(locale);
      const markdown = toMd(bundle, buildMemo(bundle, analyse(bundle, preview, t), preview, t), t);
      const q = bundle.qualifications.find(q => q.id === qid)!;
      expect(markdown).toContain(t('To verify — {question}: {answer}.', { question: t(q.question), answer: t(!original ? q.yes : q.no) }));
      expect(markdown).toContain(review.note);
      expect(markdown).toContain(review.nextStep);
    }
    if (caseId === 'c3') expect(analyse(bundle, pending).chains.find(chain => chain.id === 'C3-stay')?.status).toBe('holds');
  });

  it('still rejects forged voice evidence and invalid saved interpretations', () => {
    const bundle = getCase('c3');
    const state = adoptInterpretation(bundle, initialState(bundle), 'q-declared', true, review);
    const context = buildContext(state, bundle);
    expect(() => validateCaseContext({ ...context, interpretations: { unknown: true } })).toThrow();
    expect(() => validateCaseContext({ ...context, interpretations: { 'q-declared': 'true' } })).toThrow();
    expect(() => validateCaseContext({ ...context, interpretations: [] })).toThrow();
    expect(() => validateCaseContext({ ...context, interpretations: { 'q-declared': false } })).toThrow();
    const forged = structuredClone(context);
    forged.chains[0].links[0].statement = 'Forged finding';
    expect(() => validateCaseContext(forged)).toThrow();
  });
});
