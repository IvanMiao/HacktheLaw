import { useLocale } from '../i18n/useLocale';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentEvent, CaseBundle } from '../data/bundle';
import { analyse, initialState } from '../engine/chains';
import { english } from '../i18n/translate';
import aiBundleJson from '../../../data/sample-case/ai-bundle.json';
import { LanguageSwitch } from './LanguageSwitch';
import { FilmIntro } from './FilmIntro';
import { ConnectionsButton } from './Connections';
import './StartScreen.css';

const aiBundle = aiBundleJson as unknown as CaseBundle;
type StreamLine = { type: 'event'; event: AgentEvent } | { type: 'bundle'; bundle: CaseBundle } | { type: 'error'; message: string };
type Props = {
  loading: boolean;
  onLoad: () => void;
  onDone: () => void;
  onError: (message: string) => void;
  onFallback: (message: string) => void;
  onReference: () => void;
  error?: string;
  onBundle?: (bundle: CaseBundle) => void;
  onConnections?: () => void;
};

async function encodeFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { name: file.name, mime: file.type || 'application/octet-stream', base64: btoa(binary) };
}

export function StartScreen({ loading, onLoad, onDone, onError, onFallback, onReference, error, onBundle, onConnections }: Props) {
  const { t } = useLocale();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resultBundle, setResultBundle] = useState<CaseBundle | null>(null);
  const [revealStep, setRevealStep] = useState(-1);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [live, setLive] = useState({ files: [] as string[], docs: [] as string[], facts: 0 });
  const liveCounts = useRef([0, 0]);
  const [floorPhase, setFloorPhase] = useState<'idle' | 'scan' | 'cascade' | 'settled'>('idle');
  const [showVerdict, setShowVerdict] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastInput = useRef<{ sample: true; fresh?: boolean } | { files: File[] }>({ sample: true });

  const result = useMemo(() => {
    if (!resultBundle) return null;
    const analysis = analyse(resultBundle, initialState(resultBundle), english);
    const chains = analysis.chains.filter((chain) => chain.status !== 'not_applicable');
    return {
      pendingReview: resultBundle.qualifications.filter((q) => q.source === 'ai_inferred').length,
      targets: [
        resultBundle.docs.length,
        resultBundle.facts.filter((fact) => fact.verified && fact.anchors.some((anchor) => anchor.verified !== false)).length,
        new Set(chains.flatMap((chain) => chain.links.map((link) => link.rule).filter(Boolean))).size,
        chains.length,
      ],
    };
  }, [resultBundle]);
  const finding = useMemo(() => resultBundle
    ? analyse(resultBundle, initialState(resultBundle), t).chains.find((chain) => chain.status === 'holds' || chain.status === 'contested')
    : undefined, [resultBundle, t]);
  const targets = result?.targets;

  useEffect(() => {
    if (!resultBundle || !targets) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));
    const reveal = async () => {
      setFloorPhase('scan');
      const start = [...liveCounts.current, 0, 0];
      setCounts(start);
      for (let step = 0; step < 4 && !cancelled; step++) {
        setRevealStep(step);
        const target = targets[step];
        const frames = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 20;
        for (let frame = 1; frame <= frames && !cancelled; frame++) {
          setCounts((previous) => previous.map((value, index) => index === step ? Math.round(start[step] + (target - start[step]) * frame / frames) : value));
          await wait(32);
        }
        if (step === 2) setFloorPhase('cascade');
        await wait(step === 3 ? 400 : 160);
      }
      if (!cancelled) {
        await wait(1750);
        if (!cancelled) { setFloorPhase('settled'); setShowVerdict(true); }
      }
    };
    void reveal();
    return () => { cancelled = true; };
  }, [resultBundle, targets]);

  const trackLive = (event: AgentEvent) => {
    const read = event.stage === 'ingest' && event.kind === 'tool' ? /^read (.+)$/.exec(event.text)?.[1] : undefined;
    const doc = event.stage === 'extract' ? /^read_document (\S+)/.exec(event.text)?.[1] : undefined;
    const fact = event.stage === 'extract' && /^record_fact\b.*✓$/.test(event.text);
    if (!read && !doc && !fact) return;
    setLive((current) => ({
      files: read && !current.files.includes(read) ? [...current.files, read] : current.files,
      docs: doc && !current.docs.includes(doc) ? [...current.docs, doc] : current.docs,
      facts: current.facts + (fact ? 1 : 0),
    }));
  };

  const liveValues = [live.files.length || live.docs.length, live.facts];
  useEffect(() => {
    liveCounts.current = [live.files.length || live.docs.length, live.facts];
  }, [live]);

  const addFiles = (incoming: FileList | null) => {
    if (incoming?.length) setFiles((current) => [...current, ...Array.from(incoming)]);
  };

  const run = async (input: { sample: true; fresh?: boolean } | { files: File[] }) => {
    lastInput.current = input;
    setBusy(true);
    setEvents([]);
    setResultBundle(null);
    setRevealStep(-1);
    setCounts([0, 0, 0, 0]);
    setLive({ files: [], docs: [], facts: 0 });
    liveCounts.current = [0, 0];
    setFloorPhase('idle');
    setShowVerdict(false);
    onLoad();
    try {
      if ('sample' in input && !input.fresh) {
        onBundle?.({ ...aiBundle, origin: 'cached' });
        onDone();
        return;
      }
      const payload = 'sample' in input
        ? { sample: true, ...(input.fresh ? { fresh: true } : {}) }
        : { files: await Promise.all(input.files.map(encodeFile)) };
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error('Streaming responses are unavailable in this browser');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      let receivedBundle: CaseBundle | undefined;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const item = JSON.parse(line) as StreamLine;
        if (item.type === 'event') {
          setEvents((previous) => [...previous, item.event].slice(-100));
          trackLive(item.event);
        }
        else if (item.type === 'error') throw new Error(item.message);
        else receivedBundle = item.bundle;
      };
      while (true) {
        const { value, done } = await reader.read();
        buffered += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        lines.forEach(consume);
        if (done) break;
      }
      consume(buffered);
      if (!receivedBundle) throw new Error('The pipeline ended without returning a case bundle');
      setResultBundle(receivedBundle);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if ('sample' in input) {
        setResultBundle({ ...aiBundle, origin: 'cached' });
        onFallback(message);
      } else onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`start landing${loading ? ' landing-loading' : ''} landing-floor-${floorPhase}`}>
      {!loading && <FilmIntro />}
      <header className="landing-top">
        <div className="landing-eyebrow"><i aria-hidden="true" />{t('French civil procedure')}</div>
        <div className="landing-actions">
          {onConnections && <ConnectionsButton onClick={onConnections} />}
          <LanguageSwitch />
        </div>
      </header>
      <div className="landing-center"><div className="landing-col">
        <div className="landing-brand">
          <svg className="landing-logo" viewBox="0 0 46 68" aria-hidden="true">
            <rect x="2" y="2" width="42" height="64" rx="9" />
            <line x1="12" y1="34" x2="34" y2="34" />
            <circle className="risk" cx="23" cy="18" r="4.2" />
            <circle cx="16" cy="45" r="4" />
            <circle cx="30" cy="56" r="4" />
          </svg>
          <h1>Domino</h1>
        </div>
        <p className="landing-tagline">{t('Find the domino that')} <em>{t('knocks out')}<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 50 3, 110 3, 198 7" /></svg></em> {t('the claim.')}</p>
        {!loading ? (
          <div className="landing-stage">
            <input
              ref={fileInput}
              className="landing-file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.eml,image/*"
              onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
            />
            <div
              className={`landing-drop${dragOver ? ' over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={t('Drop a case file')}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.current?.click(); } }}
              onDragEnter={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }}
              onDrop={(event) => { event.preventDefault(); setDragOver(false); addFiles(event.dataTransfer.files); }}
            >
              <span className="landing-upload-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0-4 4m4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span>
              <h2>{dragOver ? t('Release to add to the case') : t('Drop a case file')}</h2>
              <p>{t('or click to browse your computer')}</p>
              <div className="landing-kinds" aria-hidden="true">{['PDF', 'DOCX', 'TXT', 'MD', 'EML', 'IMG'].map((kind) => <span key={kind}>{kind}</span>)}</div>
              {files.length > 0 && <div className="landing-files">{files.map((file, index) => <span className="landing-chip" key={`${file.name}-${index}`}><b title={file.name}>{file.name}</b><small>{file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${Math.round(file.size / 1024)} KB` : `${(file.size / 1048576).toFixed(1)} MB`}</small><button type="button" aria-label={`${t('Remove')} ${file.name}`} onClick={(event) => { event.stopPropagation(); setFiles((current) => current.filter((_, i) => i !== index)); }}>×</button></span>)}</div>}
            </div>
            {error && <p className="callout amber" role="alert">{error}</p>}
            <button className="landing-cta" onClick={() => void run(files.length ? { files } : { sample: true, fresh })} disabled={busy}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/></svg>
              <span>{files.length ? t('Analyze uploaded files') : t('Analyse sample case with AI')}</span>
              <span className="landing-arrow" aria-hidden="true">→</span>
            </button>
            <div className="landing-options">
              <label className="landing-fresh"><input type="checkbox" checked={fresh} onChange={(event) => setFresh(event.target.checked)} disabled={files.length > 0} /><span className="landing-switch" />{t('Fresh run (calls the model)')}<span className="landing-live">LIVE</span></label>
              <button className="landing-reference" onClick={() => { onReference(); onDone(); }}>{t('Open hand-checked reference')} <span aria-hidden="true">↗</span></button>
            </div>
          </div>
        ) : (
          <div className={`landing-run${showVerdict ? ' finished' : ''}`} aria-live="polite">
            <div className="landing-run-head"><strong>{showVerdict ? t('Analysis complete · 4 steps') : t('Analyzing case files')}</strong><span className={fresh && !files.length ? 'live' : ''}>{fresh && !files.length ? t('LIVE MODEL') : resultBundle?.origin === 'cached' ? t('CACHED RUN') : t('ANALYSIS')}</span></div>
            <div className="landing-steps">
              {[
                [t('Reading documents'), t('files in this case')],
                [t('Extracting facts with sources'), t('every fact linked to a line in a document')],
                [t('Running procedure rules'), t('legal rules in active chains')],
                [t('Building consequence chains'), t('one weak point, followed to the end')],
              ].map(([label, detail], index) => {
                const liveStep = events.some((event) => (index === 0 && event.stage === 'ingest') || (index === 1 && event.stage === 'extract') || (index === 2 && (event.stage === 'qualify' || event.stage === 'engine')) || (index === 3 && event.stage === 'engine'));
                const done = resultBundle ? revealStep > index || showVerdict : index < 3 && events.some((event) => (index === 0 && event.stage !== 'ingest') || (index === 1 && (event.stage === 'qualify' || event.stage === 'engine')) || (index === 2 && event.stage === 'engine'));
                return <div className={`landing-step${done ? ' done' : revealStep === index || (!resultBundle && liveStep) ? ' on' : ''}`} key={label}><span className="landing-step-status" /><span className="landing-step-text">{label}<small>{detail}</small></span><span className="landing-step-count">{resultBundle ? counts[index] : index < 2 ? liveValues[index] : '…'}</span></div>;
              })}
            </div>
            {!resultBundle && <p className="landing-current-event">{events.at(-1)?.text ?? t('Preparing pipeline…')}</p>}
            {showVerdict && resultBundle && <div className="landing-verdict">
              <span className="landing-verdict-label"><i />{t(finding ? 'Weak point found' : 'No decisive weak point found')}</span>
              <p>{finding ? <><b>{finding.title}</b> — {finding.subtitle}. {finding.outcome}.</> : t('The available facts do not establish a decisive procedural ground. Review the chains and sources before drawing a conclusion.')}</p>
              <div className="landing-numbers"><span><b>{targets?.[0]}</b>{t('documents')}</span><span><b>{targets?.[1]}</b>{t('sourced facts')}</span><span><b>{targets?.[3]}</b>{t('chains')}</span><span><b>{result?.pendingReview}</b>{t('AI review pending')}</span></div>
              {resultBundle.origin === 'cached' && <small className="landing-result-note">{t('Showing a recorded analysis; no live model result was returned.')}</small>}
              <div className="landing-actions"><button className="primary" onClick={() => { onBundle?.(resultBundle); onDone(); }}>{t('Open chains')} →</button><button onClick={() => void run(lastInput.current)}>{t('Run again')}</button></div>
            </div>}
          </div>
        )}
        <div className="landing-principles"><span><i className="ai" />{t('AI finds and qualifies the facts')}</span><span><i className="rules" />{t('Rules run the chain')}</span><span><i className="lawyers" />{t('Lawyers decide')}</span></div>
      </div></div>
      <div className="landing-floor" aria-hidden="true"><div className="landing-scan" /><div className="landing-call cause"><b>{t('Weak point found')}</b><span>{t('the chain starts here')}</span></div><div className="landing-call end"><b>{t('consequence reached')}</b></div><div className="landing-tiles">{Array.from({ length: 40 }, (_, index) => <i key={index} style={{ animationDelay: `${0.5 + index * 0.025}s`, transitionDelay: `${Math.max(0, index - 12) * 45}ms` }} />)}</div><span>{t('each tile is a fact from the case file')}</span></div>
    </main>
  );
}
