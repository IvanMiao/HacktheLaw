import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BundleProvider } from './data/BundleProvider';
import { useBundle } from './data/useBundle';
import { SAMPLE } from './data/sample';
import type { Anchor, CaseBundle } from './data/bundle';
import { PRESETS, getCase, type CaseId } from './data/catalog';
import { createCaseSession, type CaseSession } from './data/caseSession';
import { analyse, counterfactuals, initialState, type AnalysisState, type Decision } from './engine/chains';
import { daysBetween, long } from './engine/dates';
import { useLocale } from './i18n/useLocale';
import { ChainsView } from './components/Chains';
import { DisabledVoicePanel, VoicePanel } from './components/VoicePanel';
import { buildContext, applyIntent, caseIdForBundle, describeIntent } from './voice/commands';
import { validateIntent, type Intent } from './voice/contract';
import { FactDetail, FactList } from './components/Facts';
import { LanguageSwitch } from './components/LanguageSwitch';
import { Logo } from './components/Glyphs';
import { Memo } from './components/Memo';
import { SourceViewer } from './components/SourceViewer';
import { StartScreen } from './components/StartScreen';
import { Connections } from './components/Connections';
import { isFirmImport } from './integrations/provenance';

type Mode = 'facts' | 'chains' | 'memo';
const MODES: [Mode, string][] = [['facts', 'Facts'], ['chains', 'Chains'], ['memo', 'Memo']];

export default function App() {
  const { locale } = useLocale();
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [caseId, setCaseId] = useState<CaseId>(() => {
    const requested = new URLSearchParams(location.search).get('case');
    return PRESETS.find((preset) => preset.id === requested)?.id as CaseId ?? 'c1-c2';
  });
  const [bundle, setBundle] = useState<CaseBundle>(() => caseId === 'c1-c2' ? SAMPLE : getCase(caseId));
  const [hasLoaded, setHasLoaded] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [activeCase] = useState(() => createCaseSession(caseId));
  const switchBundle = (next: CaseBundle) => {
    if (next.id === bundle.id) return;
    const nextCaseId = caseIdForBundle(next);
    activeCase.select(nextCaseId);
    const url = new URL(location.href);
    if (next.preset) url.searchParams.set('case', next.id);
    else url.searchParams.delete('case');
    ['confirmed','whatif','doc','link'].forEach(key => url.searchParams.delete(key));
    history.replaceState(null, '', url);
    setCaseId(nextCaseId);
    setBundle(next);
  };
  return <BundleProvider bundle={bundle}><button className="btn connections-toggle" onClick={() => setConnectionsOpen(true)}>{locale === 'fr' ? 'Connexions' : 'Connections'}</button>
    {connectionsOpen && <Connections onClose={() => setConnectionsOpen(false)} onView={(next) => { switchBundle(next); setHasLoaded(true); setConnectionsOpen(false); }} />}
    <AppContent
    key={bundle.id}
    onBundle={switchBundle}
    initialReady={hasLoaded || !!bundle.preset}
    onLoaded={() => setHasLoaded(true)}
    fallbackMessage={fallbackMessage}
    onFallback={setFallbackMessage}
    onClearFallback={() => setFallbackMessage('')}
    activeCase={activeCase}
  /></BundleProvider>;
}

