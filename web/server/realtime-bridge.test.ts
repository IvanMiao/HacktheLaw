import { EventEmitter } from 'node:events';
import { expect,it,vi } from 'vitest';
import { bridgeRealtime, REALTIME_MODEL, allowedRealtimeOrigin } from './realtime-bridge';
class Socket extends EventEmitter {
 readyState=1;bufferedAmount=0;sent:string[]=[];close=vi.fn((code?:number)=>{this.readyState=3;this.emit('close',code??1000);});terminate=vi.fn(()=>this.close(1006));
 send(value:string){this.sent.push(value);}
}
it('waits for official session.created/session.updated handshake before forwarding PCM as input_audio.append',()=>{
 const browser=new Socket(),provider=new Socket();const dispose=bridgeRealtime(browser,provider);
 browser.emit('message',Buffer.alloc(640),true);expect(provider.sent).toEqual([]);
 provider.emit('message',Buffer.from(JSON.stringify({type:'session.created',session:{request_id:'safe-id'}})));
 expect(JSON.parse(provider.sent[0])).toEqual({type:'session.update',session:{audio_format:{encoding:'pcm_s16le',sample_rate:16000},target_streaming_delay_ms:480}});
 provider.emit('message',Buffer.from('{"type":"session.updated"}'));
 expect(JSON.parse(browser.sent[0])).toEqual({type:'ready',model:REALTIME_MODEL});
 browser.emit('message',Buffer.from([0,1,2,3]),true);
 expect(JSON.parse(provider.sent[1])).toEqual({type:'input_audio.append',audio:Buffer.from([0,1,2,3]).toString('base64')});
 provider.emit('message',Buffer.from('{"type":"transcription.text.delta","text":"Reset"}'));
 expect(JSON.parse(browser.sent[1])).toEqual({type:'delta',text:'Reset'});dispose();
});
it('OFF closes upstream immediately and never forwards late transcript or provider secrets',()=>{
 const browser=new Socket(),provider=new Socket();bridgeRealtime(browser,provider);browser.emit('close',1000);
 expect(provider.close).toHaveBeenCalled();provider.emit('message',Buffer.from('{"type":"transcription.text.delta","text":"late"}'));expect(browser.sent).toEqual([]);
});
it('invalid/non-PCM frames and backpressure fail closed',()=>{
 for(const [bytes,binary] of [[Buffer.alloc(3),true],[Buffer.alloc(6401),true],[Buffer.from('arbitrary provider commands'),false]] as const){const b=new Socket(),p=new Socket();bridgeRealtime(b,p);b.emit('message',bytes,binary);expect(b.close).toHaveBeenCalledWith(1008);expect(p.sent).toEqual([]);}
 const b=new Socket(),p=new Socket();bridgeRealtime(b,p);p.bufferedAmount=200000;p.emit('message',Buffer.from('{"type":"session.updated"}'));b.emit('message',Buffer.alloc(640),true);expect(b.close).toHaveBeenCalledWith(1013);
});
it('sanitizes upstream errors and closes both sockets; timeout is bounded',()=>{
 vi.useFakeTimers();const b=new Socket(),p=new Socket();bridgeRealtime(b,p);p.emit('message',Buffer.from('{"type":"error","error":{"message":"secret key private diagnostic"}}'));
 expect(b.sent.join('')).not.toContain('secret');expect(b.close).toHaveBeenCalled();expect(p.close).toHaveBeenCalled();
 const b2=new Socket(),p2=new Socket();bridgeRealtime(b2,p2);vi.advanceTimersByTime(10001);expect(b2.close).toHaveBeenCalledWith(1011);expect(p2.close).toHaveBeenCalled();vi.useRealTimers();
});
it('rejects cross-origin or missing-origin requests; provider/model is never client-selectable',()=>{
 expect(allowedRealtimeOrigin('http://localhost:5173')).toBe(true);expect(allowedRealtimeOrigin('http://127.0.0.1:5173')).toBe(true);
 for(const origin of [undefined,'null','https://attacker.test','http://localhost:9999'])expect(allowedRealtimeOrigin(origin)).toBe(false);
 expect(REALTIME_MODEL).toBe('voxtral-mini-transcribe-realtime-2602');
});
it('accepts comma-separated VOICE_ALLOWED_ORIGINS for realtime upgrades',()=>{
 const previous=process.env.VOICE_ALLOWED_ORIGINS;
 process.env.VOICE_ALLOWED_ORIGINS='https://demo.example, https://review.example ';
 try{
  expect(allowedRealtimeOrigin('https://demo.example')).toBe(true);
  expect(allowedRealtimeOrigin('https://review.example')).toBe(true);
  expect(allowedRealtimeOrigin('https://attacker.test')).toBe(false);
 }finally{
  if(previous===undefined)delete process.env.VOICE_ALLOWED_ORIGINS;else process.env.VOICE_ALLOWED_ORIGINS=previous;
 }
});
