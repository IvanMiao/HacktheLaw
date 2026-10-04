import { FACTS, qualById, type Anchor, type Fact } from '../data/case';
import { docById } from '../data/documents';
import { value, type Analysis, type AnalysisState, type Counterfactual, type Decision } from '../engine/chains';
import { fr } from '../engine/dates';
import { SourceChip } from './SourceChip';

function QualBadge({ qid, state }: { qid: string; state: AnalysisState }) {
  const q = qualById(qid);
  const v = value(state, qid);
  const d = state.decisions[qid];
  const whatIf = qid in state.whatIf;
  const ai = q.source === 'ai_inferred' && d === 'proposed' && !whatIf;
  return (
    <span className={`qbadge ${ai ? 'ai' : ''} ${whatIf ? 'whatif' : ''}`}>
      {whatIf ? 'What-if: ' : ''}{v ? q.yes : q.no}
      {d === 'confirmed' && !whatIf && <span className="tick" aria-label="confirmed"> ✓</span>}
      {d === 'rejected' && !whatIf && <span className="cross" aria-label="rejected"> ✕</span>}
    </span>
  );
}

export function FactList({ state, selected, onSelect }: { state: AnalysisState; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="facts">
      <div className="col-head">Facts <span className="muted">{FACTS.length} · chronological</span></div>
      <ol>
        {FACTS.map((f) => (
          <li key={f.id}>
            <button className={`fact ${selected === f.id ? 'sel' : ''}`} onClick={() => onSelect(f.id)}>
              <span className="mono date">{fr(f.date)}</span>
              <span className="kindline">{f.kind}</span>
              <span className="summary">{f.summary}</span>
              {f.qualification && <QualBadge qid={f.qualification} state={state} />}
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
  const q = fact.qualification ? qualById(fact.qualification) : undefined;
  const decision = q && state.decisions[q.id];
  const cf = q && cfs.find((c) => c.qid === q.id);
  const quotes = new Set(fact.anchors.map((a) => a.quote));
  const usedIn = analysis.chains.flatMap((c) =>
    c.links.filter((l) => l.anchors.some((a) => quotes.has(a.quote)) || (q && l.deps.includes(q.id))).map((l) => ({ chain: c.id, link: l })));

  return (
    <div className="detail">
      <div className="eyebrow"><span className="mono">{fr(fact.date)}</span> · {fact.kind} · {docById(fact.doc).title}</div>
      <h2>{fact.summary}</h2>
      {fact.anchors.map((a) => (
        <figure key={a.quote} className="excerpt">
          <blockquote>« {a.quote} »</blockquote>
          <figcaption><SourceChip anchor={a} onAnchor={onAnchor} /></figcaption>
        </figure>
      ))}

      {q && (
        <section className={`qual ${q.source === 'ai_inferred' ? 'is-ai' : ''}`}>
          <div className="qual-head">
            <span className="section-label">Legal qualification</span>
            {q.source === 'ai_inferred' ? <span className="ai-tag">AI-inferred</span> : <span className="rule-tag">Rule</span>}
            <span className="muted small">confidence: {q.confidence}</span>
          </div>
          <p className="question">{q.question}</p>
          <p className="answer"><QualBadge qid={q.id} state={state} /></p>
          <p className="reasoning">{q.reasoning}</p>
          <p className="muted small">Basis: {q.rule}</p>
          {fact.id === 'f4' && <div className="callout neutral"><strong>Does not interrupt.</strong> A common misconception: an ordinary mise en demeure leaves the limitation date unchanged.</div>}
          <div className="actions">
            <button className={`btn ${decision === 'confirmed' ? 'primary' : ''}`} onClick={() => onDecide(q.id, decision === 'confirmed' ? 'proposed' : 'confirmed')}>
              {decision === 'confirmed' ? 'Confirmed ✓' : 'Confirm'} <kbd>C</kbd>
            </button>
            <button className={`btn ${decision === 'rejected' ? 'danger' : ''}`} onClick={() => onDecide(q.id, decision === 'rejected' ? 'proposed' : 'rejected')}>
              {decision === 'rejected' ? 'Rejected ✕' : 'Reject'} <kbd>R</kbd>
            </button>
            {cf && cf.effects.length > 0 && (
              <span className="impact">If {decision === 'rejected' ? 'restored' : 'rejected'}: {cf.effects.map((e) => `${e.to === 'fails' ? 'breaks' : 'restores'} ${e.chain}`).join(', ')}</span>
            )}
          </div>
        </section>
      )}

      {usedIn.length > 0 && (
        <section>
          <div className="section-label">Used in</div>
          <ul className="usedin">
            {usedIn.map(({ chain, link }) => (
              <li key={link.id}><button className="linkish" onClick={() => onOpenLink(link.id)}><span className="mono">{chain}</span> {link.title}</button> <span className={`st st-${link.status}`}>{link.status.replace('_', ' ')}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
