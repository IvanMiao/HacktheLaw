import { describe, expect, it } from 'vitest';
import { SAMPLE } from '../data/sample';
import { translator } from '../i18n/translate';
import { analyse, initialState } from './chains';
import { buildMemo } from './memo';

function summary(bundle = SAMPLE, locale: 'en' | 'fr' = 'en') {
  const state = initialState(bundle);
  const block = buildMemo(bundle, analyse(bundle, state), state, translator(locale))
    .find((item) => item.t === 'p');
  return String(block?.parts[0] ?? '');
}

describe('memo represented-party wording', () => {
  it('renders the role and party name in English and French', () => {
    expect(summary()).toContain('We act for the defendant, Bâtiself SARL');
    expect(summary(SAMPLE, 'fr')).toContain('Nous intervenons pour le défendeur, Bâtiself SARL');
  });

  it('falls back to the raw side string when it is not a role/name pair', () => {
    const bundle = { ...SAMPLE, profile: { ...SAMPLE.profile, side: 'Represented party' } };
    expect(summary(bundle)).toContain('We act for Represented party');
  });
});
