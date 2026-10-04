import { useLocale } from '../i18n/useLocale';
import type { CSSProperties } from 'react';
import type { Anchor } from '../data/case';
import type { Analysis, AnalysisState, ChainResult, ChainStatus, Counterfactual, Link, NodeKind } from '../engine/chains';
import { REGIMES } from '../engine/regimes';
import { DeadlineTrack } from './DeadlineTrack';
import { Pips } from './Glyphs';
import { SourceChip } from './SourceChip';

const KIND: Record<NodeKind, string> = {
  fact: 'Fact', requirement: 'Requirement', breach: 'Breach', sanction: 'Sanction',
  lost_effect: 'Lost effect', consequence: 'Consequence', outcome: 'Outcome',
};

const STATUS: Record<ChainStatus, string> = { holds: 'Ground holds', contested: 'Holds — contested', fails: 'Chain broken' };

export function StatusPill({ status }: { status: ChainStatus }) {
  const { t } = useLocale();
  return <span className={`pill pill-${status}`}>{t(STATUS[status])}</span>;
}

type Props = {
  analysis: Analysis; cfs: Counterfactual[]; state: AnalysisState; linkId: string | null;
  onLink: (id: string | null) => void; onWhatIf: (qid: string, v: boolean) => void; on642: () => void; onReset: () => void; onAnchor: (a: Anchor) => void;
};

export function ChainsView({ analysis, cfs, state, linkId, onLink, onWhatIf, on642, onReset, onAnchor }: Props) {
  const { t } = useLocale();
  const selected = analysis.chains.flatMap((c) => c.links).find((l) => l.id === linkId);
  const anyWhatIf = Object.keys(state.whatIf).length > 0;
  return (
    <div className="chains">
      <section className="stress">
        <div className="stress-head">
          <span className="section-label">{t('Stress-test')}</span>
          <span className="muted small">{t('Flip a contested link and watch the dominoes.')}</span>
          {anyWhatIf && <button className="linkish small" onClick={onReset}>{t('Reset scenario')}</button>}
        </div>
        <div className="toggles">
          {cfs.map((c) => (
            <label key={c.qid} className={`toggle ${c.active ? 'on' : ''}`}>
              <input type="checkbox" checked={c.active} onChange={() => onWhatIf(c.qid, c.flipsTo)} />
              <span className="switch" aria-hidden />
              <span>{c.label}</span>
              {c.effects.map((e) => <span key={e.chain} className="effect">{t(e.to === 'fails' ? 'breaks' : 'restores')} {e.chain}</span>)}
            </label>
          ))}
          <label className={`toggle ${state.art642 ? 'on' : ''}`}>
            <input type="checkbox" checked={state.art642} onChange={on642} />
            <span className="switch" aria-hidden />
            <span>{t('Extend a weekend expiry (art. 642 CPC)')}</span>
            <span className="effect neutral">{t('flag')}</span>
          </label>
        </div>
      </section>

      {analysis.chains.map((c) => <Lane key={c.id} chain={c} selected={linkId} onLink={onLink} />)}

      {selected ? <LinkDrawer link={selected} analysis={analysis} onAnchor={onAnchor} onClose={() => onLink(null)} />
        : <p className="hint muted small">{t('Select a domino to see its rule, inputs and sources.')}</p>}
    </div>
  );
}

