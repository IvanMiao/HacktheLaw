import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cass2003, cass2014 } from '../src/data/caseLawTexts';

it('keeps embedded original real case-law text equal to team Markdown sources', () => {
  for (const [file,text] of [
    ['Cour de cassation chambre mixte 14 fevrier 2003 - n00-19423.md',cass2003],
    ['Cour de cassation chambre mixte 12 decembre 2014 - n13-19684.md',cass2014],
  ]) expect(text.trimEnd()).toBe(readFileSync(new URL(`../../data/caselaw/${file}`,import.meta.url),'utf8').trimEnd());
});
