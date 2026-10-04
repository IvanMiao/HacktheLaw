import { expect, it } from 'vitest';
import { PRESETS } from '../data/catalog';
import { analyse, initialState } from '../engine/chains';
import { translator } from './translate';

it('translates every new fact, qualification, chain, legal caveat and timeline label', () => {
  const fr = translator('fr');
  for (const bundle of PRESETS) {
    for (const text of [bundle.profile.side, bundle.profile.summary, ...bundle.facts.flatMap((fact) => [fact.kind, fact.summary]),
      ...bundle.qualifications.flatMap((qualification) => [qualification.question, qualification.yes, qualification.no, qualification.reasoning, qualification.whatIfLabel])]) {
      expect(text).toBeDefined();
      if (text === undefined) throw new Error('Preset translation text is missing.');
      expect(fr(text), JSON.stringify(text)).not.toBe(text);
    }
    const state = initialState(bundle);
    const en = analyse(bundle, state); const translated = analyse(bundle, state, fr);
    for (let i=0;i<en.chains.length;i++) {
      expect(translated.chains[i].title).not.toBe(en.chains[i].title);
      expect(translated.chains[i].subtitle).not.toBe(en.chains[i].subtitle);
      for (let j=0;j<en.chains[i].links.length;j++) expect(translated.chains[i].links[j].statement,en.chains[i].links[j].statement).not.toBe(en.chains[i].links[j].statement);
    }
    for (let i=0;i<en.notices!.length;i++) expect(translated.notices![i],en.notices![i]).not.toBe(en.notices![i]);
    for (const ev of en.timeline ?? []) expect(fr(ev.label),ev.label).not.toBe(ev.label);
  }
});
