// Protocol follows official mistralai/client-python extra/realtime/{connection,transcription}.py.
// Long-lived credentials and raw provider errors never cross the browser boundary.
export const REALTIME_MODEL='voxtral-mini-transcribe-realtime-2602';
export function allowedRealtimeOrigin(origin:string|undefined){
 const extras=(process.env.VOICE_ALLOWED_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean);
 return origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'||extras.includes(origin??'');
}
export type BridgeSocket={readyState:number;bufferedAmount:number;send:(data:string)=>void;close:(code?:number)=>void;terminate:()=>void;on:(event:string,listener:(...args:any[])=>void)=>unknown};
export function bridgeRealtime(browser:BridgeSocket,provider:BridgeSocket){
 let stopped=false,ready=false;
 const timeout=setTimeout(()=>finish(1011,'Realtime handshake timed out. Retry or type a command.'),10000);
 function finish(code=1000,message?:string){
  if(stopped)return;stopped=true;clearTimeout(timeout);
  if(message&&browser.readyState===1)browser.send(JSON.stringify({type:'error',message}));
  if(browser.readyState<2)browser.close(code);
  if(provider.readyState===0)provider.terminate();else if(provider.readyState===1)provider.close();
 }
 browser.on('close',()=>finish());browser.on('error',()=>finish());
 provider.on('error',()=>finish(1011,'Mistral realtime unavailable. Check key, quota and model access; retry or type a command.'));
 provider.on('close',(code:number)=>finish(code===1000?1011:code===1008?1008:1011));
 browser.on('message',(data:Buffer,isBinary:boolean)=>{
  if(stopped)return;
  if(!isBinary||data.length===0||data.length>6400||data.length%2){finish(1008,'Invalid PCM audio. No command applied.');return;}
  if(!ready||provider.readyState!==1)return;
  if(provider.bufferedAmount>128*1024){finish(1013,'Realtime audio backpressure. Retry with a stable connection.');return;}
  provider.send(JSON.stringify({type:'input_audio.append',audio:data.toString('base64')}));
 });
 provider.on('message',(bytes:Buffer)=>{
  if(stopped)return;
  try {
   const event=JSON.parse(bytes.toString());
   if(event.type==='session.created')provider.send(JSON.stringify({type:'session.update',session:{audio_format:{encoding:'pcm_s16le',sample_rate:16000},target_streaming_delay_ms:480}}));
   else if(event.type==='session.updated'){clearTimeout(timeout);ready=true;if(browser.readyState===1)browser.send(JSON.stringify({type:'ready',model:REALTIME_MODEL}));}
   else if(event.type==='transcription.text.delta'&&typeof event.text==='string'&&event.text.length<=2000){
    if(browser.bufferedAmount>128*1024){finish(1013);return;}
    if(ready&&browser.readyState===1)browser.send(JSON.stringify({type:'delta',text:event.text}));
   }else if(event.type==='error')finish(1008,'Mistral realtime rejected the session. Check server key, quota and model access. Microphone OFF.');
   else if(event.type==='transcription.done')finish(1011);
  }catch{finish(1011,'Invalid realtime provider response. No command applied.');}
 });
 return ()=>finish();
}
