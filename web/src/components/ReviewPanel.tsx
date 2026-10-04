import { useRef } from 'react';
import type { Qualification } from '../data/case';
import type { Decision, ReviewEntry } from '../engine/chains';
import { useLocale } from '../i18n/useLocale';
import { REVIEW_LABELS } from '../data/review';

const OPTIONS: { value: Decision; description: string; key: string }[] = [
  { value: 'supported', description: 'The evidence supports this assessment.', key: 'S' },
  { value: 'unsupported', description: 'This assessment is not supported. Its opposite is not assumed.', key: 'U' },
  { value: 'insufficient', description: 'More evidence or context is needed.', key: 'I' },
];

const EVIDENCE_REQUESTS: Record<string, string> = {
  'q-email': 'Obtain the complete email thread and any related correspondence or payment records before assessing acknowledgment.',
  'q-clause': 'Obtain the complete signed contract, amendments and provisions governing the conciliation procedure.',
  'q-concil': 'Request any conciliation referral, correspondence and outcome record, including their dates. A missing exhibit does not prove that conciliation did not occur.',
  'q-writ1': 'Obtain the complete court order and verify which writ it concerns and the operative wording.',
  'q-notice': 'Obtain the complete notice and check whether any separate interrupting act accompanied it.',
};

type Props = {
  qualification: Qualification; decision: Decision; review: ReviewEntry; preview: boolean;
  onDecide: (decision: Decision) => void;
  onEdit: (review: ReviewEntry) => void;
  onSource: () => void; onArgument?: () => void; onMemo: () => void;
  onPreview: () => void; onExitPreview: () => void;
};

export function ReviewPanel({ qualification: q, decision, review, preview, onDecide, onEdit, onSource, onArgument, onMemo, onPreview, onExitPreview }: Props) {
  const { t } = useLocale();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const nextStepRef = useRef<HTMLTextAreaElement>(null);
  const draftRequest = () => {
    const request = t(EVIDENCE_REQUESTS[q.id] ?? 'What should be checked, corrected or obtained next?');
    onEdit({ ...review, nextStep: review.nextStep.trim() ? `${review.nextStep}\n\n${request}` : request });
    nextStepRef.current?.focus();
  };

  return (
    <section className="review-panel" aria-labelledby={`review-${q.id}`}>
      <div className="review-heading">
        <h3 id={`review-${q.id}`}>{t('Does the evidence support this assessment?')}</h3>
        <span className={`review-status review-${decision}`}>{t(REVIEW_LABELS[decision])}</span>
      </div>
      <p className="review-target">{t('Assessment to review:')} <strong>{t(q.proposed ? q.yes : q.no)}</strong></p>
      <p className="muted small">{t('Review the source, legal basis and context before choosing a status. Only supported assessments can support an argument.')}</p>

      {preview && <div className="callout neutral" role="status">
        {t('Hypothetical preview — your saved review is unchanged.')}{' '}
        <button className="linkish" onClick={onExitPreview}>{t('Exit preview to review')}</button>
      </div>}

      <fieldset className="review-options" disabled={preview}>
        <legend className="sr-only">{t('Evidence support status')}</legend>
        {OPTIONS.map((option) => <button key={option.value} type="button"
          className={`review-choice choice-${option.value} ${decision === option.value ? 'selected' : ''}`}
          aria-pressed={decision === option.value} onClick={() => onDecide(option.value)}>
          <span><strong>{t(REVIEW_LABELS[option.value])}</strong><kbd>{option.key}</kbd></span>
          <small>{t(option.description)}</small>
        </button>)}
      </fieldset>

      <div className="review-followup">
        <div className="review-heading">
          <h4>{t('Next action')}</h4>
          {decision !== 'unreviewed' && !preview && <button className="linkish small" onClick={() => onDecide('unreviewed')}>{t('Reset status')}</button>}
        </div>
        <p className="small" role="status">{t({
          unreviewed: 'Inspect the evidence, then record your assessment or what is still needed.',
          supported: 'This assessment can now support the analysis. Review the affected argument or open the memo.',
          unsupported: 'Arguments that need this assessment are blocked. Record the correction and its source; no opposite conclusion has been adopted.',
          insufficient: 'The analysis remains unresolved. Record the missing evidence and the next step.',
        }[decision])}</p>
        <div className="actions">
          <button className="btn" onClick={onSource}>{t('Inspect source')}</button>
          {decision === 'supported' && onArgument && <button className="btn" onClick={onArgument}>{t('Review affected argument')}</button>}
          {decision === 'supported' && <button className="btn" onClick={onMemo}>{t('Open review memo')}</button>}
          {decision === 'unsupported' && <button className="btn" disabled={preview} onClick={() => noteRef.current?.focus()}>{t('Record correction')}</button>}
          {decision === 'insufficient' && <button className="btn" disabled={preview} onClick={draftRequest}>{t('Draft evidence request')}</button>}
          {!preview && <button className="linkish small" onClick={onPreview}>{t('Preview alternative interpretation')}</button>}
        </div>

        <label htmlFor={`note-${q.id}`}>{t(decision === 'unsupported' ? 'Correction and supporting source' : 'Review notes and evidence')}</label>
        <textarea ref={noteRef} id={`note-${q.id}`} value={review.note} disabled={preview} rows={3} maxLength={5000}
          placeholder={t('Record your reasoning and cite a document, page or passage. Notes do not automatically change the facts.')}
          onChange={(event) => onEdit({ ...review, note: event.target.value })} />
        <label htmlFor={`next-${q.id}`}>{t('Next step / evidence request draft')}</label>
        <textarea ref={nextStepRef} id={`next-${q.id}`} value={review.nextStep} disabled={preview} rows={2} maxLength={5000}
          placeholder={t('What should be checked, corrected or obtained next?')}
          onChange={(event) => onEdit({ ...review, nextStep: event.target.value })} />
        <p className="muted small">{t('Notes and next steps are included in the review memo. A written correction does not replace a reviewed fact.')}</p>
      </div>
    </section>
  );
}
