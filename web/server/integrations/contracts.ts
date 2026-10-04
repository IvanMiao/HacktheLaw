import type { CaseBundle, CaseProfile, Fact, Qualification, Text } from '../../src/data/bundle.js';
import type { Doc } from '../../src/data/documents.js';
import { locate } from '../anchor.js';

export class IntegrationError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
export function validId(value: unknown): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value) || ['__proto__','prototype','constructor'].includes(value)) throw new IntegrationError(400, 'Invalid identifier.');
  return value;
}
type ObjectValue = Record<string, unknown>;
function object(value: unknown, allowed: string[]): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new IntegrationError(400, 'Invalid fields.');
  return value as ObjectValue;
}
function text(value: unknown, max = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\u0000')) throw new IntegrationError(400, 'Invalid text or size.');
  return value;
}
function translated(value: unknown): Text {
  if (typeof value === 'string') return text(value);
  const x = object(value, ['en','fr']); return { en:text(x.en), fr:text(x.fr) };
}
function date(value: unknown): string {
  const x = text(value, 10); const parsed = new Date(`${x}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== x) throw new IntegrationError(400, 'Invalid date.');
  return x;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new IntegrationError(400, 'Invalid category.'); return value as T;
}
function array(value: unknown, max: number, required = false): unknown[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > max || (required && !value.length)) throw new IntegrationError(400, 'Invalid collection size.'); return value;
}
function unique(items: {id:string}[]) {
  if (new Set(items.map(x=>x.id)).size !== items.length) throw new IntegrationError(400, 'Duplicate identifier.');
}
export function normalizeMatter(value: unknown): CaseBundle {
  const x = object(value, ['id','synthetic','profile','documents','facts','qualifications']);
  if (['sample-case','c1-c2','c3','c4','c5'].includes(validId(x.id))) throw new IntegrationError(400, 'Built-in case identifier is reserved.');
  if (typeof x.synthetic !== 'boolean') throw new IntegrationError(400, 'Declare synthetic true or false.');
  const p = object(x.profile, ['title','court','courtType','claimant','defendant','side','relationship','asOf','amount','nextHearing','summary']);
  const profile: CaseProfile = {
    title:translated(p.title), court:text(p.court), courtType:choice(p.courtType,['tribunal_commerce','tribunal_judiciaire','other']),
    claimant:text(p.claimant), defendant:text(p.defendant), side:translated(p.side), relationship:choice(p.relationship,['commercial','civil','consumer']), asOf:date(p.asOf),
    ...(p.amount !== undefined ? {amount:text(p.amount,200)} : {}), ...(p.nextHearing !== undefined ? {nextHearing:date(p.nextHearing)} : {}), ...(p.summary !== undefined ? {summary:translated(p.summary)} : {}),
  };
  const docs: Doc[] = array(x.documents,30,true).map(value=>{
    const d=object(value,['id','title','short','text','date','docType']);
    return {id:validId(d.id),title:text(d.title),short:text(d.short,120),text:text(d.text,200000),group:'case',provenance:x.synthetic?'mock':'uploaded',format:'text',...(d.date!==undefined?{date:date(d.date)}:{}),...(d.docType!==undefined?{docType:choice(d.docType,['contract','invoice','correspondence','formal_notice','writ','registry_record','court_order','exhibits_list','pleading','judgment','other'])}:{}),note:x.synthetic?'Synthetic demo bridge — source annotations require lawyer review.':'Imported source annotations require lawyer review.'};
  });
  unique(docs);
  if (docs.some(d => ['cpc','civ','cass2003','cass2014','cassC1'].includes(d.id))) throw new IntegrationError(400, 'Reference document identifier is reserved.');
  if(docs.reduce((sum,d)=>sum+d.text.length,0)>500000) throw new IntegrationError(413,'Matter text exceeds limit.');
  const byId=new Map(docs.map(d=>[d.id,d]));
  const anchors=(value:unknown)=>array(value,3,true).map(value=>{
    const a=object(value,['doc','quote']); const doc=byId.get(validId(a.doc)); const quote=text(a.quote,4000); const found=doc&&locate(doc.text,quote);
    if(!doc||!found)throw new IntegrationError(400,'Quote must match a matter document.');
    return {doc:doc.id,quote:doc.text.slice(found.start,found.end),verified:true};
  });
  const facts: Fact[]=array(x.facts,100).map(value=>{
    const f=object(value,['id','date','doc','kind','summary','role','attrs','anchors','qualification']); const attrs=object(f.attrs??{},['servedAt','hearingDate','placedAt','writFactId','amountEur']);
    const doc=validId(f.doc); if(!byId.has(doc))throw new IntegrationError(400,'Unknown document.');
    const cleanAttrs: Fact['attrs']={};
    for(const key of ['servedAt','hearingDate','placedAt'] as const)if(attrs[key]!==undefined)cleanAttrs[key]=date(attrs[key]);
    if(attrs.writFactId!==undefined)cleanAttrs.writFactId=validId(attrs.writFactId);
    if(attrs.amountEur!==undefined){if(typeof attrs.amountEur!=='number'||!Number.isFinite(attrs.amountEur)||attrs.amountEur<0||attrs.amountEur>1e12)throw new IntegrationError(400,'Invalid amount.');cleanAttrs.amountEur=attrs.amountEur;}
    const source=anchors(f.anchors); if(source.some(a=>a.doc!==doc))throw new IntegrationError(400,'Fact anchors must belong to its document.');
    return {id:validId(f.id),date:date(f.date),doc,kind:text(f.kind,120),summary:translated(f.summary),role:choice(f.role,['conciliation_clause','limitation_start','debtor_communication','formal_notice','writ','writ_placement','writ_sanction','exhibits_list','other']),attrs:cleanAttrs,anchors:source,verified:true,...(f.qualification!==undefined?{qualification:validId(f.qualification)}:{})};
  }); unique(facts);
  for(const f of facts)if(f.attrs.writFactId&&!facts.some(w=>w.id===f.attrs.writFactId&&w.role==='writ'))throw new IntegrationError(400,'Unknown writ reference.');
  const qualifications: Qualification[]=array(x.qualifications,100).map(value=>{
    const q=object(value,['id','kind','factId','question','proposed','yes','no','reasoning','rule','whatIfLabel','anchors']);
    if(typeof q.proposed!=='boolean'||!facts.some(f=>f.id===q.factId))throw new IntegrationError(400,'Invalid qualification reference or proposal.');
    return {id:validId(q.id),kind:choice(q.kind,['conciliation_clause','acknowledgment','formal_notice','writ_outcome','conciliation_attempted']),factId:validId(q.factId),question:translated(q.question),proposed:q.proposed,yes:translated(q.yes),no:translated(q.no),reasoning:translated(q.reasoning),rule:text(q.rule,200),whatIfLabel:translated(q.whatIfLabel),source:'ai_inferred',confidence:'low',...(q.anchors!==undefined?{anchors:anchors(q.anchors)}:{})};
  });unique(qualifications);
  for(const f of facts)if(f.qualification&&!qualifications.some(q=>q.id===f.qualification&&q.factId===f.id))throw new IntegrationError(400,'Unknown qualification reference.');
  for (const fact of facts) fact.qualification ??= qualifications.find(q => q.factId === fact.id)?.id;
  return {id:validId(x.id),origin:'cached',profile,docs,facts,qualifications,trace:[{at:Date.now(),stage:'ingest',kind:'note',text:'Imported source annotations; quote verification is not legal confirmation.'}]};
}
