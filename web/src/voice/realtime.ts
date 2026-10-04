// Continuous PCM streaming. Local protocol is intentionally not provider JSON.
export type EndpointDiagnostic={rms:number;noiseFloor:number;threshold:number;calibrated:boolean;acousticQuietMs:number|null;transcriptStableMs:number|null;waiting:'calibrating'|'idle'|'acoustic-pause'|'transcript'};
export type RealtimeDiagnostic=EndpointDiagnostic&{pcmFrames:number;partialDeltas:number;utterances:number};
export class Endpoint {
 private text=''; private speechAt=-Infinity; private textAt=-Infinity;
 private rms=0;private calibration:{rms:number;at:number}[]=[];private noiseFloor=0;private calibrated=false;
 private get threshold(){return Math.max(.015,this.noiseFloor*2.5);}
 audio(rms:number,now:number,observeSpeech=true) {
  if(!Number.isFinite(rms)||rms<0)return;this.rms=rms;
  // Calibrate from the initial 600 ms (normally while the WS handshakes).
  // Freeze the lower quintile: sustained speech must not become its own noise floor.
  if(!this.calibrated){
   this.calibration.push({rms,at:now});
   if(this.calibration.length>=30&&now-this.calibration[0].at>=600){
    const levels=this.calibration.map(f=>f.rms).sort((a,b)=>a-b);
    this.noiseFloor=levels[Math.floor((levels.length-1)*.2)];this.calibrated=true;this.calibration=[];
   }
   return;
  }
  if(observeSpeech&&rms>=this.threshold)this.speechAt=now;
 }
 delta(text:string,now:number) { if(this.text.length+text.length>2000) throw Error('Utterance too long. Pause between commands.');if(!Number.isFinite(this.speechAt))return;this.text+=text;this.textAt=now; }
 take(now:number):string|null {
  if(!Number.isFinite(this.speechAt) || !this.text.trim() || now-this.speechAt<1400 || now-this.textAt<1100) return null;
  const text=this.text.trim();this.clear();return text;
 }
 expire(now:number):string|null {
  if(!this.text.trim()||now-this.textAt<8000)return null;
  this.clear();return 'Speech endpoint blocked by continuing audio/background noise. Command discarded; no changes. Pause, reduce room noise, or turn OFF/ON to recalibrate.';
 }
 diagnostic(now:number):EndpointDiagnostic {
  const acousticQuietMs=Number.isFinite(this.speechAt)?Math.max(0,Math.round(now-this.speechAt)):null;
  const transcriptStableMs=Number.isFinite(this.textAt)?Math.max(0,Math.round(now-this.textAt)):null;
  return {rms:this.rms,noiseFloor:this.noiseFloor,threshold:this.threshold,calibrated:this.calibrated,acousticQuietMs,transcriptStableMs,waiting:!this.calibrated?'calibrating':!this.text.trim()?'idle':acousticQuietMs!==null&&acousticQuietMs<1400?'acoustic-pause':'transcript'};
 }
 clear() {this.text='';this.textAt=-Infinity;this.speechAt=-Infinity;}
 get partial() {return this.text;}
}
export type QueuePhase='queued'|'executing'|'answered'|'error';
export class IntentQueue<T> {
 private pending:string[]=[];private active:AbortController|null=null;private stopped=false;private running:Promise<void>=Promise.resolve();
 private request:(text:string,signal:AbortSignal)=>Promise<T>; private apply:(result:T)=>void; private error:(error:unknown)=>void; private activity:(phase:QueuePhase,text:string)=>void;
 constructor(request:(text:string,signal:AbortSignal)=>Promise<T>,apply:(result:T)=>void,error:(error:unknown)=>void,activity:(phase:QueuePhase,text:string)=>void=()=>{}) {this.request=request;this.apply=apply;this.error=error;this.activity=activity;}
 push(text:string) {if(this.stopped)return;if(this.pending.length>=8){this.activity('error',text);this.error(Error('Command queue full. Pause between commands.'));return;}this.pending.push(text);this.activity('queued',text);if(!this.active)this.running=this.drain();}
 private async drain() {
  while(!this.stopped && this.pending.length) {
   const text=this.pending.shift()!;const controller=new AbortController();this.active=controller;
   this.activity('executing',text);
   try {const result=await this.request(text,controller.signal);if(!this.stopped&&!controller.signal.aborted){this.apply(result);this.activity('answered',text);}}
   catch(e){if(!this.stopped&&!controller.signal.aborted){this.activity('error',text);this.error(e);}}
   this.active=null;
  }
 }
 cancel(){this.stopped=true;this.pending=[];this.active?.abort();}
 idle(){return this.running;}
}
export function reconnectDelay(attempt:number,code:number):number|null {return attempt<2 && [1006,1011,1012,1013].includes(code) ? 600*2**attempt:null;}
export type PcmFrame={pcm:ArrayBuffer;rms:number};
type CaptureOptions={getUserMedia?:(c:MediaStreamConstraints)=>Promise<MediaStream>;createContext?:()=>AudioContext;signal?:AbortSignal};
export async function startPcmCapture(onFrame:(frame:PcmFrame)=>void,{getUserMedia=c=>navigator.mediaDevices.getUserMedia(c),createContext=()=>new AudioContext({sampleRate:16000}),signal}:CaptureOptions={}) {
 const stream=await getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 let context:AudioContext|undefined;let source:MediaStreamAudioSourceNode|undefined;let worklet:AudioWorkletNode|undefined;let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;signal?.removeEventListener('abort',stop);stream.getTracks().forEach(t=>t.stop());source?.disconnect();if(worklet){worklet.port.onmessage=null;worklet.disconnect();}if(context)void Promise.resolve(context.close()).catch(()=>{});};
 if(signal?.aborted){stop();throw new DOMException('Cancelled','AbortError');}signal?.addEventListener('abort',stop,{once:true});
 try {
  context=createContext();await context.audioWorklet.addModule('/pcm-worklet.js');
  if(stopped)throw new DOMException('Cancelled','AbortError');
  source=context.createMediaStreamSource(stream);worklet=new AudioWorkletNode(context,'domino-pcm');
  worklet.port.onmessage=e=>{if(!stopped)onFrame(e.data as PcmFrame);};
  source.connect(worklet);worklet.connect(context.destination);await context.resume();
  if(stopped)throw new DOMException('Cancelled','AbortError');
  return {stop};
 }catch(e){stop();throw e;}
}
export type ListenState='permission'|'connecting'|'listening'|'reconnecting'|'failed'|'off';
export function listenRealtime({onState,onPartial,onUtterance,onError,onDiagnostic=()=>{}}:{onState:(s:ListenState)=>void;onPartial:(s:string)=>void;onUtterance:(s:string)=>void;onError:(s:string)=>void;onDiagnostic?:(s:RealtimeDiagnostic)=>void}) {
 const abort=new AbortController();const endpoint=new Endpoint();let socket:WebSocket|null=null;let capture:{stop:()=>void}|null=null;let ready=false;let attempts=0;let reconnect:ReturnType<typeof setTimeout>|undefined;let handshake:ReturnType<typeof setTimeout>|undefined;
 let pcmFrames=0,partialDeltas=0,utterances=0;
 const tick=setInterval(()=>{if(abort.signal.aborted)return;const now=performance.now();if(ready){const text=endpoint.take(now);if(text){utterances++;onPartial('');onUtterance(text);}const expired=endpoint.expire(now);if(expired){onPartial('');onError(expired);}}onDiagnostic({...endpoint.diagnostic(now),pcmFrames,partialDeltas,utterances});},100);
 const stop=()=>{if(abort.signal.aborted)return;abort.abort();clearInterval(tick);clearTimeout(reconnect);clearTimeout(handshake);ready=false;endpoint.clear();capture?.stop();if(socket){socket.onclose=null;socket.close();}onPartial('');onState('off');};
 const fail=(message:string)=>{stop();onError(message);onState('failed');};
 function connect() {
  if(abort.signal.aborted)return;endpoint.clear();onPartial('');ready=false;onState(attempts?'reconnecting':'connecting');
  socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/realtime`);const current=socket;
  handshake=setTimeout(()=>current.close(4000,'Connection timeout'),12_000);
  current.onmessage=e=>{
   if(abort.signal.aborted||current!==socket)return;
   try {
    const event=JSON.parse(e.data);
    if(event.type==='ready'){clearTimeout(handshake);ready=true;onState('listening');}
    else if(event.type==='delta'&&typeof event.text==='string'){partialDeltas++;endpoint.delta(event.text,performance.now());onPartial(endpoint.partial);}
    else if(event.type==='error'){fail(typeof event.message==='string'?event.message:'Realtime provider failed.');}
   }catch{fail('Invalid realtime transcript. No command applied.');}
  };
  current.onerror=()=>{}; // close handles bounded reconnect, without raw credential-bearing diagnostics.
  current.onclose=e=>{
   clearTimeout(handshake);if(abort.signal.aborted||current!==socket)return;ready=false;endpoint.clear();onPartial('');
   const delay=reconnectDelay(attempts++,e.code===4000?1006:e.code);
   if(delay===null){fail('Realtime disconnected. Microphone OFF. Retry the switch or type a command.');return;}
   onState('reconnecting');onError('Realtime reconnecting · incomplete utterance discarded.');reconnect=setTimeout(connect,delay);
  };
 }
 onState('permission');
 void startPcmCapture(frame=>{
  if(abort.signal.aborted)return;
  // Ambient calibration begins before the upstream handshake, not after the user speaks.
  endpoint.audio(frame.rms,performance.now(),ready);
  if(!ready||!socket||socket.readyState!==WebSocket.OPEN||abort.signal.aborted)return;
  if(socket.bufferedAmount>128*1024){fail('Realtime connection too slow. Microphone OFF; retry.');return;}
  socket.send(frame.pcm);pcmFrames++;
 },{signal:abort.signal}).then(value=>{if(abort.signal.aborted){value.stop();return;}capture=value;connect();}).catch(e=>{if(!abort.signal.aborted)fail(e?.name==='NotAllowedError'?'Microphone permission denied. Allow access or type a command.':'Microphone unavailable. Use localhost/HTTPS or type a command.');});
 return {stop};
}
