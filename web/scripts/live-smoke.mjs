// Opt-in integration probe: actual HTTP backend + actual existing engine via Vite SSR.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const args = process.argv.slice(2);
const replay=args[0]==='--replay';
if ((!replay && args[0] !== '--live') || !args[1]) {
  console.log('Usage: npm run voice:smoke -- --live /absolute/path/to/non-sensitive-command.wav');
  console.log('Offline replay: npm run voice:smoke -- --replay /path/to/live-browser-evidence.json (no network/provider calls)');
  console.log('Makes exactly 3 hosted generation calls: transcription, email intent, conciliation intent. Requires running voice server; no key is read by this script.');
  process.exit(args[0] === '--help' ? 0 : 1);
}
const replaySource=replay?JSON.parse(await readFile(args[1],'utf8')):null;
const replayReceipts=replaySource?.receipts.filter(r=>r.status===200) ?? [];
const evidence = { timestamp:new Date().toISOString(),provider:replay?'explicit replay of retained responses; NO new provider calls':'real Mistral via local backend',replayedSourceProvider:replaySource?.provider,syntheticAudio:true,humanMicrophoneVerified:false,receipts:[],checks:[] };
const vite = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const engine = await vite.ssrLoadModule('/src/engine/chains.ts');
  const commands = await vite.ssrLoadModule('/src/voice/commands.ts');
  const status = s => engine.analyse(s).chains.map(c=>({id:c.id,status:c.status}));
  const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
  const assert = (ok,message) => { if(!ok) throw Error(message); evidence.checks.push({check:message,passed:true}); };
  async function call(endpoint, options) {
    if(replay) { const index=replayReceipts.findIndex(r=>r.endpoint===endpoint); if(index<0)throw Error('Missing successful replay receipt: '+endpoint); const [receipt]=replayReceipts.splice(index,1);evidence.receipts.push({...receipt,replayed:true});return receipt.response; }
    const response=await fetch('http://127.0.0.1:8787'+endpoint,{...options,signal:AbortSignal.timeout(40000)});
    const data=await response.json();
    evidence.receipts.push({endpoint,status:response.status,requestId:response.headers.get('x-mistral-request-id'),response:data,timestamp:new Date().toISOString()});
    if(!response.ok) throw Error(`Local API ${response.status}: ${data.error ?? 'request failed'}`);
    return data;
  }
  if(!replay) { const health=await call('/api/status'); assert(health.configured,'Backend key is configured'); }
  const transcript=await call('/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/wav'},body:replay?undefined:await readFile(args[1])});
  evidence.transcript=transcript.text;
  const before=engine.initialState();
  const requestIntent=async(text,state)=> (await call('/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,context:commands.buildContext(state)})})).intent;
  const email=await requestIntent(transcript.text,before);
  assert(email.action==='preview_scenario' && email.target==='q-email' && email.value===true,'Real transcript resolves to email acknowledgment hypothesis');
  const afterEmail=commands.applyIntent(before,email);
  assert(same(status(afterEmail),[{id:'C1',status:'fails'},{id:'C2',status:'contested'}]),'Email changes C1 only');
  assert(same(before.decisions,afterEmail.decisions),'Email preserves decisions');
  assert(same(commands.applyIntent(afterEmail,email),afterEmail),'Repeated email intent is idempotent');
  const concil=await requestIntent('Suppose conciliation was attempted before filing.',afterEmail);
  assert(concil.action==='preview_scenario' && concil.target==='q-concil' && concil.value===false,'Real conciliation command uses correct boolean polarity');
  const afterConcil=commands.applyIntent(afterEmail,concil);
  assert(same(status(afterConcil),[{id:'C1',status:'fails'},{id:'C2',status:'fails'}]),'Conciliation breaks C2');
  const restored=commands.applyIntent(afterConcil,{action:'reset_scenario',target:null,value:null,sourceIds:[]});
  assert(same(status(restored),status(before)) && same(restored.decisions,before.decisions),'Reset restores baseline and preserves decisions');
  evidence.states={before:status(before),afterEmail:status(afterEmail),afterConcil:status(afterConcil),restored:status(restored)};
  evidence.passed=true;
} catch(error) {
  evidence.passed=false; evidence.error=error.message;process.exitCode=1;
} finally {
  await vite.close();await mkdir('.verification',{recursive:true});
  const output=args[2] ?? (replay?'.verification/replay-engine-evidence.json':'.verification/live-cli-evidence.json');
  await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({passed:evidence.passed,mode:replay?'replay':'live',evidencePath:process.cwd()+'/'+output,error:evidence.error ?? null}));
}
