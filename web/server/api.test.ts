import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from './api';
import { buildContext } from '../src/voice/commands';
import { initialState } from '../src/engine/chains';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); } });
async function start(options = {}) {
 const server = createServer(createHandler(options)); servers.push(server); server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const address = server.address() as {port:number}; return `http://127.0.0.1:${address.port}`;
}
const body = () => JSON.stringify({ text: 'Show clause evidence', context: buildContext(initialState()) });
describe('local Mistral API (test-only injected provider)', () => {
 it('reports missing key and keeps errors redacted', async () => {
  const url = await start({ apiKey: '' });
  expect(await (await fetch(url + '/api/status')).json()).toMatchObject({ configured: false, intentModel:'ministral-8b-latest', realtimeModel:'voxtral-mini-transcribe-realtime-2602', realtimeFormat:'pcm_s16le/16000/mono' });
  const r = await fetch(url + '/api/intent', { method:'POST', headers:{'Content-Type':'application/json'}, body:body() });
  expect(r.status).toBe(503); expect(await r.json()).toMatchObject({error:'Mistral is not configured. Set MISTRAL_API_KEY on the local server.'});
 });
 it('sends grounded structured intent request and validates provider output', async () => {
  const provider = vi.fn(async (_url, options) => {
   const payload = JSON.parse(options.body); expect(payload.response_format.type).toBe('json_schema');
   expect(payload.messages[1].content).toContain('q-concil');
   expect(payload.messages[1].content.length).toBeLessThan(10000);
   expect(payload.messages[1].content).toContain('Writ #1 no longer interrupts');
   return Response.json({choices:[{message:{content:JSON.stringify({action:'show_evidence',target:'contract',value:null,sourceIds:['contract']})}}]}, {headers:{'x-request-id':'test-request-1'}});
  });
  const url = await start({apiKey:'dummy', fetchImpl:provider});
  const r = await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body()});
  expect(r.status).toBe(200); expect((await r.json()).intent.target).toBe('contract');
  expect(r.headers.get('x-mistral-request-id')).toBe('test-request-1');
  expect(provider.mock.calls[0][0]).toBe('https://api.mistral.ai/v1/chat/completions');
 });
 it('posts bounded audio as multipart to Voxtral Mini Transcribe 2', async () => {
  const provider = vi.fn(async (url, options) => {
   expect(url).toBe('https://api.mistral.ai/v1/audio/transcriptions');
   expect(options.body.get('model')).toBe('voxtral-mini-2602');
   expect(options.body.get('file').type).toBe('audio/webm');
   return Response.json({text:'Show clause evidence'});
  });
  const url = await start({apiKey:'dummy',fetchImpl:provider});
  const r = await fetch(url+'/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/webm;codecs=opus'},body:new Uint8Array([1,2,3])});
  expect(r.status).toBe(200); expect(await r.json()).toEqual({text:'Show clause evidence'});
 });
 it('rejects empty audio, invalid mime, oversized audio and unknown routes before provider', async () => {
  const provider = vi.fn(); const url = await start({apiKey:'dummy',fetchImpl:provider});
  for(const [type, audio, status] of [['text/plain','bad',415],['audio/webm','',400],['audio/webm',new Uint8Array(4*1024*1024+1),413]] as const) {
   expect((await fetch(url+'/api/transcribe',{method:'POST',headers:{'Content-Type':type},body:audio})).status).toBe(status);
  }
  expect((await fetch(url+'/api/other')).status).toBe(404); expect(provider).not.toHaveBeenCalled();
 });
 it('rejects malformed context, unsafe output and never exposes provider error bodies', async () => {
  const provider = vi.fn(async () => Response.json({choices:[{message:{content:'{"action":"confirm"}'}}]}));
  const url = await start({apiKey:'dummy',fetchImpl:provider});
  expect((await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text":"x","context":{}}'})).status).toBe(400);
  const r = await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body()});
  expect(r.status).toBe(502); expect(await r.text()).not.toContain('dummy');
  provider.mockImplementation(async () => { throw Error('dummy private raw provider error'); });
  const failure = await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body()});
  expect(await failure.text()).not.toContain('private');
 });
 it('times out provider calls and recovers on a later request', async () => {
  const provider = vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => options.signal.addEventListener('abort',()=>reject(options.signal.reason))));
  const url = await start({apiKey:'dummy',fetchImpl:provider,timeoutMs:20});
  const r = await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body()});
  expect(r.status).toBe(504);
  provider.mockImplementation(async () => Response.json({choices:[{message:{content:'{"action":"reset_scenario","target":null,"value":null,"sourceIds":[]}'}}]}));
  expect((await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body()})).status).toBe(200);
 });
 it('makes upstream rate limits explicit without leaking raw provider details', async () => {
  const provider = vi.fn(async()=>Response.json({message:'dummy private quota detail'}, {status:429,headers:{'retry-after':'60'}}));
  const url=await start({apiKey:'dummy',fetchImpl:provider});
  const response=await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body()});
  expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60');
  const text=await response.text(); expect(text).toContain('rate limit'); expect(text).not.toContain('private');
 });
 it('aborts upstream intent work when OFF disconnects the browser request', async()=>{
  let started!:()=>void;const ready=new Promise<void>(r=>{started=r;});let upstreamSignal!:AbortSignal;
  const provider=vi.fn((_url,options)=>{upstreamSignal=options.signal;started();return new Promise<Response>((_resolve,reject)=>upstreamSignal.addEventListener('abort',()=>reject(upstreamSignal.reason)));});
  const url=await start({apiKey:'key1',fetchImpl:provider});const controller=new AbortController();
  const pending=fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:body(),signal:controller.signal}).catch(()=>null);
  await ready;controller.abort();await pending;await new Promise(r=>setTimeout(r,30));expect(upstreamSignal.aborted).toBe(true);
 });
 it('blocks cross-origin browser requests', async () => {
  const url = await start({apiKey:'dummy'});
  expect((await fetch(url+'/api/intent',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:body()})).status).toBe(403);
 });
});
