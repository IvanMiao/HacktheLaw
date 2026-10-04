import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { requestJson } from '../voice/client';
import { IntentQueue, listenRealtime, type ListenState, type RealtimeDiagnostic } from '../voice/realtime';
import { validateIntent, type Intent, type VoiceContext } from '../voice/contract';
import type { ReactNode } from 'react';
import { useLocale } from '../i18n/useLocale';
import './VoicePanel.css';
export function OffOnlyFallback({listening,children}:{listening:boolean;children:ReactNode}){return listening?null:children;}


const EXAMPLES = ['What if the 2022 email acknowledges the debt?', 'Et si la conciliation avait été tentée avant l’assignation ?', 'Show evidence for the conciliation clause', 'Reset the scenario'];
export function VoicePanel({ context, onIntent }: {context:VoiceContext;onIntent:(intent:Intent)=>string}) {
 const [zh,setZh]=useState(false),[text,setText]=useState(''),[partial,setPartial]=useState('');
 const [configured,setConfigured]=useState(false),[connection,setConnection]=useState('Checking local voice server…');
 const [listening,setListening]=useState(false),[state,setState]=useState<ListenState>('off');
 const [diagnostic,setDiagnostic]=useState<RealtimeDiagnostic|null>(null),[counts,setCounts]=useState({queued:0,executing:0,answered:0,error:0});
 const [activity,setActivity]=useState('Ready'),[heard,setHeard]=useState(''),[result,setResult]=useState(''),[error,setError]=useState(''),[sources,setSources]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const mounted=useRef(true),latest=useRef({context,onIntent});
 const inputRef=useRef<HTMLInputElement>(null);
 useLayoutEffect(()=>{latest.current={context,onIntent};},[context,onIntent]);
 const live=useRef<{stop:()=>void}|null>(null),queue=useRef<IntentQueue<Intent>|null>(null);
 const label=(en:string,cn:string)=>zh?cn:en;
 async function check(){try{const data=await requestJson<{configured:boolean}>('/api/status');if(!mounted.current)return;setConfigured(data.configured);setConnection(data.configured?'Voxtral realtime ready':'API key missing · voice commands unavailable');setError('');}catch(e){if(mounted.current){setConfigured(false);setConnection('Voice API offline');setError((e as Error).message);}}}
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
 function submit(){if(!text.trim()||listening||busy||!configured)return;setError('');newQueue().push(text.trim());setText('');}
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.metaKey||event.ctrlKey||event.altKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)return;
   if(event.key.toLowerCase()==='v'&&configured){event.preventDefault();toggle();}
   else if(event.key==='/'&&!listening){event.preventDefault();inputRef.current?.focus();}
   else if(event.key==='Escape'&&listening){event.preventDefault();cancel();}
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 });
 const status=state==='permission'?'Microphone ON · awaiting permission':state==='connecting'?'Microphone ON · connecting realtime':state==='listening'?diagnostic?.calibrated?'Microphone ON · continuously listening':'Microphone ON · calibrating ambient noise (keep quiet)':state==='reconnecting'?'Microphone ON · reconnecting (speech not sent)':state==='failed'?'Microphone OFF · failed':`Microphone OFF · ${connection}`;
 const deskState=!configured?'offline':listening?(busy?'pending':'listening'):'idle';
 const level=Math.min(1,(diagnostic?.rms??0)*12);
 return <section className="voice-panel" data-state={deskState} aria-label="Mistral voice command panel">
  <form className="voice-bar" onSubmit={e=>{e.preventDefault();submit();}}>
   <button className="voice-orb" type="button" role="switch" aria-label="Continuous listening" aria-checked={listening} disabled={!configured&&!listening} onClick={toggle} style={{'--voice-level':level} as CSSProperties}>
    <span className="voice-ring first"/><span className="voice-ring second"/><span className="voice-off-dot"/>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
   </button>
   <div className="voice-field">
    <OffOnlyFallback listening={listening}><input ref={inputRef} aria-label="Voice command" autoComplete="off" value={text} maxLength={2000} disabled={busy} onChange={e=>setText(e.target.value)} placeholder={label('Say or type a command…','说出或输入指令…')} /></OffOnlyFallback>
    <OffOnlyFallback listening={listening}><button className="voice-send" type="submit" aria-label={label('Run typed command','执行文字指令')} disabled={!text.trim()||busy||!configured}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></OffOnlyFallback>
    {listening&&<div className="voice-listening" aria-live="polite"><div className="voice-wave" aria-hidden="true">{Array.from({length:22},(_,i)=><i key={i} style={{height:`${Math.max(3,3+26*level*(.45+.55*Math.sin(i/21*Math.PI))*(.55+.45*Math.sin(i*1.7+(diagnostic?.pcmFrames??0)*.08)))}px`}}/>)}</div><span className="voice-transcript" data-testid="voice-partial">{partial||(state==='listening'?label('Listening… say a command, then pause','正在聆听…说出指令后停顿'):status)}<i/></span>{busy&&<button className="voice-cancel" type="button" onClick={cancel}>{label('Cancel','取消')} <kbd>Esc</kbd></button>}</div>}
   </div>
   <div className="voice-side"><select className="voice-language" aria-label="Change command panel language" value={zh?'zh':'en'} onChange={e=>setZh(e.target.value==='zh')}><option value="en" lang="en">English</option><option value="zh" lang="zh">中文</option></select><span className="voice-connection" role="status"><i/>{configured?label('Voxtral realtime','Voxtral 实时') : label('Voice offline','语音离线')}</span>
    <details className="voice-details" data-testid="voice-diagnostics"><summary aria-label={label('Voice details','语音详情')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></summary><div className="voice-popover"><h3>{label('Pipeline diagnostics','流水线诊断')}</h3><div className="voice-pipeline"><span>mic</span><i/><span>Voxtral</span><i/><span>intent</span><i/><span>rules engine</span></div><div className="voice-stats"><div><b>{counts.executing}</b><span>{label('requests','请求')}</span></div><div><b>{counts.answered}</b><span>{label('responses applied','已执行')}</span></div><div><b>{counts.error}</b><span>{label('errors','错误')}</span></div></div><p className="mono">PCM {diagnostic?.pcmFrames||0} · partial deltas {diagnostic?.partialDeltas||0} · utterances {diagnostic?.utterances||0} · queued {counts.queued} · {diagnostic?.waiting||'off'}</p><p className="mono">RMS {diagnostic?.rms.toFixed(4)||'—'} · noise floor {diagnostic?.noiseFloor.toFixed(4)||'—'} · speech threshold {diagnostic?.threshold.toFixed(4)||'—'} · acoustic quiet {diagnostic?.acousticQuietMs??'—'} ms · text stable {diagnostic?.transcriptStableMs??'—'} ms</p><p>{label('Diagnostics stay local; no audio or credentials logged.','诊断信息仅保留本地，不记录音频或密钥。')}</p><div className="voice-popover-actions"><button type="button" onClick={()=>{setResult(onIntent({action:'reset_scenario',target:null,value:null,sourceIds:[]}));setSources([]);}}>{label('Restore scenario','恢复情景')}</button><button type="button" disabled={listening||busy} onClick={()=>void check()}>{label('Check connection','检查连接')}</button></div></div></details>
   </div>
  </form>
  <div className="voice-under" aria-live="polite">
   {result?<div className="voice-receipt"><span className="voice-receipt-icon">✓</span><div><strong>{result}</strong><small data-testid="voice-heard">{heard&&`${label('Heard','已听到')}: “${heard}”`}</small>{sources.length>0&&<div className="voice-source-links">{sources.map(id=><button type="button" key={id} onClick={()=>onIntent({action:'show_evidence',target:id,value:null,sourceIds:[id]})}>{id} · {context.sources.find(s=>s.id===id)?.provenance}</button>)}</div>}</div><button type="button" aria-label={label('Dismiss','关闭')} onClick={()=>setResult('')}>×</button></div>
   :!configured?<div className="voice-offline"><strong>{label('Voice server offline.','语音服务离线。')}</strong><span>{label('Start the local server and configure its API key to use voice or typed commands.','启动本地服务并配置 API key 后，才能使用语音或文字指令。')}</span><code>npm run voice:server</code><button type="button" disabled={listening||busy} onClick={()=>void check()}>{label('Retry','重试')}</button></div>
   :<div className="voice-hint"><kbd>V</kbd> {label('talk','说话')} · <kbd>/</kbd> {label('type','输入')} · {label('pause to run','停顿后执行')} · <kbd>Esc</kbd> {label('cancel','取消')}</div>}
  </div>
  <div className="voice-assist"><span className="sr-only" data-testid="voice-activity">{activity}</span><span className="sr-only">{status}</span></div>
  {error&&<p className="voice-error" role="alert">{error}</p>}
  <details className="voice-help"><summary>{label('Try a command · privacy & safety','指令示例 · 隐私与安全')}</summary><div className="voice-examples">{EXAMPLES.map(example=><button key={example} type="button" className="chip" disabled={listening||busy} onClick={()=>setText(example)}>{example}</button>)}</div><p>{label('Turn ON to stream microphone PCM continuously through your local server to Mistral realtime. Pause after a complete command: navigation, explanations and hypothetical previews execute automatically. OFF immediately releases the microphone and discards pending commands. No audio uploads or TTS feedback. Do not use confidential client data.','打开后，麦克风 PCM 音频经本地服务持续流向 Mistral 实时转写。完整指令后停顿，导航、解释和假设预览自动执行。关闭立即释放麦克风并丢弃待处理指令。请勿使用保密客户信息。')}</p><p>{label('Previews are hypothetical only; voice never confirms/rejects legal facts. Explanations come from the deterministic demo engine. Sources retain real/mock labels.','预览仅为假设；语音不能确认或否定法律事实。解释来自确定性演示引擎，来源保留真实 / 模拟标记。')}</p></details>
 </section>;
}

export function DisabledVoicePanel() {
  const { t } = useLocale();
  return <section className="voice-panel voice-disabled" aria-label={t('Voice commands')}>
    <p>{t('Voice commands are available for the demo cases only.')}</p>
  </section>;
}
