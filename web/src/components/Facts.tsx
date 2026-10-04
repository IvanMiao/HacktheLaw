import { useLocale } from '../i18n/useLocale';
import { useBundle } from '../data/useBundle';
import type { Anchor, Fact } from '../data/bundle';
import { value, type Analysis, type AnalysisState, type ReviewEntry, type Decision } from '../engine/chains';
import { fr } from '../engine/dates';
import { SourceChip } from './SourceChip';
import { isFirmImport } from '../integrations/provenance';
import { ReviewControls } from './ReviewControls';

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
      {d === 'pending' && !whatIf && <span className="review-pending"> · {t('To verify')}</span>}
    </span>
  );
}

export function FactList({ state, selected, onSelect }: { state: AnalysisState; selected: string; onSelect: (id: string) => void }) {
  const { t } = useLocale();
  const { bundle } = useBundle();
  return (
    <div className="facts">
      <div className="col-head">{t('Facts')} <span className="muted">{bundle.facts.length}</span></div>
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
  fact: Fact; state: AnalysisState; analysis: Analysis;
  onDecide: (qid: string, d: Decision) => void; onAnchor: (a: Anchor) => void; onOpenLink: (id: string) => void;
  onAdopt: (qid: string, interpretation: boolean, review: ReviewEntry) => void;
  onSaveReview: (qid: string, review: ReviewEntry) => void;
};

export function FactDetail({ fact, state, analysis, onDecide, onAnchor, onOpenLink, onAdopt, onSaveReview }: DetailProps) {
  const { t, locale } = useLocale();
  const { bundle, qualOf } = useBundle();
  const q = fact.qualification ? qualOf(fact.qualification) : undefined;
  const preview = Object.keys(state.whatIf).length > 0;
  const quotes = new Set(fact.anchors.map((a) => a.quote));
  const usedIn = analysis.chains.flatMap((c) =>
    c.links.filter((l) => l.anchors.some((a) => quotes.has(a.quote)) || (q && l.deps.includes(q.id))).map((l) => ({ chain: c.id, link: l })));

  return (
    <div className="detail">
      <div className="eyebrow"><span className="mono">{fr(fact.date)}</span> · {t(fact.kind)}{!fact.verified && ` · ${t('Unverified')}`}{bundle.models?.agent && ` · ${t('Extracted by {model}', { model: bundle.models.agent })}`}</div>
      <h2>{t(fact.summary)}</h2>
      {isFirmImport(bundle) && <p className="muted small">{locale === 'fr' ? 'Citation retrouvée · sans confirmation juridique' : 'Quote matched · not legal confirmation'}</p>}
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
            {q.source === 'ai_inferred' && <span className="ai-tag">{isFirmImport(bundle) ? (locale === 'fr' ? 'Proposition importée' : 'Imported proposal') : t('AI-inferred')}</span>}
            {q.model && <span className="muted small">{t('Proposed by {model} · {confidence} confidence', { model: q.model, confidence: t(q.confidence) })}</span>}
            {q.fallback && <span className="qbadge unverified fallback-badge">{t('No AI answer — default shown')}</span>}
          </div>
          <p className="question">{t(q.question)}</p>
          <p className="answer"><QualBadge qid={q.id} state={state} /></p>
          <p className="reasoning">{q.id in state.whatIf ? t('Scenario interpretation') : state.interpretations[q.id] !== undefined && state.reviews[q.id]?.note ? state.reviews[q.id].note : t(q.reasoning)}</p>
          <p className="muted small">{t('Basis:')} {t(q.rule)}</p>
          {fact.role === 'formal_notice' && <div className="callout neutral"><strong>{t('Does not interrupt.')}</strong> {t('A common misconception: an ordinary mise en demeure leaves the limitation date unchanged.')}</div>}
          <ReviewControls key={q.id} qualification={q} decision={state.decisions[q.id]} interpretation={value(bundle, state, q.id)}
            review={state.reviews[q.id] ?? { note: '', nextStep: '' }} preview={preview}
            onAdopt={(interpretation, review) => onAdopt(q.id, interpretation, review)} onPending={() => onDecide(q.id, 'pending')}
            onSave={(review) => onSaveReview(q.id, review)} />
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
