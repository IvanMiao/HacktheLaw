/* Browser-only opt-in verification fixture. Synthetic generated speech, not
 * a human microphone. Run on localhost after loading the sample case.
 * Actual AudioContext/Worklet, PCM WS, Mistral and /api/intent are unchanged. */
(() => {
 window.voiceEvidence={syntheticAudio:true,humanMicrophoneVerified:false,events:[],receipts:[],dom:[],socketCount:0,pcmBytes:0,trackStops:0,contexts:[],switchClicks:0};
 const evidence=window.voiceEvidence;
 const nativeWS=window.WebSocket;
 window.WebSocket=class extends nativeWS {constructor(...args){super(...args);if(String(args[0]).includes('/api/realtime')){evidence.socketCount++;this.addEventListener('message',e=>evidence.events.push({...JSON.parse(e.data),at:performance.now()}));this.addEventListener('close',e=>evidence.events.push({type:'socket.closed',code:e.code,at:performance.now()}));const send=this.send.bind(this);this.send=data=>{if(data instanceof ArrayBuffer)evidence.pcmBytes+=data.byteLength;return send(data);};}}};
 const nativeFetch=window.fetch.bind(window);window.fetch=async(url,options)=>{const response=await nativeFetch(url,options);if(url==='/api/intent'){const input=JSON.parse(options.body);evidence.receipts.push({at:performance.now(),text:input.text,decisions:input.context.decisions,status:response.status,requestId:response.headers.get('x-mistral-request-id'),response:await response.clone().json()});}return response;};
 const NativeContext=window.AudioContext;
 window.AudioContext=class extends NativeContext {constructor(...args){super(...args);evidence.contexts.push(this);}};
 navigator.mediaDevices.getUserMedia=async()=>{
  const ctx=new NativeContext();await ctx.resume();const dest=ctx.createMediaStreamDestination(),buffers={};
  for(const name of ['email','reset'])buffers[name]=await ctx.decodeAudioData(await (await nativeFetch(`/.verification/realtime-${name}.wav`)).arrayBuffer());
  window.syntheticFeed={ctx,dest,buffers};for(const track of dest.stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{evidence.trackStops++;stop();void ctx.close();};}return dest.stream;
 };
 window.playSyntheticSequence=()=>{const {ctx,dest,buffers}=window.syntheticFeed;const start=ctx.currentTime+.5;for(const [name,offset] of [['email',0],['reset',buffers.email.duration+6]]){const source=ctx.createBufferSource();source.buffer=buffers[name];source.connect(dest);source.start(start+offset);}return {emailDuration:buffers.email.duration,resetAtSeconds:buffers.email.duration+6};};
 document.querySelector('[role=switch]').addEventListener('click',()=>{evidence.switchClicks++;});
 window.voiceDomTimer=setInterval(()=>{evidence.dom.push({at:performance.now(),checked:document.querySelector('[role=switch]')?.getAttribute('aria-checked'),partial:document.querySelector('[data-testid=voice-partial]')?.textContent,heard:document.querySelector('[data-testid=voice-heard]')?.textContent,activity:document.querySelector('[data-testid=voice-activity]')?.textContent,result:document.querySelector('.voice-result')?.innerText,body:document.body.innerText});},250);
 return 'Synthetic audio ready; production PCM/provider/intent path unchanged';
})();
