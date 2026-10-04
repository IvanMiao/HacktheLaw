import { useEffect, useState } from 'react';
import type { Qualification } from '../data/bundle';
import type { Decision, ReviewEntry } from '../engine/chains';
import { useLocale } from '../i18n/useLocale';

type Props = {
  qualification: Qualification; decision: Decision; interpretation: boolean; review: ReviewEntry; preview: boolean;
  onAdopt: (interpretation: boolean, review: ReviewEntry) => void;
  onPending: () => void; onSave: (review: ReviewEntry) => void;
};

export function ReviewControls({ qualification: q, decision, interpretation, review, preview, onAdopt, onPending, onSave }: Props) {
  const { t } = useLocale();
  const [editor, setEditor] = useState<'none' | 'interpretation' | 'followup'>('none');
  const [draft, setDraft] = useState(interpretation);
  const [note, setNote] = useState(review.note);
  const [nextStep, setNextStep] = useState(review.nextStep);
  const [error, setError] = useState(false);
  const modify = () => { setDraft(interpretation); setNote(review.note); setError(false); setEditor('interpretation'); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (preview || editor !== 'none' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (event.key === 'c') onAdopt(interpretation, review);
      if (event.key === 'r') { setDraft(interpretation); setNote(review.note); setError(false); setEditor('interpretation'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, editor, interpretation, review, onAdopt]);

  return <div className="lawyer-review">
    <div className="actions">
      <button className={`btn ${decision === 'confirmed' ? 'primary' : ''}`} disabled={preview || decision === 'confirmed'} onClick={() => onAdopt(interpretation, review)}>{t(decision === 'confirmed' ? 'Adopted ✓' : 'Use this interpretation')} <kbd>C</kbd></button>
      <button className="btn" disabled={preview} onClick={modify}>{t('Modify interpretation')} <kbd>R</kbd></button>
      <button className={`btn ${decision === 'pending' ? 'review-pending' : ''}`} disabled={preview} onClick={() => { onPending(); setNote(review.note); setNextStep(review.nextStep); setEditor('followup'); }}>{t('To verify')}</button>
    </div>
    {!preview && editor === 'interpretation' && <form className="review-editor" onSubmit={(event) => {
      event.preventDefault();
      if (!note.trim()) { setError(true); return; }
      onAdopt(draft, { ...review, note: note.trim() }); setEditor('none');
    }}>
      <label htmlFor={`reading-${q.id}`}>{t('Interpretation to use')}</label>
      <select id={`reading-${q.id}`} value={String(draft)} onChange={(event) => { const next = event.target.value === 'true'; setDraft(next); if (next !== interpretation && note === review.note) setNote(''); setError(false); }}>
        <option value="true">{t(q.yes)}</option><option value="false">{t(q.no)}</option>
      </select>
      <label htmlFor={`reason-${q.id}`}>{t('Reason and supporting source')}</label>
      <textarea id={`reason-${q.id}`} value={note} rows={3} maxLength={5000} aria-invalid={error} onChange={(event) => { setNote(event.target.value); setError(false); }} />
      {error && <p className="review-error" role="alert">{t('Add a reason for this interpretation.')}</p>}
      <div className="actions"><button className="btn primary" type="submit">{t('Save and recalculate')}</button><button className="btn" type="button" onClick={() => setEditor('none')}>{t('Cancel')}</button></div>
    </form>}
    {!preview && editor === 'followup' && <div className="review-editor">
      <label htmlFor={`note-${q.id}`}>{t('What remains uncertain?')}</label>
      <textarea id={`note-${q.id}`} value={note} rows={2} maxLength={5000} onChange={(event) => setNote(event.target.value)} />
      <label htmlFor={`next-${q.id}`}>{t('Next step / evidence request draft')}</label>
      <textarea id={`next-${q.id}`} value={nextStep} rows={3} maxLength={5000} onChange={(event) => setNextStep(event.target.value)} />
      <div className="actions"><button className="btn" onClick={() => setNextStep((previous) => [previous, t('Please provide the complete source and context needed to assess: {question}', { question: t(q.question) })].filter(Boolean).join('\n\n'))}>{t('Draft evidence request')}</button>
        <button className="btn primary" onClick={() => { onSave({ note: note.trim(), nextStep: nextStep.trim() }); setEditor('none'); }}>{t('Save follow-up')}</button>
        <button className="btn" onClick={() => setEditor('none')}>{t('Cancel')}</button></div>
    </div>}
    {editor === 'none' && (review.note || review.nextStep) && <details className="review-saved"><summary>{t('Saved reasoning and follow-up')}</summary>{review.note && <p>{review.note}</p>}{review.nextStep && <p>{review.nextStep}</p>}</details>}
  </div>;
}