function AppContent({ onBundle, initialReady, onLoaded, fallbackMessage, onFallback, onClearFallback, activeCase }: {
  onBundle: (bundle: CaseBundle) => void;
  initialReady: boolean;
  onLoaded: () => void;
  fallbackMessage: string;
  onFallback: (message: string) => void;
  onClearFallback: () => void;
  activeCase: CaseSession;
}) {
  const { bundle, docs, factOf, qualOf } = useBundle();
  const caseToken = activeCase.identity();
  const { locale, t } = useLocale();
  const params = new URLSearchParams(location.search);
  const initialMode = params.get('mode') as Mode | null;
  const [stage, setStage] = useState<'start' | 'loading' | 'ready'>(initialMode || initialReady ? 'ready' : 'start');
  const currentStage = initialReady ? 'ready' : stage;
  const [startError, setStartError] = useState('');
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
  const [traceOpen, setTraceOpen] = useState(false);

  const analysis = useMemo(() => analyse(bundle, state, t), [bundle, state, t]);
  const cfs = useMemo(() => counterfactuals(bundle, state, t), [bundle, state, t]);
  const provenance = isFirmImport(bundle)
    ? (locale === 'fr' ? 'Import du cabinet · validation requise' : 'Firm import · review required')
    : bundle.provider && bundle.models?.agent
    ? t('AI · {provider} {model} · {status}', {
      provider: bundle.provider,
      model: bundle.models.agent,
      status: t(bundle.origin === 'cached' ? 'cached' : 'live'),
    })
    : t('Hand-checked reference');
  const generatedAt = bundle.generatedAt ? new Date(bundle.generatedAt) : undefined;
  const recordedDate = generatedAt && !Number.isNaN(generatedAt.getTime())
    ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(generatedAt)
    : long(bundle.profile.asOf, locale);
  const trace = bundle.trace ?? [];
  const traceStart = trace[0]?.at ?? 0;
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

  const selectedCaseId = caseIdForBundle(bundle);
  const isDemo = selectedCaseId === 'c1-c2' || !!bundle.preset;
  const voiceContext = useMemo(() => buildContext(state, bundle), [state, bundle]);
  const latestState = useRef(state);
  useEffect(() => { latestState.current = state; }, [state, bundle]);
  const runVoiceIntent = (raw: Intent): string => {
    activeCase.assert(caseToken);
    const current = latestState.current;
    const intent = validateIntent(raw, buildContext(current, bundle));
    const next = applyIntent(current, intent, bundle, activeCase.identity().caseId);
    if (next !== current) setState((s) => applyIntent(s, intent, bundle, activeCase.identity().caseId));
    if (intent.action === 'preview_scenario' || intent.action === 'challenge_defence') setMode('chains');
    if (intent.action === 'show_mode') setMode(intent.target as Mode);
    if (intent.action === 'explain_link') {
      const chain = analysis.chains.find(c => c.id === intent.target);
      openLink(chain?.links[0].id ?? intent.target);
    }
    if (intent.action === 'show_evidence') {
      const found = [...bundle.facts.flatMap((item) => item.anchors), ...analysis.chains.flatMap((chain) => chain.links.flatMap((link) => link.anchors))].find((a) => a.doc === intent.target);
      if (found) showAnchor(found);
      else { setDocId(intent.target!); setAnchor(null); setViewerOpen(true); }
    }
    return describeIntent(next, intent, bundle);
  };

  useEffect(() => {
    if (currentStage !== 'ready') return;
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
      else if (event.key === 'Escape') { setLinkId(null); setTraceOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentStage, factId, mode, decide, selectFact, bundle.facts]);

  useEffect(() => { document.documentElement.classList.toggle('presenter', presenter); }, [presenter]);

  if (currentStage !== 'ready') {
    return <StartScreen
      loading={currentStage === 'loading'}
      error={startError}
      onLoad={() => { onClearFallback(); setStartError(''); setStage('loading'); }}
      onDone={() => { setStage('ready'); onLoaded(); }}
      onError={(message) => { setStartError(message); setStage('start'); }}
      onBundle={onBundle}
      onFallback={onFallback}
      onReference={() => { setStartError(''); onClearFallback(); onBundle(SAMPLE); }}
    />;
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
        <div className="case-name">
            <select aria-label={t('Case')} value={selectedCaseId} onChange={(event) => {
            const selected = event.target.value;
            onBundle(selected === 'c1-c2' ? SAMPLE : getCase(selected as CaseId));
          }}>
            <option value="c1-c2">{t('SAMPLE')} · {t(SAMPLE.profile.title)}</option>
            {PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.id.toUpperCase()} · {t(preset.profile.title)}</option>)}
            {!isDemo && <option value={bundle.id}>{t(bundle.profile.title)}</option>}
          </select>
          <span className="b-prov qbadge provenance-chip">{provenance}</span>
        </div>
        <nav className="modes" aria-label={t('Mode')}>
          {MODES.map(([currentMode, label], i) => (
            <button key={currentMode} className={mode === currentMode ? 'on' : ''} onClick={() => setMode(currentMode)}>{t(label)}<kbd>{i + 1}</kbd></button>
          ))}
        </nav>
        {trace.length > 0 && <button className="btn trace-toggle" aria-expanded={traceOpen} onClick={() => setTraceOpen((open) => !open)}>{t('Trace')}</button>}
        <LanguageSwitch />
        <details className="case-context">
          <summary aria-label={t('Case details')} title={t('Case details')}>ⓘ</summary>
          <div className="case-context-panel">
            <h2>{t('Case details')}</h2>
            <dl>
              <div><dt>{t('Court')}</dt><dd>{bundle.profile.court}</dd></div>
              <div><dt>{t('Side')}</dt><dd>{t(bundle.profile.side)}</dd></div>
              <div><dt>{t('As of')}</dt><dd>{long(bundle.profile.asOf, locale)}</dd></div>
              {bundle.profile.nextHearing && <div><dt>{t('Next hearing')}</dt><dd>{long(bundle.profile.nextHearing, locale)} · {t('in {days} days', { days: daysBetween(bundle.profile.asOf, bundle.profile.nextHearing) })}</dd></div>}
            </dl>
          </div>
        </details>
      </header>

      <div className={`banner ${grounds ? 'b-grounds' : 'b-none'}`} role="status">
        {fallbackMessage && (
          <div className="fallback-callout callout amber">
            <span>{t('Live analysis unavailable ({message}) — showing the recorded AI analysis from {date}.', { message: fallbackMessage, date: recordedDate })}</span>
            <button className="linkish" aria-label={t('Dismiss')} onClick={onClearFallback}>×</button>
          </div>
        )}
        <span className="b-dot" />
        <strong>{bundle.preset
          ? t('{count} active procedural consequences · {chains} enabled chains · legal review required', { count: grounds, chains: analysis.chains.length })
          : grounds ? t(grounds === 1 ? '{count} independent ground for inadmissibility' : '{count} independent grounds for inadmissibility', { count: grounds })
          : t('No ground found in the {count} enabled chains', { count: analysis.chains.length })}</strong>
        {pendingAi > 0 ? <span className="banner-secondary b-prov">{isFirmImport(bundle) ? (locale === 'fr' ? `${pendingAi} propositions importées à valider` : `${pendingAi} imported proposals pending review`) : t('Provisional · {count} AI review pending', { count: pendingAi })}</span>
          : contestedLinks > 0 && <span className="banner-secondary">{t(contestedLinks === 1 ? '{count} contested link' : '{count} contested links', { count: contestedLinks })}</span>}
        {whatIf && <span className="banner-secondary b-whatif">{t('What-if scenario')} <button className="linkish" onClick={() => setState((current) => ({ ...current, whatIf: {} }))}>{t('reset')}</button></span>}
      </div>

      {isDemo ? <VoicePanel key={bundle.id} context={voiceContext} onIntent={runVoiceIntent} />
        : <DisabledVoicePanel />}

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
      {traceOpen && trace.length > 0 && (
        <aside className="trace-drawer" aria-label={t('Trace')}>
          <div className="trace-head">
            <h2>{t('Trace')}</h2>
            <button className="linkish" aria-label={t('Close')} onClick={() => setTraceOpen(false)}>×</button>
          </div>
          <ol className="trace-list">
            {trace.map((item, index) => (
              <li key={`${item.at}-${index}`} className={`trace-event kind-${item.kind}`}>
                <div className="trace-meta">
                  <span className="mono">+{Math.max(0, (item.at - traceStart) / 1000).toFixed(1)} s</span>
                  <span>{t(item.stage)} · {t(item.kind)}</span>
                </div>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}
