import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { requestJson } from '../voice/client';
import { IntentQueue, listenRealtime, type ListenState, type RealtimeDiagnostic } from '../voice/realtime';
import { validateIntent, type Intent, type VoiceContext } from '../voice/contract';
import type { ReactNode } from 'react';
export function OffOnlyFallback({listening,children}:{listening:boolean;children:ReactNode}){return listening?null:children;}


const EXAMPLES = ['What if the 2022 email acknowledges the debt?', 'Et si la conciliation avait été tentée avant l’assignation ?', 'Show evidence for the conciliation clause', 'Reset the scenario'];
export function VoicePanel({ context, onIntent }: {context:VoiceContext;onIntent:(intent:Intent)=>string}) {
 const [zh,setZh]=useState(false),[text,setText]=useState(''),[partial,setPartial]=useState('');
 const [configured,setConfigured]=useState(false),[connection,setConnection]=useState('Checking local voice server…');
 const [listening,setListening]=useState(false),[state,setState]=useState<ListenState>('off');
 const [diagnostic,setDiagnostic]=useState<RealtimeDiagnostic|null>(null),[counts,setCounts]=useState({queued:0,executing:0,answered:0,error:0});
 const [activity,setActivity]=useState('Ready'),[heard,setHeard]=useState(''),[result,setResult]=useState(''),[error,setError]=useState(''),[sources,setSources]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const mounted=useRef(true),latest=useRef({context,onIntent});
 useLayoutEffect(()=>{latest.current={context,onIntent};},[context,onIntent]);
 const live=useRef<{stop:()=>void}|null>(null),queue=useRef<IntentQueue<Intent>|null>(null);
 const label=(en:string,cn:string)=>zh?cn:en;
 async function check(){try{const data=await requestJson<{configured:boolean}>('/api/status');if(!mounted.current)return;setConfigured(data.configured);setConnection(data.configured?'Mistral realtime ready · EN / FR / 中文':'API key missing · typed/manual demo controls remain available');setError('');}catch(e){if(mounted.current){setConfigured(false);setConnection('Voice API offline');setError((e as Error).message);}}}
 useEffect(()=>{mounted.current=true;void Promise.resolve().then(()=>check());return()=>{mounted.current=false;queue.current?.cancel();live.current?.stop();};},[]);
 function cancel(){queue.current?.cancel();queue.current=null;live.current?.stop();live.current=null;setListening(false);setState('off');setBusy(false);setPartial('');setActivity('Cancelled · pending commands discarded');}
 function newQueue(){
  queue.current?.cancel();
  const q=new IntentQueue<Intent>(async(command,signal)=>{
   const snapshot=latest.current.context;
   const data=await requestJson<{intent:unknown}>('/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:command,context:snapshot}),signal:AbortSignal.any([signal,AbortSignal.timeout(40_000)])});
   return validateIntent(data.intent,snapshot);
  },intent=>{if(!mounted.current)return;flushSync(()=>{setResult(latest.current.onIntent(intent));setSources(intent.sourceIds);setError('');});},e=>{if(mounted.current){setError((e as Error).message);setActivity('Command failed · no changes');setBusy(false);}},(phase,command)=>{if(mounted.current){setCounts(c=>({...c,[phase]:c[phase]+1}));setHeard(command);if(phase!=='queued'){setActivity(phase==='executing'?'Executing · Mistral intent':phase==='answered'?'Answered · lawyer decisions unchanged':'Command failed · no changes');setBusy(phase==='executing');}}});
  queue.current=q;return q;
 }
 function toggle(){
  if(listening){cancel();return;}setError('');setListening(true);setDiagnostic(null);setCounts({queued:0,executing:0,answered:0,error:0});setActivity('Waiting for speech');const q=newQueue();
  live.current=listenRealtime({onState:s=>{if(!mounted.current)return;setState(s);if(s==='failed'){q.cancel();setListening(false);setBusy(false);}},onPartial:value=>{if(mounted.current)setPartial(value);},onUtterance:command=>{if(!mounted.current)return;setHeard(command);setActivity('Heard · endpoint detected');q.push(command);},onDiagnostic:value=>{if(mounted.current)setDiagnostic(value);},onError:value=>{if(mounted.current){setError(value);setCounts(c=>({...c,error:c.error+1}));}}});
 }
 function submit(){if(!text.trim()||listening||busy)return;setError('');newQueue().push(text.trim());}
 const status=state==='permission'?'Microphone ON · awaiting permission':state==='connecting'?'Microphone ON · connecting realtime':state==='listening'?diagnostic?.calibrated?'Microphone ON · continuously listening':'Microphone ON · calibrating ambient noise (keep quiet)':state==='reconnecting'?'Microphone ON · reconnecting (speech not sent)':state==='failed'?'Microphone OFF · failed':`Microphone OFF · ${connection}`;
 return <section className="voice-panel" aria-label="Mistral voice command panel">
  <div className="voice-heading"><strong>{label('Command desk','语音指令台')} <span className="voice-provider mono">MISTRAL / VOXTRAL REALTIME</span></strong><span className={`voice-status ${listening?'is-recording':''}`} role="status">{status}</span><button className="linkish small" onClick={()=>setZh(v=>!v)} aria-label="Change command panel language">{zh?'English':'中文'}</button><button className="linkish small" disabled={listening||busy} onClick={()=>void check()}>{label('Check connection','检查连接')}</button></div>
  <div className="voice-input"><button type="button" role="switch" aria-label="Continuous listening" aria-checked={listening} className={`btn ${listening?'danger':'primary'}`} disabled={!configured&&!listening} onClick={toggle}>{label('Continuous listening','持续聆听')} · {listening?'ON':'OFF'}</button><button className="btn" type="button" disabled={!listening&&!busy} onClick={cancel}>{label('Cancel','取消')}</button><span className="voice-provider">{label('Pause to execute automatically · no Apply needed','停顿后自动执行 · 无需手动确认')}</span></div>
  <div className="voice-live" aria-live="polite"><div><strong>{label('Partial transcript','实时转写')}</strong>: <span data-testid="voice-partial">{partial||'—'}</span></div><div><strong>{label('Heard','已听到')}</strong>: <span data-testid="voice-heard">{heard||'—'}</span></div><div data-testid="voice-activity">{activity}</div></div>
  <details className="voice-help" data-testid="voice-diagnostics"><summary>{label('Pipeline diagnostics','流水线诊断')} · {diagnostic?.waiting||'off'} · {label('requests','请求')} {counts.executing} / {label('responses applied','响应已执行')} {counts.answered}</summary><div className="mono">PCM {diagnostic?.pcmFrames||0} · partial deltas {diagnostic?.partialDeltas||0} · utterances {diagnostic?.utterances||0} · queued {counts.queued} · requests {counts.executing} · responses/applied {counts.answered} · errors {counts.error}</div><div className="mono">RMS {diagnostic?.rms.toFixed(4)||'—'} · noise floor {diagnostic?.noiseFloor.toFixed(4)||'—'} · speech threshold {diagnostic?.threshold.toFixed(4)||'—'} · acoustic quiet {diagnostic?.acousticQuietMs??'—'} ms / 1400 · text stable {diagnostic?.transcriptStableMs??'—'} ms / 1100</div><p>{label('Calibrate quietly for 0.6 s. Stable text blocked by continuing audio is discarded with an error after 8 s, never forced into a command. Diagnostics stay local; no audio or credentials logged.','安静校准 0.6 秒。持续噪声阻塞稳定转写超过 8 秒时，明确报错并丢弃，不会强制执行。诊断仅保留在本地，不记录音频或密钥。')}</p></details>
  <OffOnlyFallback listening={listening}><form className="voice-input" onSubmit={e=>{e.preventDefault();submit();}}><textarea aria-label="Voice command" rows={1} value={text} maxLength={2000} disabled={listening||busy} onChange={e=>setText(e.target.value)} placeholder={label('Typed fallback · turn listening OFF to type','文字备用 · 关闭聆听后输入')} /><button type="submit" className="btn" disabled={!text.trim()||listening||busy||!configured}>{label('Send typed command','发送文字指令')}</button><button type="button" className="btn" disabled={busy} onClick={()=>{setResult(onIntent({action:'reset_scenario',target:null,value:null,sourceIds:[]}));setSources([]);}}>{label('Restore scenario','恢复情景')}</button></form></OffOnlyFallback>
  <details className="voice-help"><summary>{label('Try a command · privacy & safety','指令示例 · 隐私与安全')}</summary><div className="voice-examples">{EXAMPLES.map(example=><button key={example} type="button" className="chip" disabled={listening||busy} onClick={()=>setText(example)}>{example}</button>)}</div><p>{label('Turn ON to stream microphone PCM continuously through your local server to Mistral realtime. Pause after a complete command: navigation, explanations and hypothetical previews execute automatically. OFF immediately releases the microphone and discards pending commands. No audio uploads or TTS feedback. Do not use confidential client data.','打开后，麦克风 PCM 音频经本地服务持续流向 Mistral 实时转写。完整指令后停顿，导航、解释和假设预览自动执行。关闭立即释放麦克风并丢弃待处理指令。请勿使用保密客户信息。')}</p><p>{label('Previews are hypothetical only; voice never confirms/rejects legal facts. Explanations come from the deterministic demo engine. Sources retain real/mock labels.','预览仅为假设；语音不能确认或否定法律事实。解释来自确定性演示引擎，来源保留真实 / 模拟标记。')}</p></details>
  {error&&<p className="voice-error" role="alert">{error}</p>}{result&&<div className="voice-result" aria-live="polite"><p>{result}</p>{sources.length>0&&<div className="chips">{sources.map(id=><button key={id} className="chip" onClick={()=>onIntent({action:'show_evidence',target:id,value:null,sourceIds:[id]})}>{id} · {context.sources.find(s=>s.id===id)?.provenance}</button>)}</div>}</div>}
 </section>;
}
