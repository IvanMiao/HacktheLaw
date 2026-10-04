import { useLocale } from '../i18n/useLocale';
import { useBundle } from '../data/useBundle';
import type { Anchor, Fact } from '../data/bundle';
import { value, type Analysis, type AnalysisState, type Counterfactual, type Decision } from '../engine/chains';
import { fr } from '../engine/dates';
import { SourceChip } from './SourceChip';

function QualBadge({ qid, state }: { qid: string; state: AnalysisState }) {
  const { t } = useLocale();
  const { bundle, qualOf } = useBundle();
  const q = qualOf(qid);
  const v = value(bundle, state, qid);
  const d = state.decisions[qid];
  const whatIf = qid in state.whatIf;
  const ai = q.source === 'ai_inferred' && d === 'proposed' && !whatIf;
  return (
    <span className={`qbadge ${ai ? 'ai' : ''} ${whatIf ? 'whatif' : ''}`}>
      {whatIf ? t('What-if: ') : ''}{t(v ? q.yes : q.no)}
      {d === 'confirmed' && !whatIf && <span className="tick" aria-label={t('confirmed')}> ✓</span>}
      {d === 'rejected' && !whatIf && <span className="cross" aria-label={t('rejected')}> ✕</span>}
    </span>
  );
}

export function FactList({ state, selected, onSelect }: { state: AnalysisState; selected: string; onSelect: (id: string) => void }) {
  const { t } = useLocale();
  const { bundle } = useBundle();
  return (
    <div className="facts">
      <div className="col-head">{t('Facts')} <span className="muted">{bundle.facts.length} · {t('chronological')}</span></div>
      <ol>
        {bundle.facts.map((f) => (
          <li key={f.id}>
            <button className={`fact ${selected === f.id ? 'sel' : ''}`} onClick={() => onSelect(f.id)}>
              <span className="mono date">{fr(f.date)}</span>
              <span className="kindline">{t(f.kind)}</span>
              <span className="summary">{t(f.summary)}</span>
              {f.qualification && <QualBadge qid={f.qualification} state={state} />}
              {!f.verified && <span className="qbadge unverified">{t('Unverified')}</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

type DetailProps = {
  fact: Fact; state: AnalysisState; analysis: Analysis; cfs: Counterfactual[];
  onDecide: (qid: string, d: Decision) => void; onAnchor: (a: Anchor) => void; onOpenLink: (id: string) => void;
};

export function FactDetail({ fact, state, analysis, cfs, onDecide, onAnchor, onOpenLink }: DetailProps) {
  const { t } = useLocale();
  const { docOf, qualOf } = useBundle();
  const q = fact.qualification ? qualOf(fact.qualification) : undefined;
  const decision = q && state.decisions[q.id];
  const cf = q && cfs.find((c) => c.qid === q.id);
  const quotes = new Set(fact.anchors.map((a) => a.quote));
  const usedIn = analysis.chains.flatMap((c) =>
    c.links.filter((l) => l.anchors.some((a) => quotes.has(a.quote)) || (q && l.deps.includes(q.id))).map((l) => ({ chain: c.id, link: l })));

  return (
    <div className="detail">
      <div className="eyebrow"><span className="mono">{fr(fact.date)}</span> · {t(fact.kind)} · {t(docOf(fact.doc).title)}{!fact.verified && ` · ${t('Unverified')}`}</div>
      <h2>{t(fact.summary)}</h2>
      {!fact.verified && <div className="callout amber">{t('Quote not found in the source — excluded from the chains.')}</div>}
      {fact.anchors.map((a) => (
        <figure key={a.quote} className="excerpt">
          <blockquote lang="fr">« {a.quote} »</blockquote>
          <figcaption><SourceChip anchor={{ ...a, verified: fact.verified }} onAnchor={onAnchor} /></figcaption>
        </figure>
      ))}

      {q && (
        <section className={`qual ${q.source === 'ai_inferred' ? 'is-ai' : ''}`}>
          <div className="qual-head">
            <span className="section-label">{t('Legal qualification')}</span>
            {q.source === 'ai_inferred' ? <span className="ai-tag">{t('AI-inferred')}</span> : <span className="rule-tag">{t('Rule')}</span>}
            <span className="muted small">{t('confidence:')} {t(q.confidence)}</span>
          </div>
          <p className="question">{t(q.question)}</p>
          <p className="answer"><QualBadge qid={q.id} state={state} /></p>
          <p className="reasoning">{t(q.reasoning)}</p>
          <p className="muted small">{t('Basis:')} {t(q.rule)}</p>
          {fact.role === 'formal_notice' && <div className="callout neutral"><strong>{t('Does not interrupt.')}</strong> {t('A common misconception: an ordinary mise en demeure leaves the limitation date unchanged.')}</div>}
          <div className="actions">
            <button className={`btn ${decision === 'confirmed' ? 'primary' : ''}`} onClick={() => onDecide(q.id, decision === 'confirmed' ? 'proposed' : 'confirmed')}>
              {decision === 'confirmed' ? t('Confirmed ✓') : t('Confirm')} <kbd>C</kbd>
            </button>
            <button className={`btn ${decision === 'rejected' ? 'danger' : ''}`} onClick={() => onDecide(q.id, decision === 'rejected' ? 'proposed' : 'rejected')}>
              {decision === 'rejected' ? t('Rejected ✕') : t('Reject')} <kbd>R</kbd>
            </button>
            {cf && cf.effects.length > 0 && (
              <span className="impact">{t('If')} {t(decision === 'rejected' ? 'restored' : 'rejected')} : {cf.effects.map((e) => `${t(e.to === 'fails' ? 'breaks' : 'restores')} ${e.chain}`).join(', ')}</span>
            )}
          </div>
        </section>
      )}

      {usedIn.length > 0 && (
        <section>
          <div className="section-label">{t('Used in')}</div>
          <ul className="usedin">
            {usedIn.map(({ chain, link }) => (
              <li key={link.id}><button className="linkish" onClick={() => onOpenLink(link.id)}><span className="mono">{chain}</span> {link.title}</button> <span className={`st st-${link.status}`}>{t(link.status.replace('_', ' '))}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
