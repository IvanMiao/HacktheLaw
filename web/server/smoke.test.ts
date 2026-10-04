import { afterEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
const folders:string[]=[];
afterEach(()=>folders.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true})));
it('help requires no secret and rejects accidental live calls',()=>{
 const help=spawnSync(process.execPath,['scripts/live-smoke.mjs','--help'],{encoding:'utf8'});
 expect(help.status).toBe(0);expect(help.stdout).toContain('exactly 3');
 expect(spawnSync(process.execPath,['scripts/live-smoke.mjs'],{encoding:'utf8'}).status).toBe(1);
});
it('replays explicitly mock test receipts through the actual engine without network',()=>{
 mkdirSync('.verification',{recursive:true});
 const dir=mkdtempSync('.verification/test-replay-');folders.push(dir);
 const path=dir+'/receipts.json';
 writeFileSync(path,JSON.stringify({provider:'TEST-ONLY mocked fixture',receipts:[
  {endpoint:'/api/transcribe',status:200,response:{text:'What if the 2022 email acknowledges the debt?'}},
  {endpoint:'/api/intent',status:200,response:{intent:{action:'preview_scenario',target:'q-email',value:true,sourceIds:['email']}}},
  {endpoint:'/api/intent',status:200,response:{intent:{action:'preview_scenario',target:'q-concil',value:false,sourceIds:['pieces']}}},
 ]}));
 const run=spawnSync(process.execPath,['scripts/live-smoke.mjs','--replay',path,dir+'/result.json'],{encoding:'utf8',timeout:20000});
 expect(run.status,run.stdout+run.stderr).toBe(0);expect(run.stdout).toContain('"passed":true');expect(run.stdout).toContain('replay');
 expect(existsSync(dir+'/result.json')).toBe(true);
});
