import { describe, expect, it } from 'vitest';
import { locate, normalise } from './anchor';

describe('quote anchoring', () => {
  it('normalizes curly and straight apostrophes while returning original offsets', () => {
    const text = 'L’an deux mille vingt-six et le douze janvier.';
    const quote = "L'an deux mille vingt-six et le douze janvier.";
    const match = locate(text, quote);

    expect(match).toEqual({ start: 0, end: text.length });
    expect(text.slice(match!.start, match!.end)).toBe('L’an deux mille vingt-six et le douze janvier.');
  });

  it('collapses whitespace and newlines', () => {
    const text = 'La copie de l’assignation\n   remise au greffe le 16 février 2026';
    const match = locate(text, "La copie de l'assignation remise au greffe le 16 février 2026");

    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe(text);
  });

  it('normalizes guillemets', () => {
    const text = 'Le débiteur écrit : « Nous allons étudier votre facture et revenons vers vous. »';
    const match = locate(text, '"Nous allons étudier votre facture et revenons vers vous."');

    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe('« Nous allons étudier votre facture et revenons vers vous. »');
  });

  it('strips leading and trailing punctuation when matching', () => {
    const text = 'The documented event occurred on 12 January 2026.';
    const match = locate(text, '“The documented event occurred on 12 January 2026.”');

    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe(text);
  });

  it('matches ellipsis-separated parts in order and returns the first span', () => {
    const text = 'Le contrat dispose que toute contestation sera soumise à une tentative de conciliation préalable.';
    const quote = 'toute contestation … tentative de conciliation préalable';
    const match = locate(text, quote);

    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe('toute contestation');
  });

  it('matches case-insensitively and applies NFKC', () => {
    expect(normalise('ＡRT. 14 — CLAUSE')).toBe('art. 14 — clause');
    const text = 'La lettre recommandée est remise au greffe le 16 février 2026.';
    const match = locate(text, 'LA LETTRE RECOMMANDÉE EST REMISE AU GREFFE LE 16 FÉVRIER 2026.');
    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe(text);
  });

  it('rejects quotes shorter than twelve normalized characters', () => {
    expect(locate('Date de remise au greffe : 16/02/2026', '16/02/2026')).toBeNull();
  });

  it('rejects quotes that do not occur in the document', () => {
    expect(locate('Aucune remise au greffe n’est mentionnée.', 'Copie remise au greffe le 16 février 2026')).toBeNull();
  });
});
