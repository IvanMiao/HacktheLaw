import { useEffect, useState } from 'react';
import type { Qualification } from '../data/bundle';
import type { Decision, ReviewEntry } from '../engine/chains';
import { useLocale } from '../i18n/useLocale';

type Props = {
  qualification: Qualification; decision: Decision; interpretation: boolean; review: ReviewEntry; preview: boolean;
  onAdopt: (interpretation: boolean, review: ReviewEntry) => void;
  onDisagree: (review: ReviewEntry) => void;
};

export function ReviewControls({ qualification: q, decision, interpretation, review, preview, onAdopt, onDisagree }: Props) {
  const { t } = useLocale();
  const [editor, setEditor] = useState<'none' | 'interpretation' | 'disagreement'>('none');
  const [draft, setDraft] = useState(interpretation);
  const [note, setNote] = useState(review.note);
  const [error, setError] = useState(false);
  const modify = () => { setDraft(interpretation); setNote(decision === 'disagreed' ? '' : review.note); setError(false); setEditor('interpretation'); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (preview || editor !== 'none' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (event.key === 'c') onAdopt(interpretation, { ...review, note: decision === 'disagreed' ? '' : review.note });
      if (event.key === 'r') { setDraft(interpretation); setNote(decision === 'disagreed' ? '' : review.note); setError(false); setEditor('interpretation'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, editor, interpretation, review, decision, onAdopt]);

  return <div className="lawyer-review">
    <div className="actions">
      <button className={`btn ${decision === 'confirmed' ? 'primary' : ''}`} disabled={preview || decision === 'confirmed'} onClick={() => { onAdopt(interpretation, { ...review, note: decision === 'disagreed' ? '' : review.note }); setEditor('none'); }}>{t(decision === 'confirmed' ? 'Adopted ✓' : 'Adopt')} <kbd>C</kbd></button>
      <button className="btn" disabled={preview} onClick={modify}>{t('Edit & adopt')} <kbd>R</kbd></button>
      <button className={`btn ${decision === 'disagreed' ? 'review-pending' : ''}`} disabled={preview} onClick={() => { setNote(decision === 'disagreed' ? review.note : ''); setError(false); setEditor('disagreement'); }}>{t('Disagree')}</button>
    </div>
    {!preview && editor === 'interpretation' && <form className="review-editor" onSubmit={(event) => {
      event.preventDefault();
      onAdopt(draft, { ...review, note: note.trim() }); setEditor('none');
    }}>
      <label htmlFor={`reading-${q.id}`}>{t('Interpretation to use')}</label>
      <select id={`reading-${q.id}`} value={String(draft)} onChange={(event) => { const next = event.target.value === 'true'; setDraft(next); if (next !== interpretation && note === review.note) setNote(''); setError(false); }}>
        <option value="true">{t(q.yes)}</option><option value="false">{t(q.no)}</option>
      </select>
      <label htmlFor={`reason-${q.id}`}>{t('Note (optional)')}</label>
      <textarea id={`reason-${q.id}`} value={note} rows={3} maxLength={5000} onChange={(event) => { setNote(event.target.value); setError(false); }} />
      <div className="actions"><button className="btn primary" type="submit">{t('Save & adopt')}</button><button className="btn" type="button" onClick={() => setEditor('none')}>{t('Cancel')}</button></div>
    </form>}
    {!preview && editor === 'disagreement' && <form className="review-editor" onSubmit={(event) => {
      event.preventDefault();
      if (!note.trim()) { setError(true); return; }
      onDisagree({ ...review, note: note.trim() }); setEditor('none');
    }}>
      <label htmlFor={`note-${q.id}`}>{t('Reason (required)')}</label>
      <textarea id={`note-${q.id}`} value={note} rows={2} maxLength={5000} aria-required="true" aria-invalid={error} onChange={(event) => { setNote(event.target.value); setError(false); }} />
      {error && <p className="review-error" role="alert">{t('Add a reason for disagreeing.')}</p>}
      <div className="actions">
        <button className="btn primary" type="submit">{t('Save disagreement')}</button>
        <button className="btn" type="button" onClick={() => setEditor('none')}>{t('Cancel')}</button></div>
    </form>}
    {editor === 'none' && (review.note || review.nextStep) && <details className="review-saved"><summary>{t('Saved reasoning and follow-up')}</summary>{review.note && <p>{review.note}</p>}{review.nextStep && <p>{review.nextStep}</p>}</details>}
  </div>;
}