function Lane({ chain, selected, onLink }: { chain: ChainResult; selected: string | null; onLink: (id: string) => void }) {
  const { t } = useLocale();
  const standing = chain.status !== 'fails';
  const broken = chain.links.find((l) => l.status === 'broken');
  return (
    <section className={`lane lane-${chain.status}`}>
      <header className="lane-head">
        <span className="lane-id mono">{chain.id}</span>
        <div className="lane-title">
          <h3>{chain.title}</h3>
          <p className="muted small">{chain.subtitle}</p>
        </div>
        <StatusPill status={chain.status} />
      </header>
      <ol className="tiles" style={{ gridTemplateColumns: `repeat(${chain.links.length}, minmax(0, 1fr))` }}>
        {chain.links.map((l, i) => {
          const next = chain.links[i + 1];
          const fallen = standing && (l.status === 'established' || l.status === 'contested');
          return (
            <li key={l.id} className={`tile s-${l.status} k-${l.kind} ${fallen ? 'fallen' : ''} ${selected === l.id ? 'sel' : ''}`}
              data-out={next?.status ?? 'end'} style={{ '--i': i } as CSSProperties}>
              <button onClick={() => onLink(l.id)} aria-label={`${t(KIND[l.kind])}: ${l.title} — ${t(l.status.replace('_', ' '))}`}>
                <span className="tile-top">
                  <span className="kind">{t(KIND[l.kind])}</span>
                  {l.kind === 'outcome' ? <span className="pip-out" aria-hidden /> : <Pips n={i + 1} />}
                </span>
                <span className="tile-rule" aria-hidden><i /></span>
                <span className="tile-body">
                  <strong>{l.title}</strong>
                  <span>{l.statement}</span>
                </span>
                <span className="tile-foot">
                  {l.status === 'contested' ? <span className="ai-tag">{t('AI-inferred')}</span>
                    : l.status === 'broken' ? <span className="breaks">{t('Breaks here')}</span>
                    : <span className="mono">{l.rule ?? t(l.anchors.length === 1 ? '{count} source' : '{count} sources', { count: l.anchors.length })}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {broken?.brokenReason && <p className="lane-note"><span className="sev">✂</span> {broken.title}: {broken.brokenReason}</p>}
    </section>
  );
}

function LinkDrawer({ link, analysis, onAnchor, onClose }: { link: Link; analysis: Analysis; onAnchor: (a: Anchor) => void; onClose: () => void }) {
  const { t } = useLocale();
  const regime = link.regime && REGIMES[link.regime];
  return (
    <aside className="drawer" aria-label={t('Link detail')}>
      <header>
        <span className="eyebrow">{t(KIND[link.kind])} · <span className={`st st-${link.status}`}>{t(link.status.replace('_', ' '))}</span></span>
        <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>×</button>
      </header>
      <h3>{link.title}</h3>
      <p className="statement">{link.statement}</p>
      <div className="drawer-grid">
        <div>
          {link.rule && <div className="kv"><span>{t('Rule')}</span><span>{link.rule}</span></div>}
          {link.computed && (
            <table className="calc"><tbody>
              {link.computed.map(([k, v]) => <tr key={k}><th>{k}</th><td className="mono">{v}</td></tr>)}
            </tbody></table>
          )}
          <div className="kv"><span>{t('Sources')}</span><span className="chips">{link.anchors.map((a) => <SourceChip key={a.quote} anchor={a} onAnchor={onAnchor} />)}</span></div>
        </div>
        <div>
          {link.status === 'broken' && link.brokenReason && <div className="callout green"><strong>{t('Chain breaks here.')}</strong> {link.brokenReason}</div>}
          {link.contrast && <div className="callout neutral"><strong>{t('Regime contrast.')}</strong> {link.contrast}</div>}
          {link.status === 'contested' && <div className="callout violet"><strong>{t('Contested.')}</strong> {t('Depends on an AI-inferred qualification awaiting lawyer review.')}</div>}
        </div>
      </div>
      {regime && (
        <table className="regime">
          <thead><tr><th>{t('Sanction')}</th><th>{t('When to raise')}</th><th>{t('Prejudice')}</th><th>{t('Curable')}</th><th>{t('Own motion')}</th><th>{t('Interruption')}</th></tr></thead>
          <tbody><tr><td>{t(regime.name)}</td><td>{t(regime.when)}</td><td>{t(regime.prejudice)}</td><td>{t(regime.curable)}</td><td>{t(regime.ownMotion)}</td><td>{t(regime.interruption)}</td></tr></tbody>
        </table>
      )}
      {link.kind === 'consequence' && (
        <div className="deadline">
          <div className="section-label">{t('Limitation calculation')}</div>
          <DeadlineTrack lim={analysis.limitation} />
          <ol className="steps">
            {analysis.limitation.steps.map((s, i) => (
              <li key={i} className={`step step-${s.effect}`}><span className="mono">{s.date.split('-').reverse().join('/')}</span><span>{s.text}</span><span className="muted mono">{s.rule}</span></li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
