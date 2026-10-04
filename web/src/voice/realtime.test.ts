import { describe, expect, it, vi } from 'vitest';
import { Endpoint, IntentQueue, reconnectDelay, startPcmCapture, listenRealtime } from './realtime';
// Legacy speech/silence semantics now begin after explicit ambient calibration.
function readyEndpoint(){const e=new Endpoint();for(let t=-1000;t<=-300;t+=20)e.audio(0,t);return e;}

describe('continuous realtime endpointing',()=>{
 it('automatically ends a real speech segment over continuous above-threshold room noise',()=>{
  const e=new Endpoint();
  for(let t=0;t<=1000;t+=20)e.audio(.022,t);
  for(let t=1020;t<=2000;t+=20)e.audio(t%80===0?.14:.08,t);
  e.delta('What if appellant submissions were filed in time?',2100);
  for(let t=2020;t<=6000;t+=20){e.audio(.022,t);if(t<3400)expect(e.take(t)).toBeNull();}
  expect(e.take(6000)).toBe('What if appellant submissions were filed in time?');
  expect(e.take(7000)).toBeNull();
 });
 it('does not treat stationary room noise plus provider text as observed speech',()=>{
  const e=new Endpoint();for(let t=0;t<=3000;t+=20)e.audio(.022,t);
  e.delta('Reset the scenario',3100);for(let t=3020;t<=6000;t+=20)e.audio(.022,t);
  expect(e.take(6000)).toBeNull();expect(e.partial).toBe('');
 });
 it('surfaces and discards a blocked stable transcript instead of waiting indefinitely or forcing execution',()=>{
  const e=new Endpoint();for(let t=0;t<=1000;t+=20)e.audio(.022,t);
  e.audio(.1,1100);e.delta('Reset the scenario',1200);
  for(let t=1220;t<=9500;t+=20)e.audio(.1,t);
  expect(e.take(9500)).toBeNull();expect(e.expire(9500)).toContain('background noise');
  expect(e.partial).toBe('');expect(e.take(12000)).toBeNull();
 });
 it('calibrates before accepting speech and exposes safe acoustic/transcript metrics',()=>{
  const e=new Endpoint();e.audio(.022,0);e.delta('noise hallucination',100);
  expect(e.diagnostic(100).waiting).toBe('calibrating');expect(e.partial).toBe('');
  for(let t=20;t<=1000;t+=20)e.audio(.022,t);
  expect(e.diagnostic(1000)).toMatchObject({calibrated:true,noiseFloor:.022,waiting:'idle'});expect(e.diagnostic(1000).threshold).toBeCloseTo(.055);
  e.audio(.1,1100);e.delta('Reset',1200);
  expect(e.diagnostic(1600)).toMatchObject({waiting:'acoustic-pause',acousticQuietMs:500,transcriptStableMs:400});
 });
 it('never emits silence or unstable partials; emits once after acoustic and text quiet',()=>{
  const e=readyEndpoint(); expect(e.take(5000)).toBeNull();
  e.audio(0.2,100); e.delta('What if ',500); e.audio(0,800);
  expect(e.take(1000)).toBeNull(); e.delta('the email acknowledges debt?',1100);
  expect(e.take(1700)).toBeNull(); expect(e.take(2400)).toBe('What if the email acknowledges debt?');
  expect(e.take(5000)).toBeNull();
 });
 it('speech continuing through a pause debounces endpoint; repeated utterance remains a new command',()=>{
  const e=readyEndpoint(); e.audio(.1,0); e.delta('Reset',300); e.audio(.1,1300);
  expect(e.take(1500)).toBeNull(); expect(e.take(3000)).toBe('Reset');
  e.audio(.1,4000); e.delta('Reset',4400); expect(e.take(6000)).toBe('Reset');
 });
 it('does not execute a provider hallucination during pure acoustic silence',()=>{const e=readyEndpoint();e.audio(0,0);e.delta('Reset the scenario',100);expect(e.take(5000)).toBeNull();});
 it('discards text received without observed speech so it cannot prefix the next real command',()=>{const e=readyEndpoint();e.delta('Confirm all facts.',100);e.audio(.1,1000);e.delta('Reset the scenario',1100);expect(e.take(3000)).toBe('Reset the scenario');});
 it('discards partials on cancel/reconnect and bounds transcript length',()=>{
  const e=new Endpoint(); e.delta('Reset',0); e.clear(); expect(e.take(4000)).toBeNull();
  expect(()=>e.delta('x'.repeat(2001),0)).toThrow('long');
 });
});
describe('serialized automatic command execution',()=>{
 it('reports queued, request, response and failure boundaries without raw transport payloads',async()=>{
  const activity=vi.fn();const q=new IntentQueue(async(text)=>{if(text==='bad')throw Error('provider');return text;},()=>{},()=>{},activity);
  q.push('good');await q.idle();q.push('bad');await q.idle();
  expect(activity.mock.calls.map(c=>c[0])).toEqual(['queued','executing','answered','queued','executing','error']);
 });
 it('orders requests and uses fresh context; repetition is not a toggle or deduped',async()=>{
  let release!:()=>void; const order:string[]=[]; const applied:string[]=[];
  const q=new IntentQueue(async(text)=>{order.push(text); if(text==='first') await new Promise<void>(r=>{release=r;});return text;},value=>applied.push(value),()=>{});
  q.push('first');q.push('second');q.push('second');await Promise.resolve(); expect(order).toEqual(['first']);
  release(); await q.idle(); expect(order).toEqual(['first','second','second']);expect(applied).toEqual(order);
 });
 it('OFF aborts active request, empties queue, and drops late responses even when fetch ignores abort',async()=>{
  let release!:(s:string)=>void; let signal!:AbortSignal; const apply=vi.fn();
  const q=new IntentQueue(async(_text,s)=>{signal=s;return new Promise<string>(r=>{release=r;});},apply,()=>{});
  q.push('late');q.push('queued');q.cancel();expect(signal.aborted).toBe(true);release('unsafe');await q.idle();expect(apply).not.toHaveBeenCalled();
 });
 it('provider failure does not stall following utterances',async()=>{
  const apply=vi.fn(),error=vi.fn();const q=new IntentQueue(async(text)=>{if(text==='bad')throw Error('provider');return text;},apply,error);
  q.push('bad');q.push('good');await q.idle();expect(error).toHaveBeenCalledOnce();expect(apply).toHaveBeenCalledWith('good');
 });
 it('reconnects at most twice and never retries policy/auth/invalid audio failures',()=>{
  expect(reconnectDelay(0,1006)).toBe(600);expect(reconnectDelay(1,1006)).toBe(1200);expect(reconnectDelay(2,1006)).toBeNull();
  for(const code of [1000,1008,1009,4401,4403])expect(reconnectDelay(0,code)).toBeNull();
 });
});
describe('PCM capture lifecycle',()=>{
 it('permission denial propagates without creating audio resources',async()=>{
  const create=vi.fn();await expect(startPcmCapture(()=>{}, {getUserMedia:async()=>{throw new DOMException('denied','NotAllowedError');},createContext:create})).rejects.toMatchObject({name:'NotAllowedError'});expect(create).not.toHaveBeenCalled();
 });
 it('cancellation while permission is pending stops newly acquired tracks without opening context',async()=>{
  let release!:(s:MediaStream)=>void;const stop=vi.fn(),create=vi.fn();const c=new AbortController();
  const pending=startPcmCapture(()=>{},{getUserMedia:()=>new Promise(r=>{release=r;}),createContext:create,signal:c.signal});c.abort();release({getTracks:()=>[{stop}]} as unknown as MediaStream);
  await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(stop).toHaveBeenCalledOnce();expect(create).not.toHaveBeenCalled();
 });
 it('worklet initialization failure closes context and stops tracks',async()=>{
  const stop=vi.fn(),close=vi.fn();const ctx={audioWorklet:{addModule:async()=>{throw Error('worklet');}},close} as unknown as AudioContext;
  await expect(startPcmCapture(()=>{},{getUserMedia:async()=>({getTracks:()=>[{stop}]} as unknown as MediaStream),createContext:()=>ctx})).rejects.toThrow('worklet');expect(stop).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
 });
});
describe('persistent listening session lifecycle (injected browser resources)',()=>{
 function resources(){
  const trackStop=vi.fn(),contextClose=vi.fn(async()=>{}),disconnect=vi.fn();
  class Context {audioWorklet={addModule:async()=>{}};destination={};createMediaStreamSource(){return {connect:vi.fn(),disconnect};}resume=async()=>{};close=contextClose;}
  class Worklet {static latest:Worklet;port:{onmessage:((e:{data:{pcm:ArrayBuffer;rms:number}})=>void)|null}={onmessage:null};constructor(){Worklet.latest=this;}connect=vi.fn();disconnect=disconnect;}
  class Socket {static OPEN=1;static all:Socket[]=[];readyState=1;bufferedAmount=0;onmessage:((e:{data:string})=>void)|null=null;onclose:((e:{code:number})=>void)|null=null;onerror:(()=>void)|null=null;send=vi.fn();close=vi.fn(()=>{this.readyState=3;this.onclose?.({code:1000});});constructor(){Socket.all.push(this);}}
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:trackStop}]})}});vi.stubGlobal('AudioContext',Context);vi.stubGlobal('AudioWorkletNode',Worklet);vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('location',{protocol:'http:',host:'localhost:5173'});
  return {Socket,Worklet,trackStop,contextClose};
 }
 it('keeps one microphone and socket ON for two commands, then OFF releases everything and ignores late events',async()=>{
  vi.useFakeTimers();const {Socket,Worklet,trackStop,contextClose}=resources();const utterance=vi.fn(),state=vi.fn();
  const session=listenRealtime({onState:state,onPartial:()=>{},onUtterance:utterance,onError:()=>{}});await vi.advanceTimersByTimeAsync(0);
  const socket=Socket.all[0];socket.onmessage?.({data:'{"type":"ready"}'});
  for(let i=0;i<40;i++){Worklet.latest.port.onmessage?.({data:{pcm:new ArrayBuffer(640),rms:0}});await vi.advanceTimersByTimeAsync(20);}
  for(const text of ['Preview the email','Reset the scenario']){Worklet.latest.port.onmessage?.({data:{pcm:new ArrayBuffer(640),rms:.1}});socket.onmessage?.({data:JSON.stringify({type:'delta',text})});await vi.advanceTimersByTimeAsync(1600);}
  expect(utterance.mock.calls.map(c=>c[0])).toEqual(['Preview the email','Reset the scenario']);expect(Socket.all).toHaveLength(1);expect(trackStop).not.toHaveBeenCalled();
  session.stop();socket.onmessage?.({data:'{"type":"delta","text":"late"}'});await vi.advanceTimersByTimeAsync(3000);expect(utterance).toHaveBeenCalledTimes(2);expect(trackStop).toHaveBeenCalledOnce();expect(contextClose).toHaveBeenCalledOnce();expect(socket.close).toHaveBeenCalledOnce();expect(Worklet.latest.port.onmessage).toBeNull();expect(vi.getTimerCount()).toBe(0);vi.unstubAllGlobals();vi.useRealTimers();
 });
 it('bounds reconnects across the whole ON session and releases microphone on terminal failure',async()=>{
  vi.useFakeTimers();const {Socket,trackStop}=resources();const state=vi.fn();listenRealtime({onState:state,onPartial:()=>{},onUtterance:()=>{},onError:()=>{}});await vi.advanceTimersByTimeAsync(0);
  Socket.all[0].onclose?.({code:1006});await vi.advanceTimersByTimeAsync(600);Socket.all[1].onclose?.({code:1006});await vi.advanceTimersByTimeAsync(1200);Socket.all[2].onclose?.({code:1006});await vi.advanceTimersByTimeAsync(5000);
  expect(Socket.all).toHaveLength(3);expect(state).toHaveBeenLastCalledWith('failed');expect(trackStop).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);vi.unstubAllGlobals();vi.useRealTimers();
 });
 it('traces noisy streaming through automatic utterance, bounds stalls, and stops diagnostics on OFF',async()=>{
  vi.useFakeTimers();const {Socket,Worklet}=resources();const utterance=vi.fn(),diagnostic=vi.fn(),error=vi.fn();
  const session=listenRealtime({onState:()=>{},onPartial:()=>{},onUtterance:utterance,onError:error,onDiagnostic:diagnostic});await vi.advanceTimersByTimeAsync(0);
  const socket=Socket.all[0];socket.onmessage?.({data:'{"type":"ready"}'});
  async function audio(rms:number,frames:number){for(let i=0;i<frames;i++){Worklet.latest.port.onmessage?.({data:{pcm:new ArrayBuffer(640),rms}});await vi.advanceTimersByTimeAsync(20);}}
  await audio(.022,50);await audio(.1,20);socket.onmessage?.({data:'{"type":"delta","text":"Reset the scenario"}'});await audio(.022,100);
  expect(utterance).toHaveBeenCalledWith('Reset the scenario');expect(diagnostic.mock.calls.at(-1)?.[0]).toMatchObject({calibrated:true,pcmFrames:170,partialDeltas:1,utterances:1});
  await audio(.1,10);socket.onmessage?.({data:'{"type":"delta","text":"blocked"}'});await audio(.1,430);
  expect(error).toHaveBeenCalledWith(expect.stringContaining('background noise'));expect(utterance).toHaveBeenCalledTimes(1);
  session.stop();const count=diagnostic.mock.calls.length;await vi.advanceTimersByTimeAsync(1000);expect(diagnostic).toHaveBeenCalledTimes(count);expect(vi.getTimerCount()).toBe(0);vi.unstubAllGlobals();vi.useRealTimers();
 });
});
