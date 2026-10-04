import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { loadEnv } from 'vite';
// Read-only staging gate. Secret values are compared in memory, never printed.
const env=loadEnv('development',process.cwd(),'');
const diff=execFileSync('git',['diff','--cached'],{encoding:'utf8'});
const values=[env.MISTRAL_API_KEY,readFileSync('.verification/integration-key.local','utf8').trim()].filter((value):value is string=>Boolean(value));
if(values.some(value=>diff.includes(value)))throw Error('Secret detected in staged diff.');
const files=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(!files.length)throw Error('No source changes staged.');
if(files.some(file=>/\.env\.local$|\.verification\/|\.sqlite$|node_modules\//.test(file)))throw Error('Private artifact staged.');
if((statSync('.verification/integration-key.local').mode&0o777)!==0o600)throw Error('Local integration token must have mode 0600.');
console.log(`Staged secret/artifact scan passed; token mode 0600; ${files.length} files staged.`);
