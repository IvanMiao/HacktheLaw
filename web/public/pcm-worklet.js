/* Mono PCM16 at 16 kHz. Weighted box resampling keeps fractional phase
 * across 128-frame render quanta, including devices at 44.1/48 kHz.
 * Output is silent: never route microphone audio back into the room. */
class DominoPcm extends AudioWorkletProcessor {
 constructor(){super();this.ratio=sampleRate/16000;this.remaining=this.ratio;this.sum=0;this.count=0;this.energy=0;this.bytes=new ArrayBuffer(640);this.view=new DataView(this.bytes);}
 process(inputs){
  const channels=inputs[0];if(!channels?.length)return true;
  for(let i=0;i<channels[0].length;i++){
   let value=0;for(const channel of channels)value+=channel[i];value/=channels.length;
   let weight=1;
   while(weight>1e-9){
    const part=Math.min(weight,this.remaining);this.sum+=value*part;this.remaining-=part;weight-=part;
    if(this.remaining<1e-9){
     const sample=Math.max(-1,Math.min(1,this.sum/this.ratio));this.energy+=sample*sample;
     this.view.setInt16(this.count*2,Math.round(sample<0?sample*32768:sample*32767),true);this.count++;
     this.sum=0;this.remaining=this.ratio;
     if(this.count===320){this.port.postMessage({pcm:this.bytes,rms:Math.sqrt(this.energy/320)},[this.bytes]);this.bytes=new ArrayBuffer(640);this.view=new DataView(this.bytes);this.count=0;this.energy=0;}
    }
   }
  }
  return true;
 }
}
registerProcessor('domino-pcm',DominoPcm);
