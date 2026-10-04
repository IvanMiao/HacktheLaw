import { useEffect, useRef, useState } from 'react';
import { microphoneError, recordClip, requestJson, createOperationGuard, type Clip } from '../voice/client';
import { validateIntent, type Intent, type VoiceContext } from '../voice/contract';

const EXAMPLES = [
  'What if the 2022 email acknowledges the debt?',
  'Et si la conciliation avait été tentée avant l’assignation ?',
  'Show evidence for the conciliation clause',
  'Explain why C1 loses interruption',
  'Challenge the defence',
];
export function VoicePanel({ context, onIntent }: {context: VoiceContext; onIntent:(intent:Intent)=>string}) {
  const [zh, setZh] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Checking local voice server…');
  const [configured, setConfigured] = useState(false);
  const [phase, setPhase] = useState<'idle'|'permission'|'recording'|'transcribing'|'interpreting'>('idle');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const active = useRef<Clip | null>(null);
  const mounted = useRef(true);
  const guard = useRef(createOperationGuard());
  const request = useRef<AbortController | null>(null);
  const busy = phase !== 'idle';
  const label = (en:string, cn:string)=>zh?cn:en;
  async function check() {
    try {
      const data = await requestJson<{configured:boolean}>('/api/status');
      if (!mounted.current) return;
      setError('');
      setConfigured(data.configured);
      setStatus(data.configured ? 'Mistral ready · EN / FR / 中文 commands' : 'API key missing · original demo controls remain available');
    } catch(e) { if(mounted.current) { setConfigured(false); setStatus('Voice API offline'); setError((e as Error).message); } }
  }
  useEffect(()=>{
    const operationGuard = guard.current;
    mounted.current=true;
    void requestJson<{configured:boolean}>('/api/status').then(data=>{
      if (!mounted.current) return;
      setConfigured(data.configured);
      setStatus(data.configured ? 'Mistral ready · EN / FR / 中文 commands' : 'API key missing · original demo controls remain available');
    }).catch(e=>{if(mounted.current) {setStatus('Voice API offline');setError((e as Error).message);}});
    return ()=>{ mounted.current=false; operationGuard.cancel(); active.current?.cancel(); request.current?.abort(); };
  },[]);
  async function record() {
    const token=guard.current.begin(); const isLive=()=>mounted.current && guard.current.isCurrent(token);
    setError(''); setResult(''); setSources([]); setPhase('permission');
    let clip:Clip;
    try {
      clip = await recordClip();
      if (!isLive()) { void clip.result.catch(()=>{}); clip.cancel(); return; }
      active.current=clip; setPhase('recording');
    } catch(e) { if(isLive()) { setError(microphoneError(e)); setPhase('idle'); } return; }
    try {
      const audio = await clip.result;
      active.current=null;
      if(!isLive()) return;
      setPhase('transcribing'); request.current=new AbortController();
      const transcript=await requestJson<{text:string}>('/api/transcribe',{method:'POST',headers:{'Content-Type':audio.type},body:audio,signal:request.current.signal});
      if(isLive()) {setText(transcript.text);setStatus('Transcript ready · review/edit, then apply');}
    } catch(e) {if(isLive()) setError((e as Error).message);}
    finally {if(isLive()) setPhase('idle');}
  }
  async function submit() {
    const token=guard.current.begin(); const isLive=()=>mounted.current && guard.current.isCurrent(token);
    setPhase('interpreting'); setError(''); setResult(''); setSources([]); request.current=new AbortController();
    try {
      const data=await requestJson<{intent:unknown}>('/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,context}),signal:request.current.signal});
      if(!isLive()) return;
      const intent=validateIntent(data.intent,context);
      setResult(onIntent(intent));
      setSources(intent.sourceIds);
      setStatus(intent.action==='unsupported'?'Unsupported request · no changes':'Command applied · lawyer decisions unchanged');
    } catch(e) {if(isLive()) setError((e as Error).message);}
    finally {if(isLive()) setPhase('idle');}
  }
  const liveStatus = phase==='recording' ? label('Recording · stops at 15 seconds', '录音中 · 15 秒自动停止')
    : phase==='permission' ? label('Waiting for microphone permission…','等待麦克风授权…')
    : phase==='transcribing' ? label('Voxtral is transcribing the clip…','Voxtral 正在转写…')
    : phase==='interpreting' ? label('Mistral is interpreting your command…','Mistral 正在解析指令…') : status;
  return <section className="voice-panel" aria-label="Mistral voice command panel">
    <div className="voice-heading">
      <strong>{label('Command desk','语音指令台')} <span className="voice-provider mono">MISTRAL / VOXTRAL</span></strong>
      <span className={`voice-status ${phase==='recording'?'is-recording':''}`} role="status">{liveStatus}</span>
      <button className="linkish small" onClick={()=>setZh(v=>!v)} aria-label="Change command panel language">{zh?'English':'中文'}</button>
      <button className="linkish small" onClick={()=>void check()} disabled={busy}>{label('Check connection','检查连接')}</button>
    </div>
    <form className="voice-input" onSubmit={e=>{e.preventDefault();void submit();}}>
      <button type="button" className={`btn ${phase==='recording'?'danger':''}`} disabled={!configured || (busy && phase!=='recording')}
        onClick={()=>phase==='recording'?active.current?.stop():void record()}>
        {phase==='recording'?label('Stop recording','停止录音'):label('Start recording','开始录音')}
      </button>
      <button type="button" className="btn" disabled={!busy} onClick={()=>{guard.current.cancel();active.current?.cancel();active.current=null;request.current?.abort();setPhase('idle');setStatus('Cancelled · no changes made');setError('');}}>{label('Cancel','取消')}</button>
      <textarea aria-label="Voice command" rows={1} value={text} maxLength={2000} disabled={busy}
        onChange={e=>setText(e.target.value)} placeholder={label('Speak, then review — or type a command in EN / FR / 中文','录音后审核转写，或直接输入中文 / EN / FR 指令')} />
      <button type="submit" className="btn primary" disabled={!text.trim() || busy || !configured}>{label('Apply command','执行指令')}</button>
      <button type="button" className="btn" disabled={busy} onClick={()=>{setResult(onIntent({action:'reset_scenario',target:null,value:null,sourceIds:[]}));setSources([]);setError('');}}>{label('Restore scenario','恢复情景')}</button>
    </form>
    <details className="voice-help"><summary>{label('Try a command · privacy & safety','指令示例 · 隐私与安全')}</summary>
      <div className="voice-examples">{EXAMPLES.map(example=><button key={example} type="button" className="chip" disabled={busy} onClick={()=>setText(example)}>{example}</button>)}</div>
      <p>{label('Click Start recording to allow microphone access. A clip (max 15 s / 4 MB), its transcript and demo context are sent via your local server to Mistral. Transcription appears after Stop, not as a live stream. Review/edit before Apply. Do not use confidential client data.','点击开始录音后才申请麦克风权限。最多 15 秒 / 4 MB 的录音、转写和演示上下文经本地服务发送至 Mistral；停止录音后显示转写，并非实时流。执行前可审核编辑，请勿输入保密客户信息。')}</p>
      <p>{label('Previews are hypothetical only; voice never confirms/rejects legal facts. Explanations come from the deterministic demo engine. Sources retain real/mock labels.','预览仅为假设；语音不能确认或否定法律事实。解释来自确定性演示引擎，来源保留真实 / 模拟标记。')}</p>
    </details>
    {error && <p className="voice-error" role="alert">{error}</p>}
    {result && <div className="voice-result" aria-live="polite"><p>{result}</p>{sources.length>0 && <div className="chips">{sources.map(id=><button key={id} className="chip" onClick={()=>onIntent({action:'show_evidence',target:id,value:null,sourceIds:[id]})}>{id} · {context.sources.find(s=>s.id===id)?.provenance}</button>)}</div>}</div>}
  </section>;
}
