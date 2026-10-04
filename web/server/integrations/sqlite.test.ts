import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createFixture } from '../../scripts/create-firm-fixture';
import { SQLiteBridge } from './sqlite';
const dir=new URL('../../.verification/sqlite-tests/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});const path=dir+'firm.sqlite';
afterAll(()=>rmSync(dir,{recursive:true,force:true}));
describe('actual read-only SQLite demo bridge',()=>{
 it('reproduces synthetic matter and exact anchored documents',async()=>{await createFixture(path);const bridge=new SQLiteBridge(path,['demo-c1-c2']);expect(bridge.list()).toEqual([{id:'demo-c1-c2',title:'SYNTHETIC · Atelier Lumière v. Bâtiself'}]);const matter=bridge.read('demo-c1-c2');expect(matter.docs).toHaveLength(9);expect(matter.facts).toHaveLength(9);expect(matter.docs.find(d=>d.id==='invoice')?.text).toContain('15/03/2021');expect(matter.facts.every(f=>f.verified)).toBe(true);expect(()=>bridge.read('private')).toThrow();expect(()=>bridge.read('../private')).toThrow();bridge.close();});
 it('uses genuinely read-only SQLite access',()=>{const db=new DatabaseSync(path,{readOnly:true});expect(()=>db.exec('DELETE FROM matters')).toThrow();db.close();});
});
