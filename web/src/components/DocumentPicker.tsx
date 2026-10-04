import { useEffect, useRef, useState } from 'react';
import type { Doc, DocGroup } from '../data/documents';
import { fr } from '../engine/dates';
import { useLocale } from '../i18n/useLocale';
import './CasePicker.css';
import './DocumentPicker.css';

const GROUPS: [DocGroup, string][] = [['case', 'Case file'], ['caselaw', 'Case law'], ['statute', 'Statutes']];

export function DocumentPicker({ docs, docId, onDoc }: { docs: Doc[]; docId: string; onDoc: (id: string) => void }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const grouped = GROUPS.map(([group, label]) => ({ group, label: t(label), docs: docs.filter((doc) => doc.group === group) })).filter((entry) => entry.docs.length);
  const choices = grouped.flatMap((entry) => entry.docs);
  const selected = docs.find((doc) => doc.id === docId);
  const selectedIndex = Math.max(0, choices.findIndex((doc) => doc.id === docId));

  useEffect(() => {
    if (!open) return;
    items.current[selectedIndex]?.focus();
    const onOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open, selectedIndex]);

  const move = (from: number, delta: number) => items.current[(from + delta + choices.length) % choices.length]?.focus();

  return <div className="case-picker document-picker" ref={root}>
    <button ref={trigger} className="case-picker-trigger" type="button" aria-label={t('Document')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }}>
      <span className="case-picker-code">{selected ? t(GROUPS.find(([group]) => group === selected.group)?.[1] ?? 'Document') : t('Document')}</span>
      <span className="case-picker-title">{selected ? `${selected.date ? `${fr(selected.date)} · ` : ''}${selected.title}` : t('Document')}</span>
      <svg className="case-picker-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div className="case-picker-menu document-picker-menu" role="menu" aria-label={t('Document')} onKeyDown={(event) => {
      const index = items.current.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); move(index < 0 ? selectedIndex : index, 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(index < 0 ? selectedIndex : index, -1); }
      else if (event.key === 'Home') { event.preventDefault(); items.current[0]?.focus(); }
      else if (event.key === 'End') { event.preventDefault(); items.current[choices.length - 1]?.focus(); }
      else if (event.key === 'Tab') setOpen(false);
    }}>
      {grouped.map((entry) => <div className="document-picker-group" key={entry.group} role="group" aria-label={entry.label}>
        <div className="document-picker-heading" aria-hidden="true">{entry.label}</div>
        {entry.docs.map((doc) => {
          const index = choices.findIndex((choice) => choice.id === doc.id);
          return <button key={doc.id} ref={(element) => { items.current[index] = element; }} type="button" role="menuitemradio" aria-checked={doc.id === docId} className="case-picker-option document-picker-option" onClick={() => { setOpen(false); if (doc.id !== docId) onDoc(doc.id); else trigger.current?.focus(); }}>
            <span className="document-picker-item-title">{doc.title}</span>
            {doc.date && <span className="document-picker-date">{fr(doc.date)}</span>}
            <span className="case-picker-check" aria-hidden="true">{doc.id === docId ? '✓' : ''}</span>
          </button>;
        })}
      </div>)}
    </div>}
  </div>;
}
