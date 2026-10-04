import { useCallback, useEffect, useMemo, useState } from 'react';
import { BundleProvider } from './data/BundleProvider';
import { useBundle } from './data/useBundle';
import { SAMPLE } from './data/sample';
import type { Anchor, CaseBundle } from './data/bundle';
import { analyse, counterfactuals, initialState, type AnalysisState, type Decision } from './engine/chains';
import { daysBetween, long } from './engine/dates';
import { useLocale } from './i18n/useLocale';
import { ChainsView } from './components/Chains';
import { FactDetail, FactList } from './components/Facts';
import { LanguageSwitch } from './components/LanguageSwitch';
import { Logo } from './components/Glyphs';
import { Memo } from './components/Memo';
import { SourceViewer } from './components/SourceViewer';
import { StartScreen } from './components/StartScreen';

type Mode = 'facts' | 'chains' | 'memo';
const MODES: [Mode, string][] = [['facts', 'Facts'], ['chains', 'Chains'], ['memo', 'Memo']];

export default function App() {
  const [bundle, setBundle] = useState<CaseBundle>(SAMPLE);
  return <BundleProvider bundle={bundle}><AppContent key={bundle.id} onBundle={setBundle} /></BundleProvider>;
}

function AppContent({ onBundle }: { onBundle: (bundle: CaseBundle) => void }) {
  const { bundle, docs, factOf, qualOf } = useBundle();
  const { locale, t } = useLocale();
  const params = new URLSearchParams(location.search);
  const initialMode = params.get('mode') as Mode | null;
  const [stage, setStage] = useState<'start' | 'loading' | 'ready'>(initialMode ? 'ready' : 'start');
  const [mode, setMode] = useState<Mode>(initialMode ?? 'facts');
  const [state, setState] = useState<AnalysisState>(() => {
    const next = initialState(bundle);
    if (params.has('confirmed')) next.decisions = Object.fromEntries(Object.keys(next.decisions).map((key) => [key, 'confirmed']));
    const whatIf = params.get('whatif');
    if (whatIf && bundle.qualifications.some((qualification) => qualification.id === whatIf)) {
      next.whatIf = { [whatIf]: !qualOf(whatIf).proposed };
    }
    return next;
  });
  const defaultFact = bundle.qualifications.find((qualification) => qualification.kind === 'acknowledgment')?.factId
    ?? bundle.facts.find((fact) => fact.qualification)?.id ?? bundle.facts[0]?.id ?? '';
  const defaultDoc = bundle.facts.find((fact) => fact.id === defaultFact)?.doc ?? bundle.docs[0]?.id ?? docs[0]?.id ?? '';
  const [factId, setFactId] = useState(defaultFact);
  const [linkId, setLinkId] = useState<string | null>(params.get('link'));
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [docId, setDocId] = useState(params.get('doc') ?? defaultDoc);
  const [viewerOpen, setViewerOpen] = useState(true);
  const [presenter, setPresenter] = useState(false);

  const analysis = useMemo(() => analyse(bundle, state, t), [bundle, state, t]);
  const cfs = useMemo(() => counterfactuals(bundle, state, t), [bundle, state, t]);
  const quotesByDoc = useMemo(() => {
    const quotes: Record<string, string[]> = {};
    const add = (item: Anchor) => {
      const list = (quotes[item.doc] ??= []);
      if (!list.includes(item.quote)) list.push(item.quote);
    };
    bundle.facts.filter((fact) => fact.verified).forEach((fact) => fact.anchors.forEach(add));
    analysis.chains.forEach((chain) => chain.links.forEach((link) => link.anchors.forEach(add)));
    return quotes;
  }, [analysis, bundle.facts]);

  const showAnchor = useCallback((item: Anchor) => { setDocId(item.doc); setAnchor({ ...item }); setViewerOpen(true); }, []);
  const decide = useCallback((qid: string, decision: Decision) => setState((current) => ({
    ...current, decisions: { ...current.decisions, [qid]: decision },
  })), []);
  const toggleWhatIf = (qid: string, nextValue: boolean) => setState((current) => {
    const whatIf = { ...current.whatIf };
    if (qid in whatIf) delete whatIf[qid]; else whatIf[qid] = nextValue;
    return { ...current, whatIf };
  });
  const selectFact = useCallback((id: string) => {
    setFactId(id);
    const fact = factOf(id);
    if (fact.anchors[0]) showAnchor({ ...fact.anchors[0], verified: fact.verified });
  }, [factOf, showAnchor]);
  const openLink = (id: string | null) => {
    setLinkId(id);
    setMode('chains');
    const link = analysis.chains.flatMap((chain) => chain.links).find((item) => item.id === id);
    if (link?.anchors[0]) showAnchor(link.anchors[0]);
  };

  useEffect(() => {
    if (stage !== 'ready') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.metaKey || event.ctrlKey) return;
      const index = bundle.facts.findIndex((fact) => fact.id === factId);
      if (index < 0) return;
      const fact = bundle.facts[index];
      const qid = fact.qualification;
      if (event.key === '1') setMode('facts');
      else if (event.key === '2') setMode('chains');
      else if (event.key === '3') setMode('memo');
      else if (event.key === 'j') selectFact(bundle.facts[Math.min(index + 1, bundle.facts.length - 1)].id);
      else if (event.key === 'k') selectFact(bundle.facts[Math.max(index - 1, 0)].id);
      else if (event.key === 'c' && qid && mode === 'facts') decide(qid, 'confirmed');
      else if (event.key === 'r' && qid && mode === 'facts') decide(qid, 'rejected');
      else if (event.key === 'p') setPresenter((current) => !current);
      else if (event.key === 'Escape') setLinkId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, factId, mode, decide, selectFact, bundle.facts]);

  useEffect(() => { document.documentElement.classList.toggle('presenter', presenter); }, [presenter]);

  if (stage !== 'ready') {
    return <StartScreen loading={stage === 'loading'} onLoad={() => setStage('loading')} onDone={() => setStage('ready')} onBundle={onBundle} />;
  }

  const enabled = analysis.chains.filter((chain) => chain.status !== 'not_applicable');
  const grounds = enabled.filter((chain) => chain.status === 'holds' || chain.status === 'contested').length;
  const contestedLinks = analysis.chains.flatMap((chain) => chain.links).filter((link) => link.status === 'contested').length;
  const pendingAi = bundle.qualifications.filter((qualification) => qualification.source === 'ai_inferred' && state.decisions[qualification.id] === 'proposed').length;
  const whatIf = Object.keys(state.whatIf).length > 0;
  const fact = bundle.facts.find((item) => item.id === factId) ?? bundle.facts[0];

  return (
    <div className={`app mode-${mode} ${viewerOpen ? '' : 'viewer-closed'}`}>
      <header className="topbar">
        <div className="brand"><Logo /><span>Domino</span></div>
        <div className="case-name">{t(bundle.profile.title)} <span className="muted">· {bundle.profile.court} · {t(bundle.profile.side)}</span></div>
        <nav className="modes" aria-label={t('Mode')}>
          {MODES.map(([currentMode, label], i) => (
            <button key={currentMode} className={mode === currentMode ? 'on' : ''} onClick={() => setMode(currentMode)}>{t(label)}<kbd>{i + 1}</kbd></button>
          ))}
        </nav>
        <LanguageSwitch />
        <div className="asof mono">{t('As of')} {long(bundle.profile.asOf, locale)}</div>
      </header>

      <div className={`banner ${grounds ? 'b-grounds' : 'b-none'}`} role="status">
        <span className="b-dot" />
        <strong>{grounds ? t(grounds === 1 ? '{count} independent ground for inadmissibility' : '{count} independent grounds for inadmissibility', { count: grounds })
          : t('No ground found in the {count} enabled chains', { count: analysis.chains.length })}</strong>
        {contestedLinks > 0 && <span>· {t(contestedLinks === 1 ? '{count} contested link' : '{count} contested links', { count: contestedLinks })}</span>}
        {pendingAi > 0 && <span className="b-prov">· {t(pendingAi === 1 ? 'Provisional — {count} AI qualification awaiting review' : 'Provisional — {count} AI qualifications awaiting review', { count: pendingAi })}</span>}
        {whatIf && <span className="b-whatif">· {t('What-if scenario')} <button className="linkish" onClick={() => setState((current) => ({ ...current, whatIf: {} }))}>{t('reset')}</button></span>}
        {bundle.profile.nextHearing && <span className="b-right mono">{t('Next hearing {date} · in {days} days', {
          date: long(bundle.profile.nextHearing, locale), days: daysBetween(bundle.profile.asOf, bundle.profile.nextHearing),
        })}</span>}
      </div>

      <div className="body">
        {mode !== 'chains' && <aside className="col left"><FactList state={state} selected={factId} onSelect={(id) => { selectFact(id); if (mode !== 'facts') setMode('facts'); }} /></aside>}
        <main className="col center">
          {mode === 'facts' && fact && <FactDetail fact={fact} state={state} analysis={analysis} cfs={cfs} onDecide={decide} onAnchor={showAnchor} onOpenLink={openLink} />}
          {mode === 'chains' && (
            <ChainsView analysis={analysis} cfs={cfs} state={state} linkId={linkId} onLink={openLink} onWhatIf={toggleWhatIf}
              on642={() => setState((current) => ({ ...current, art642: !current.art642 }))} onReset={() => setState((current) => ({ ...current, whatIf: {} }))} onAnchor={showAnchor} />
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
