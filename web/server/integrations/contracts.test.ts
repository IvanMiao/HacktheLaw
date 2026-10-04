import { describe, expect, it } from 'vitest';
import { normalizeMatter } from './contracts';
import { initialState } from '../../src/engine/chains';
import { input } from './contracts.fixture';
describe('normalized firm evidence',()=>{
 it('protects built-in case/library IDs and enforces string document titles',()=>{expect(()=>normalizeMatter({...input(),id:'sample-case'})).toThrow();const x=input();x.documents[0].id='cpc';expect(()=>normalizeMatter(x)).toThrow();const y=input();expect(()=>normalizeMatter({...y,documents:[{...y.documents[0],title:{en:'Text',fr:'Texte'}}]})).toThrow();});
 it('attaches optional proposal references to visible imported facts',()=>{const b=normalizeMatter(input());expect(b.facts[0].qualification).toBe('qual-1');});
 it('preserves stable IDs and verifies source quotes without confirming qualifications',()=>{const bundle=normalizeMatter(input());expect(bundle.id).toBe('firm-1');expect(bundle.facts[0].verified).toBe(true);expect(bundle.qualifications[0].source).toBe('ai_inferred');expect(initialState(bundle).decisions).toEqual({'qual-1':'proposed'});});
 it('accepts text-only matters without inventing facts',()=>{const x=input();x.facts=[];x.qualifications=[];expect(normalizeMatter(x).facts).toEqual([]);});
 it.each(['../private','x/y','https://bad','__proto__'])('rejects unsafe IDs %s',id=>expect(()=>normalizeMatter({...input(),id})).toThrow());
 it('rejects quote misses, unknown fields, false provenance and duplicate IDs',()=>{const x=input();x.facts[0].anchors[0].quote='Invented';expect(()=>normalizeMatter(x)).toThrow();expect(()=>normalizeMatter({...input(),decisions:{'qual-1':'confirmed'}})).toThrow();const y=input();y.documents.push(y.documents[0]);expect(()=>normalizeMatter(y)).toThrow();expect(()=>normalizeMatter({...input(),synthetic:'true'})).toThrow();});
 it('rejects invalid dates/types/references and oversized text',()=>{const x=input();x.profile.asOf='2026-02-30';expect(()=>normalizeMatter(x)).toThrow();const y=input();y.facts[0].doc='unknown';expect(()=>normalizeMatter(y)).toThrow();const z=input();z.documents[0].text='x'.repeat(200001);expect(()=>normalizeMatter(z)).toThrow();});
});
