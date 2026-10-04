import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_DATA } from '../src/data/sampleData.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export async function createFixture(path=resolve(ROOT,'web/.verification/firm-demo.sqlite')) {
  await mkdir(dirname(path),{recursive:true});await rm(path,{force:true});const db=new DatabaseSync(path);
  try {
    db.exec(await readFile(resolve(ROOT,'data/firm-demo/schema.sql'),'utf8'));
    const facts=SAMPLE_DATA.facts.map(({verified:_verified,anchors,...f})=>({...f,anchors:anchors.map(({doc,quote})=>({doc,quote}))}));
    const qualifications=SAMPLE_DATA.qualifications.map(({source:_source,confidence:_confidence,model:_model,fallback:_fallback,anchors:_anchors,...q})=>q);
    db.prepare('INSERT INTO matters VALUES (?, ?, ?, ?)').run('demo-c1-c2','SYNTHETIC · Atelier Lumière v. Bâtiself',1,JSON.stringify({profile:SAMPLE_DATA.profile,facts,qualifications}));
    const manifest=JSON.parse(await readFile(resolve(ROOT,'data/sample-case/manifest.json'),'utf8')) as {id:string;title:string;short:string;date:string;file:string}[];
    const types:Record<string,string>={contract:'contract',invoice:'invoice',email:'correspondence',notice:'formal_notice',writ1:'writ',registry:'registry_record',order:'court_order',writ2:'writ',pieces:'exhibits_list'};
    const insert=db.prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?)');
    for(const d of manifest)insert.run('demo-c1-c2',d.id,d.title,d.short,d.date,types[d.id]??'other',await readFile(resolve(ROOT,'data',d.file),'utf8'));
  }finally{db.close();}
  return path;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Synthetic SQLite demo fixture created:',await createFixture());
