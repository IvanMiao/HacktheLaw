import { useLocale } from './i18n/useLocale';
import { LanguageSwitch } from './components/LanguageSwitch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChainsView } from './components/Chains';
import { FactDetail, FactList } from './components/Facts';
import { Logo } from './components/Glyphs';
import { Memo } from './components/Memo';
import { SourceViewer } from './components/SourceViewer';
import { StartScreen } from './components/StartScreen';
import { CASE, FACTS, QUALIFICATIONS, type Anchor } from './data/case';
import { analyse, counterfactuals, type AnalysisState, type Decision, type ReviewEntry } from './engine/chains';
import { restoreReviews, serializeReviews, REVIEW_STORAGE_KEY } from './engine/reviewStorage';
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
    let saved = null;
    try { saved = localStorage.getItem(REVIEW_STORAGE_KEY); } catch { /* Reviews remain usable without storage. */ }
    const s = restoreReviews(saved);
    const w = params.get('whatif');
    const q = QUALIFICATIONS.find((q) => q.id === w);
    if (q) s.whatIf = { [q.id]: !q.proposed };
    return s;
  });
  const [factId, setFactId] = useState('f3');
  const [linkId, setLinkId] = useState<string | null>(params.get('link'));
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [docId, setDocId] = useState(params.get('doc') ?? 'email');
  const [viewerOpen, setViewerOpen] = useState(true);
  const [presenter, setPresenter] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'unchanged' | 'saved' | 'session'>('unchanged');

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
  const updateReview = useCallback((next: AnalysisState) => {
    if (Object.keys(state.whatIf).length) return;
    setState(next);
    try {
      localStorage.setItem(REVIEW_STORAGE_KEY, serializeReviews(next));
      setSaveStatus('saved');
    } catch { setSaveStatus('session'); }
  }, [state.whatIf]);
  const decide = useCallback((qid: string, d: Decision) => updateReview({ ...state, decisions: { ...state.decisions, [qid]: d } }), [state, updateReview]);
  const editReview = useCallback((qid: string, review: ReviewEntry) => updateReview({ ...state, reviews: { ...state.reviews, [qid]: review } }), [state, updateReview]);
  const exitPreview = useCallback(() => {
    setState((s) => ({ ...s, whatIf: {} }));
    const url = new URL(location.href);
    url.searchParams.delete('whatif');
    history.replaceState(null, '', url);
  }, []);
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

  useEffect(() => {
    if (stage !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLElement && e.target.isContentEditable) || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const i = FACTS.findIndex((f) => f.id === factId);
      const q = FACTS[i].qualification;
      if (e.key === '1') setMode('facts');
      else if (e.key === '2') setMode('chains');
      else if (e.key === '3') setMode('memo');
      else if (e.key === 'j') selectFact(FACTS[Math.min(i + 1, FACTS.length - 1)].id);
      else if (e.key === 'k') selectFact(FACTS[Math.max(i - 1, 0)].id);
      else if (e.key === 's' && q && mode === 'facts') decide(q, 'supported');
      else if (e.key === 'u' && q && mode === 'facts') decide(q, 'unsupported');
      else if (e.key === 'i' && q && mode === 'facts') decide(q, 'insufficient');
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

  const grounds = analysis.chains.filter((c) => c.status === 'holds').length;
  const unresolved = analysis.chains.filter((c) => ['contested', 'unsupported', 'insufficient'].includes(c.status)).length;
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

      <div className={`banner ${grounds ? 'b-grounds' : 'b-review'}`} role="status">
        <span className="b-dot" />
        <strong>{grounds ? (whatIf ? t('{count} potential ground(s) in this preview', { count: grounds }) : t(grounds === 1 ? '{count} supported potential ground' : '{count} supported potential grounds', { count: grounds })) : t('No supported ground yet')}</strong>
        {unresolved > 0 && <span className="b-prov">· {t('{count} argument(s) need review', { count: unresolved })}</span>}
        {whatIf && <span className="b-whatif">· {t('Hypothetical preview')} <button className="linkish" onClick={exitPreview}>{t('Exit preview')}</button></span>}
        <span className="b-right mono">{t('Next hearing {date} · in {days} days', { date: long(CASE.nextHearing, locale), days: daysBetween(CASE.asOf, CASE.nextHearing) })}</span>
      </div>

      <div className="body">
        {mode !== 'chains' && <aside className="col left"><FactList state={state} selected={factId} onSelect={(id) => { selectFact(id); if (mode !== 'facts') setMode('facts'); }} /></aside>}
        <main className="col center">
          {mode === 'facts' && <>
            <p className="review-save muted small" role="status">{t(saveStatus === 'unchanged' ? 'Review notes and next steps will be included in the memo.' : saveStatus === 'saved' ? 'Review saved in this browser.' : 'Review kept in this session only. Copy the memo to keep a record.')}</p>
            <FactDetail fact={fact} state={state} analysis={analysis} onDecide={decide} onAnchor={showAnchor} onOpenLink={openLink}
              onEditReview={editReview} onMemo={() => setMode('memo')} onPreview={toggleWhatIf} onExitPreview={exitPreview} />
          </>}
          {mode === 'chains' && (
            <ChainsView analysis={analysis} cfs={cfs} state={state} linkId={linkId} onLink={openLink} onWhatIf={toggleWhatIf}
              on642={() => setState((s) => ({ ...s, art642: !s.art642 }))} onReset={exitPreview} onAnchor={showAnchor}
              onReview={(qid) => { const reviewed = QUALIFICATIONS.find((q) => q.id === qid); if (reviewed) { selectFact(reviewed.factId); setMode('facts'); } }} />
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
