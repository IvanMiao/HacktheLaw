import { describe, expect, it } from 'vitest';
import { initialLocale, translator } from './translate';
import { FACTS, QUALIFICATIONS } from '../data/case';
import { DOCS } from '../data/documents';
import { analyse, counterfactuals, initialState } from '../engine/chains';
import { buildMemo, toMd } from '../engine/memo';
import { REVIEW_LABELS } from '../data/review';

const en = translator('en');
const fr = translator('fr');

describe('language selection', () => {
  it('honours language links before saved preferences and safely defaults to English', () => {
    expect(initialLocale('?mode=chains&lang=fr', 'en')).toBe('fr');
    expect(initialLocale('?lang=en', 'fr')).toBe('en');
    expect(initialLocale('', 'fr')).toBe('fr');
    expect(initialLocale('?lang=invalid', null)).toBe('en');
  });
});

describe('bilingual analysis', () => {
  it('preserves every scenario result, date and citation across languages', () => {
    for (let scenario = 0; scenario < 32; scenario++) {
      for (const art642 of [false, true]) {
        const state = { ...initialState(), art642, whatIf: Object.fromEntries(QUALIFICATIONS.map((q, i) => [q.id, Boolean(scenario & (1 << i))])) };
        const before = JSON.stringify(state);
        const english = analyse(state, en);
        const french = analyse(state, fr);
        const semantics = (a: typeof english) => ({
          chains: a.chains.map((c) => ({ id: c.id, status: c.status, hingesOn: c.hingesOn, links: c.links.map((l) => ({ id: l.id, status: l.status, anchors: l.anchors, deps: l.deps })) })),
          expiry: a.limitation.expiry, periodStart: a.limitation.periodStart,
          steps: a.limitation.steps.map((s) => ({ date: s.date, effect: s.effect, periodStart: s.periodStart })),
        });
        expect(semantics(french)).toEqual(semantics(english));
        expect(JSON.stringify(state)).toBe(before);
        const markdown = toMd(buildMemo(french, state, fr), fr);
        expect(markdown).toContain('Note en défense');
        expect(markdown).not.toMatch(/\{\w+\}|undefined|Defence memo|Weak link|Ground [AB]|Serve written/);
      }
    }
  });

  it('translates fact reviews, source labels and counterfactuals', () => {
    for (const text of FACTS.flatMap((f) => [f.kind, f.summary]).concat(QUALIFICATIONS.flatMap((q) => [q.question, q.yes, q.no, q.reasoning, q.whatIfLabel]))) {
      expect(fr(text), text).not.toBe(text);
    }
    expect(counterfactuals(initialState(), fr).map((c) => c.label)).toEqual(QUALIFICATIONS.map((q) => fr(q.whatIfLabel)));
    expect(fr('Next hearing {date} · in {days} days', { date: '20 oct. 2026', days: 16 })).toBe('Prochaine audience le 20 oct. 2026 · dans 16 jours');
    expect(toMd(buildMemo(analyse(initialState(), fr), initialState(), fr), fr)).toContain('[Facture]');
    expect(DOCS.find((d) => d.id === 'email')?.text).toContain('Nous allons étudier votre facture et revenons vers vous.');
  });

  it('translates support statuses and the actions that follow each review', () => {
    expect(Object.fromEntries(Object.entries(REVIEW_LABELS).map(([status, label]) => [status, fr(label)]))).toEqual({
      unreviewed: 'Non examiné', supported: 'Étayé', unsupported: 'Non étayé', insufficient: 'Insuffisant',
    });
    for (const text of [
      'Does the evidence support this assessment?',
      'This assessment is not supported. Its opposite is not assumed.',
      'Review affected argument', 'Open review memo', 'Record correction', 'Draft evidence request',
      'Correction and supporting source', 'Review notes and evidence', 'Next step / evidence request draft',
      'Hypothetical preview — your saved review is unchanged.',
      'The analysis remains unresolved. Record the missing evidence and the next step.',
    ]) expect(fr(text), text).not.toBe(text);
    expect(fr('This assessment is not supported. Its opposite is not assumed.')).toContain('inverse n’est pas présumée');
    expect(fr(QUALIFICATIONS.find((q) => q.id === 'q-concil')!.reasoning)).toContain('ne suffit pas à établir');
  });

  it('localizes review outcomes and preserves lawyer notes and follow-up verbatim', () => {
    const state = initialState();
    state.decisions = Object.fromEntries(QUALIFICATIONS.map((q) => [q.id, 'supported']));
    state.reviews['q-email'] = { note: 'Examiner la page 2 du courriel.', nextStep: 'Obtenir le fil complet.' };
    for (const decision of ['supported', 'unsupported', 'insufficient', 'unreviewed'] as const) {
      state.decisions['q-email'] = decision;
      const markdown = toMd(buildMemo(analyse(state, fr), state, fr), fr);
      expect(markdown).toContain('2. Résultats de l’examen');
      expect(markdown).toContain('4. Examens de l’avocat enregistrés et suivi');
      expect(markdown).toContain('Observation : Examiner la page 2 du courriel.');
      expect(markdown).toContain('Prochaine action : Obtenir le fil complet.');
      expect(markdown).not.toMatch(/Supported|Unsupported|Insufficient|Unreviewed|Pending review|Review outcomes|Next action|Proposed reading/);
    }
    state.whatIf['q-email'] = true;
    const hypothetical = toMd(buildMemo(analyse(state, fr), state, fr), fr);
    expect(hypothetical).toContain('Aperçu hypothétique');
    expect(hypothetical).toContain('Hypothèse du scénario');
    expect(hypothetical).not.toMatch(/Hypothetical preview|Scenario assumption|Return to the saved analysis/);
  });

  it('keeps restart dates structured for the translated timeline', () => {
    const state = { ...initialState(), whatIf: { 'q-writ1': false } };
    const restart = analyse(state, fr).limitation.steps.find((s) => s.effect === 'restart');
    expect(restart?.periodStart).toBe('2026-02-20');
    expect(restart?.text).toContain('nouveau délai');
    expect(analyse(state, fr).limitation.expiry).toBe('2031-02-20');
  });
});
