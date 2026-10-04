import { DatabaseSync } from 'node:sqlite';
import { normalizeMatter, IntegrationError, validId } from './contracts.js';
export class SQLiteBridge {
  private db:DatabaseSync;
  private selectors:string[];
  constructor(path:string,selectors:string[]){
    this.selectors = selectors;
    if(!selectors.length||selectors.length>100)throw new IntegrationError(503,'SQLite matter selectors are not configured.');selectors.forEach(validId);
    try{this.db=new DatabaseSync(path,{readOnly:true});}catch{throw new IntegrationError(503,'Configured SQLite bridge is unavailable.');}
  }
  list():{id:string;title:string}[]{
    try{return this.selectors.flatMap(id=>{const row=this.db.prepare('SELECT id, title FROM matters WHERE id = ? AND synthetic = 1').get(id);return row?[{id:String(row.id),title:String(row.title)}]:[];});}catch{throw new IntegrationError(503,'SQLite schema is unavailable.');}
  }
  read(id:string){
    validId(id);if(!this.selectors.includes(id))throw new IntegrationError(404,'Matter not found.');
    try {
      const row=this.db.prepare('SELECT annotations_json FROM matters WHERE id = ? AND synthetic = 1').get(id);if(!row)throw new IntegrationError(404,'Matter not found.');
      const documents=this.db.prepare('SELECT id, title, short, date, doc_type, text FROM documents WHERE matter_id = ? ORDER BY rowid LIMIT 31').all(id).map(d=>({id:d.id,title:d.title,short:d.short,date:d.date,docType:d.doc_type,text:d.text}));
      return normalizeMatter({id,synthetic:true,...JSON.parse(String(row.annotations_json)),documents});
    }catch(error){if(error instanceof IntegrationError)throw error;throw new IntegrationError(503,'Configured SQLite bridge read failed.');}
  }
  close(){this.db.close();}
}
