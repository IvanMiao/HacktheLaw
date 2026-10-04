import { useLocale } from '../i18n/useLocale';
import { FACTS, qualById, type Anchor, type Fact } from '../data/case';
import { docById } from '../data/documents';
import { value, type Analysis, type AnalysisState, type Decision, type ReviewEntry } from '../engine/chains';
import { fr } from '../engine/dates';
import { SourceChip } from './SourceChip';
import { ReviewPanel } from './ReviewPanel';
import { REVIEW_LABELS } from '../data/review';

function QualBadge({ qid, state }: { qid: string; state: AnalysisState }) {
  const { t } = useLocale();
  const q = qualById(qid);
  const v = value(state, qid);
  const d = state.decisions[qid];
  const whatIf = qid in state.whatIf;
  const ai = d === 'unreviewed' && !whatIf;
  return (
    <span className={`qbadge review-${d} ${ai ? 'ai' : ''} ${whatIf ? 'whatif' : ''}`}>
      {whatIf ? t('What-if: ') : ''}{t(v ? q.yes : q.no)}
      {!whatIf && <span className="review-badge-label"> · {t(REVIEW_LABELS[d])}</span>}
    </span>
  );
}

export function FactList({ state, selected, onSelect }: { state: AnalysisState; selected: string; onSelect: (id: string) => void }) {
  const { t } = useLocale();
  return (
    <div className="facts">
      <div className="col-head">{t('Facts')} <span className="muted">{FACTS.length} · {t('chronological')}</span></div>
      <ol>
        {FACTS.map((f) => (
          <li key={f.id}>
            <button className={`fact ${selected === f.id ? 'sel' : ''}`} onClick={() => onSelect(f.id)}>
              <span className="mono date">{fr(f.date)}</span>
              <span className="kindline">{t(f.kind)}</span>
              <span className="summary">{t(f.summary)}</span>
              {f.qualification && <QualBadge qid={f.qualification} state={state} />}
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
  onEditReview: (qid: string, review: ReviewEntry) => void; onMemo: () => void;
  onPreview: (qid: string, value: boolean) => void; onExitPreview: () => void;
};

export function FactDetail({ fact, state, analysis, onDecide, onAnchor, onOpenLink, onEditReview, onMemo, onPreview, onExitPreview }: DetailProps) {
  const { t } = useLocale();
  const q = fact.qualification ? qualById(fact.qualification) : undefined;
  const quotes = new Set(fact.anchors.map((a) => a.quote));
  const usedIn = analysis.chains.flatMap((c) =>
    c.links.filter((l) => l.anchors.some((a) => quotes.has(a.quote)) || (q && l.deps.includes(q.id))).map((l) => ({ chain: c.id, link: l })));

  return (
    <div className="detail">
      <div className="eyebrow"><span className="mono">{fr(fact.date)}</span> · {t(fact.kind)} · {docById(fact.doc).title}</div>
      <h2>{t(fact.summary)}</h2>
      {fact.anchors.map((a) => (
        <figure key={a.quote} className="excerpt">
          <blockquote lang="fr">« {a.quote} »</blockquote>
          <figcaption><SourceChip anchor={a} onAnchor={onAnchor} /></figcaption>
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
          {fact.id === 'f4' && <div className="callout neutral"><strong>{t('Does not interrupt.')}</strong> {t('A common misconception: an ordinary mise en demeure leaves the limitation date unchanged.')}</div>}
        </section>
      )}

      {q && <ReviewPanel key={q.id} qualification={q} decision={state.decisions[q.id]}
        review={state.reviews[q.id] ?? { note: '', nextStep: '' }} preview={Object.keys(state.whatIf).length > 0}
        onDecide={(decision) => onDecide(q.id, decision)} onEdit={(review) => onEditReview(q.id, review)}
        onSource={() => onAnchor(fact.anchors[0])} onMemo={onMemo}
        onArgument={usedIn[0] ? () => onOpenLink(usedIn[0].link.id) : undefined}
        onPreview={() => onPreview(q.id, !q.proposed)} onExitPreview={onExitPreview} />}

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
