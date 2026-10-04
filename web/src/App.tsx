import { useLocale } from './i18n/useLocale';
import { LanguageSwitch } from './components/LanguageSwitch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChainsView } from './components/Chains';
import { VoicePanel } from './components/VoicePanel';
import { buildContext, applyIntent, describeIntent } from './voice/commands';
import { validateIntent, type Intent } from './voice/contract';
import { FactDetail, FactList } from './components/Facts';
import { Logo } from './components/Glyphs';
import { Memo } from './components/Memo';
import { SourceViewer } from './components/SourceViewer';
import { StartScreen } from './components/StartScreen';
import { CASE, FACTS, QUALIFICATIONS, type Anchor } from './data/case';
import { analyse, counterfactuals, initialState, type AnalysisState, type Decision } from './engine/chains';
import { daysBetween, long } from './engine/dates';

type Mode = 'facts' | 'chains' | 'memo';
const MODES: [Mode, string][] = [['facts', 'Facts'], ['chains', 'Chains'], ['memo', 'Memo']];

export default function App() {
  const { locale, t } = useLocale();
  const params = new URLSearchParams(location.search);
  const initialMode = params.get('mode') as Mode | null;
  const [stage, setStage] = useState<'start' | 'loading' | 'ready'>(initialMode ? 'ready' : 'start');
  const [mode, setMode] = useState<Mode>(initialMode ?? 'facts');
  const [state, setState] = useState<AnalysisState>(() => {
    const s = initialState();
    if (params.has('confirmed')) s.decisions = Object.fromEntries(Object.keys(s.decisions).map((k) => [k, 'confirmed']));
    const w = params.get('whatif');
    if (w) s.whatIf = { [w]: !QUALIFICATIONS.find((q) => q.id === w)?.proposed };
    return s;
  });
  const [factId, setFactId] = useState('f3');
  const [linkId, setLinkId] = useState<string | null>(params.get('link'));
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [docId, setDocId] = useState(params.get('doc') ?? 'email');
  const [viewerOpen, setViewerOpen] = useState(true);
  const [presenter, setPresenter] = useState(false);

  const analysis = useMemo(() => analyse(state, t), [state, t]);
  const cfs = useMemo(() => counterfactuals(state, t), [state, t]);
  const quotesByDoc = useMemo(() => {
    const m: Record<string, string[]> = {};
    const add = (a: Anchor) => {
      const list = (m[a.doc] ??= []);
      if (!list.includes(a.quote)) list.push(a.quote);
    };
    FACTS.forEach((f) => f.anchors.forEach(add));
    analysis.chains.forEach((c) => c.links.forEach((l) => l.anchors.forEach(add)));
    return m;
  }, [analysis]);

  const showAnchor = useCallback((a: Anchor) => { setDocId(a.doc); setAnchor({ ...a }); setViewerOpen(true); }, []);
  const decide = useCallback((qid: string, d: Decision) => setState((s) => ({ ...s, decisions: { ...s.decisions, [qid]: d } })), []);
  const toggleWhatIf = (qid: string, v: boolean) => setState((s) => {
    const whatIf = { ...s.whatIf };
    if (qid in whatIf) delete whatIf[qid]; else whatIf[qid] = v;
    return { ...s, whatIf };
  });
  const selectFact = useCallback((id: string) => {
    setFactId(id);
    const f = FACTS.find((x) => x.id === id)!;
    showAnchor(f.anchors[0]);
  }, [showAnchor]);
  const openLink = (id: string | null) => {
    setLinkId(id);
    setMode('chains');
    const l = analysis.chains.flatMap((c) => c.links).find((x) => x.id === id);
    if (l?.anchors[0]) showAnchor(l.anchors[0]);
  };

  const voiceContext = useMemo(() => buildContext(state), [state]);
  const latestState = useRef(state);
  useEffect(() => { latestState.current = state; }, [state]);
  const runVoiceIntent = (raw: Intent): string => {
    const current = latestState.current;
    const intent = validateIntent(raw, buildContext(current));
    const next = applyIntent(current, intent);
    if (next !== current) setState(s => applyIntent(s, intent));
    if (intent.action === 'preview_scenario' || intent.action === 'challenge_defence') setMode('chains');
    if (intent.action === 'show_mode') setMode(intent.target as Mode);
    if (intent.action === 'explain_link') {
      const chain = analysis.chains.find(c => c.id === intent.target);
      openLink(chain?.links[0].id ?? intent.target);
    }
    if (intent.action === 'show_evidence') {
      const found = [...FACTS.flatMap(f => f.anchors), ...analysis.chains.flatMap(c => c.links.flatMap(l => l.anchors))].find(a => a.doc === intent.target);
      if (found) showAnchor(found);
      else { setDocId(intent.target!); setAnchor(null); setViewerOpen(true); }
    }
    return describeIntent(next, intent);
  };

  useEffect(() => {
    if (stage !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
      const i = FACTS.findIndex((f) => f.id === factId);
      const q = FACTS[i].qualification;
      if (e.key === '1') setMode('facts');
      else if (e.key === '2') setMode('chains');
      else if (e.key === '3') setMode('memo');
      else if (e.key === 'j') selectFact(FACTS[Math.min(i + 1, FACTS.length - 1)].id);
      else if (e.key === 'k') selectFact(FACTS[Math.max(i - 1, 0)].id);
      else if (e.key === 'c' && q && mode === 'facts') decide(q, 'confirmed');
      else if (e.key === 'r' && q && mode === 'facts') decide(q, 'rejected');
      else if (e.key === 'p') setPresenter((p) => !p);
      else if (e.key === 'Escape') setLinkId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, factId, mode, decide, selectFact]);

  useEffect(() => { document.documentElement.classList.toggle('presenter', presenter); }, [presenter]);

  if (stage !== 'ready') {
    return <StartScreen loading={stage === 'loading'} onLoad={() => setStage('loading')} onDone={() => setStage('ready')} />;
  }

  const grounds = analysis.chains.filter((c) => c.status !== 'fails').length;
  const contestedLinks = analysis.chains.flatMap((c) => c.links).filter((l) => l.status === 'contested').length;
  const pendingAi = QUALIFICATIONS.filter((q) => q.source === 'ai_inferred' && state.decisions[q.id] === 'proposed').length;
  const whatIf = Object.keys(state.whatIf).length > 0;
  const fact = FACTS.find((f) => f.id === factId)!;

  return (
    <div className={`app mode-${mode} ${viewerOpen ? '' : 'viewer-closed'}`}>
      <header className="topbar">
        <div className="brand"><Logo /><span>Domino</span></div>
        <div className="case-name">{t(CASE.title)} <span className="muted">· {CASE.court} · {t('acting for the defendant')}</span></div>
        <nav className="modes" aria-label={t('Mode')}>
          {MODES.map(([m, label], i) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{t(label)}<kbd>{i + 1}</kbd></button>
          ))}
        </nav>
        <LanguageSwitch />
        <div className="asof mono">{t('As of')} {long(CASE.asOf, locale)}</div>
      </header>

      <div className={`banner ${grounds ? 'b-grounds' : 'b-none'}`} role="status">
        <span className="b-dot" />
        <strong>{grounds ? t(grounds === 1 ? '{count} independent ground for inadmissibility' : '{count} independent grounds for inadmissibility', { count: grounds }) : t('No ground found in the 2 enabled chains')}</strong>
        {contestedLinks > 0 && <span>· {t(contestedLinks === 1 ? '{count} contested link' : '{count} contested links', { count: contestedLinks })}</span>}
        {pendingAi > 0 && <span className="b-prov">· {t(pendingAi === 1 ? 'Provisional — {count} AI qualification awaiting review' : 'Provisional — {count} AI qualifications awaiting review', { count: pendingAi })}</span>}
        {whatIf && <span className="b-whatif">· {t('What-if scenario')} <button className="linkish" onClick={() => setState((s) => ({ ...s, whatIf: {} }))}>{t('reset')}</button></span>}
        <span className="b-right mono">{t('Next hearing {date} · in {days} days', { date: long(CASE.nextHearing, locale), days: daysBetween(CASE.asOf, CASE.nextHearing) })}</span>
      </div>

      <VoicePanel context={voiceContext} onIntent={runVoiceIntent} />

      <div className="body">
        {mode !== 'chains' && <aside className="col left"><FactList state={state} selected={factId} onSelect={(id) => { selectFact(id); if (mode !== 'facts') setMode('facts'); }} /></aside>}
        <main className="col center">
          {mode === 'facts' && <FactDetail fact={fact} state={state} analysis={analysis} cfs={cfs} onDecide={decide} onAnchor={showAnchor} onOpenLink={openLink} />}
          {mode === 'chains' && (
            <ChainsView analysis={analysis} cfs={cfs} state={state} linkId={linkId} onLink={openLink} onWhatIf={toggleWhatIf}
              on642={() => setState((s) => ({ ...s, art642: !s.art642 }))} onReset={() => setState((s) => ({ ...s, whatIf: {} }))} onAnchor={showAnchor} />
          )}
          {mode === 'memo' && <Memo analysis={analysis} state={state} onAnchor={showAnchor} />}
        </main>
        {viewerOpen
          ? <aside className="col right"><SourceViewer docId={docId} onDoc={(id) => { setDocId(id); setAnchor(null); }} active={anchor} quotesByDoc={quotesByDoc} onCollapse={() => setViewerOpen(false)} /></aside>
          : <button className="viewer-tab" onClick={() => setViewerOpen(true)}>{t('Sources')}</button>}
      </div>
    </div>
  );
}
