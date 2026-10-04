import { createServer, loadEnv } from 'vite';
import { randomBytes } from 'node:crypto';
import { writeFile, mkdir, chmod } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createServer as portProbe } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixture } from './create-firm-fixture.js';
const web=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(web);
Object.assign(process.env,loadEnv('development',web,''));
// Check ignore rules before writing any local credential or SQLite artifact.
execFileSync('git',['check-ignore','-q','.verification/integration-key.local'],{cwd:web});
execFileSync('git',['check-ignore','-q','.env.local'],{cwd:web});
async function free(port:number){await new Promise<void>((resolve,reject)=>{const probe=portProbe();probe.once('error',()=>reject(Error(`Port ${port} is occupied; existing services were not stopped.`)));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve()));});}
await Promise.all([5175,8797,8798].map(free));
await mkdir('.verification',{recursive:true});
process.env.DOMINO_INTEGRATION_KEY ||= randomBytes(32).toString('hex');
await writeFile('.verification/integration-key.local',process.env.DOMINO_INTEGRATION_KEY,{mode:0o600});await chmod('.verification/integration-key.local',0o600);
process.env.DOMINO_SQLITE_FILE ||= await createFixture();
process.env.DOMINO_SQLITE_MATTERS ||= 'demo-c1-c2';
process.env.DOMINO_LOCAL_CONNECTIONS='true';
process.env.DOMINO_UI_ORIGINS='http://127.0.0.1:5175,http://localhost:5175';
process.env.DOMINO_PROVIDER='mistral';
process.env.VOICE_PORT='8797';process.env.VOICE_REALTIME_PORT='8798';
process.env.VOICE_ALLOWED_ORIGINS=process.env.DOMINO_UI_ORIGINS;
const voice=spawn('bun',['server/index.ts'],{cwd:web,env:process.env,stdio:'inherit'});
voice.on('error',()=>console.error('Isolated voice services unavailable; Connections remains usable.'));
const vite=await createServer({root:web,server:{host:'127.0.0.1',port:5175,strictPort:true}});
let closing=false;async function close(){if(closing)return;closing=true;voice.kill('SIGTERM');await vite.close();process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
await vite.listen();
console.log('Domino Connections demo: http://127.0.0.1:5175 · synthetic SQLite, in-memory imports. Integration token retained only in ignored .verification/integration-key.local.');
