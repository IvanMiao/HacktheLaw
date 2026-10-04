import { expect, it } from 'vitest';
import { CASE_CATALOG } from '../data/catalog';
import { analyse, initialState } from '../engine/chains';
import { translator } from './translate';

it('translates every new fact, qualification, chain, legal caveat and timeline label', () => {
  const fr = translator('fr');
  for (const c of CASE_CATALOG.slice(1)) {
    for (const text of [c.meta.side,c.meta.relationship,...c.facts.flatMap(f => [f.kind,f.summary]),...c.qualifications.flatMap(q => [q.question,q.yes,q.no,q.reasoning,q.whatIfLabel])]) expect(fr(text),text).not.toBe(text);
    const state = initialState(c);
    const en = analyse(state,undefined,c); const translated = analyse(state,fr,c);
    for (let i=0;i<en.chains.length;i++) {
      expect(translated.chains[i].title).not.toBe(en.chains[i].title);
      expect(translated.chains[i].subtitle).not.toBe(en.chains[i].subtitle);
      for (let j=0;j<en.chains[i].links.length;j++) expect(translated.chains[i].links[j].statement,en.chains[i].links[j].statement).not.toBe(en.chains[i].links[j].statement);
    }
    for (let i=0;i<en.notices!.length;i++) expect(translated.notices![i],en.notices![i]).not.toBe(en.notices![i]);
    for (const ev of en.timeline!) expect(fr(ev.label),ev.label).not.toBe(ev.label);
  }
});
