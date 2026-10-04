import { useEffect, useRef, useState } from 'react';
import type { CaseBundle } from '../data/bundle';
import { SAMPLE } from '../data/sample';
import { PRESETS, getCase } from '../data/catalog';
import { useLocale } from '../i18n/useLocale';
import './CasePicker.css';

export function CasePicker({ bundle, onSelect }: {
  bundle: CaseBundle;
  onSelect: (bundle: CaseBundle) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const choices = [
    { id: 'c1-c2', code: t('SAMPLE'), title: t(SAMPLE.profile.title), bundle: SAMPLE },
    ...PRESETS.map((preset) => ({ id: preset.id, code: preset.id.toUpperCase(), title: t(preset.profile.title), bundle: getCase(preset.id) })),
    ...(!bundle.preset && bundle.id !== SAMPLE.id ? [{ id: bundle.id, code: t('Case'), title: t(bundle.profile.title), bundle }] : []),
  ];
  const selected = choices.find((choice) => choice.id === (bundle.preset ? bundle.id : bundle.id !== SAMPLE.id ? bundle.id : 'c1-c2')) ?? choices[0];
  const selectedIndex = choices.indexOf(selected);

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

  return <div className="case-picker" ref={root}>
    <button ref={trigger} type="button" className="case-picker-trigger" aria-label={t('Case')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }}>
      <span className="case-picker-code">{selected.code}</span><span className="case-picker-title">{selected.title}</span>
      <svg className="case-picker-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div className="case-picker-menu" role="menu" aria-label={t('Case')} onKeyDown={(event) => {
      const index = items.current.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); move(index < 0 ? selectedIndex : index, 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(index < 0 ? selectedIndex : index, -1); }
      else if (event.key === 'Home') { event.preventDefault(); items.current[0]?.focus(); }
      else if (event.key === 'End') { event.preventDefault(); items.current[choices.length - 1]?.focus(); }
      else if (event.key === 'Tab') setOpen(false);
    }}>
      {choices.map((choice, index) => <button key={choice.id} ref={(element) => { items.current[index] = element; }} type="button" role="menuitemradio" aria-checked={choice.id === selected.id} className="case-picker-option" onClick={() => { setOpen(false); if (choice.id !== selected.id) onSelect(choice.bundle); else trigger.current?.focus(); }}>
        <span className="case-picker-option-code">{choice.code}</span><span className="case-picker-option-title">{choice.title}</span><span className="case-picker-check" aria-hidden="true">{choice.id === selected.id ? '✓' : ''}</span>
      </button>)}
    </div>}
  </div>;
}
