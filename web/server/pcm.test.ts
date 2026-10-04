import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect,it } from 'vitest';
function processor(rate:number){
 let Processor:any;
 class Base {port={postMessage:(_frame:any)=>{}};}
 runInNewContext(readFileSync(new URL('../public/pcm-worklet.js',import.meta.url),'utf8'),{sampleRate:rate,AudioWorkletProcessor:Base,registerProcessor:(_name:string,p:any)=>{Processor=p;},Int16Array,ArrayBuffer,DataView,Math});
 return new Processor();
}
it('resamples real AudioWorklet PCM to 16k mono, preserves fractional phase across render quanta and emits signed little endian',()=>{
 for(const rate of [16000,44100,48000]){
  const p=processor(rate),frames:any[]=[];p.port.postMessage=(frame:any)=>frames.push(frame);
  let n=0;while(n<rate){const len=Math.min(128,rate-n);p.process([[new Float32Array(len).fill(.5)]]);n+=len;}
  expect(frames.length).toBe(50);expect(frames.reduce((sum,f)=>sum+f.pcm.byteLength,0)).toBe(32000);
  expect(new DataView(frames[0].pcm).getInt16(0,true)).toBe(16384);expect(frames[0].rms).toBeCloseTo(.5);
 }
});
it('silent render quanta do not fabricate speech; negative samples encode correctly',()=>{
 const p=processor(16000),frames:any[]=[];p.port.postMessage=(frame:any)=>frames.push(frame);
 p.process([[new Float32Array(320)]]);expect(frames[0].rms).toBe(0);
 p.process([[new Float32Array(320).fill(-1)]]);expect(new DataView(frames[1].pcm).getInt16(0,true)).toBe(-32768);
});
