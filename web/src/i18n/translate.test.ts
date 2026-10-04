import { describe, expect, it } from 'vitest';
import { initialLocale, translator } from './translate';
import { FACTS, QUALIFICATIONS } from '../data/case';
import { DOCS } from '../data/documents';
import { analyse, counterfactuals, initialState } from '../engine/chains';
import { buildMemo, toMd } from '../engine/memo';

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

  it('keeps restart dates structured for the translated timeline', () => {
    const state = { ...initialState(), whatIf: { 'q-writ1': false } };
    const restart = analyse(state, fr).limitation.steps.find((s) => s.effect === 'restart');
    expect(restart?.periodStart).toBe('2026-02-20');
    expect(restart?.text).toContain('nouveau délai');
    expect(analyse(state, fr).limitation.expiry).toBe('2031-02-20');
  });
});
