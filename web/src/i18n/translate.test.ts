import { describe, expect, it } from 'vitest';
import { initialLocale, translator } from './translate';
import { SAMPLE } from '../data/sample';
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

describe('AI controls and provenance translations', () => {
  it('translates sample actions, model attribution and cached fallback copy', () => {
    expect(fr('Analyse sample case with AI')).toBe('Analyser le dossier exemple avec l’IA');
    expect(fr('Fresh run (calls the model)')).toBe('Nouvelle analyse (appelle le modèle)');
    expect(fr('Open hand-checked reference')).toBe('Ouvrir la référence vérifiée manuellement');
    expect(fr('AI · {provider} {model} · {status}', {
      provider: 'openai', model: 'gpt-6.1-sol', status: fr('cached'),
    })).toBe('IA · openai gpt-6.1-sol · en cache');
    expect(fr('Live analysis unavailable ({message}) — showing the recorded AI analysis from {date}.', {
      message: 'missing API key', date: '4 oct. 2026',
    })).toBe('Analyse en direct indisponible (missing API key) — affichage de l’analyse IA enregistrée le 4 oct. 2026.');
    expect(fr('Extracted by {model}', { model: 'gpt-6.1-sol' })).toBe('Extrait par gpt-6.1-sol');
    expect(fr('Proposed by {model} · {confidence} confidence', {
      model: 'gpt-6.1-sol', confidence: fr('medium'),
    })).toBe('Proposée par gpt-6.1-sol · confiance moyenne');
  });
});

describe('bilingual analysis', () => {
  it('preserves every scenario result, date and citation across languages', () => {
    for (let scenario = 0; scenario < 32; scenario++) {
      for (const art642 of [false, true]) {
        const state = { ...initialState(SAMPLE), art642, whatIf: Object.fromEntries(SAMPLE.qualifications.map((q, i) => [q.id, Boolean(scenario & (1 << i))])) };
        const before = JSON.stringify(state);
        const english = analyse(SAMPLE, state, en);
        const french = analyse(SAMPLE, state, fr);
        const semantics = (a: typeof english) => ({
          chains: a.chains.map((c) => ({ id: c.id, status: c.status, hingesOn: c.hingesOn, links: c.links.map((l) => ({ id: l.id, status: l.status, anchors: l.anchors, deps: l.deps })) })),
          expiry: a.limitation?.expiry, periodStart: a.limitation?.periodStart,
          steps: a.limitation?.steps.map((s) => ({ date: s.date, effect: s.effect, periodStart: s.periodStart })),
        });
        expect(semantics(french)).toEqual(semantics(english));
        expect(JSON.stringify(state)).toBe(before);
        const markdown = toMd(SAMPLE, buildMemo(SAMPLE, french, state, fr), fr);
        expect(markdown).toContain('Note en défense');
        expect(markdown).not.toMatch(/\{\w+\}|undefined|Defence memo|Weak link|Ground [AB]|Serve written/);
      }
    }
  });

  it('translates fact reviews, source labels and counterfactuals', () => {
    for (const text of SAMPLE.facts.flatMap((f) => [f.kind, f.summary]).concat(SAMPLE.qualifications.flatMap((q) => [q.question, q.yes, q.no, q.reasoning, q.whatIfLabel]))) {
      expect(fr(text), String(text)).not.toBe(text);
    }
    expect(counterfactuals(SAMPLE, initialState(SAMPLE), fr).map((c) => c.label)).toEqual(SAMPLE.qualifications.map((q) => fr(q.whatIfLabel)));
    expect(fr('Next hearing {date} · in {days} days', { date: '20 oct. 2026', days: 16 })).toBe('Prochaine audience le 20 oct. 2026 · dans 16 jours');
    expect(toMd(SAMPLE, buildMemo(SAMPLE, analyse(SAMPLE, initialState(SAMPLE), fr), initialState(SAMPLE), fr), fr)).toContain('[Facture]');
    expect(SAMPLE.docs.find((d) => d.id === 'email')?.text).toContain('Nous allons étudier votre facture et revenons vers vous.');
  });

  it('keeps restart dates structured for the translated timeline', () => {
    const state = { ...initialState(SAMPLE), whatIf: { 'q-writ1': false } };
    const restart = analyse(SAMPLE, state, fr).limitation?.steps.find((s) => s.effect === 'restart');
    expect(restart?.periodStart).toBe('2026-02-20');
    expect(restart?.text).toContain('nouveau délai');
    expect(analyse(SAMPLE, state, fr).limitation?.expiry).toBe('2031-02-20');
  });
});
