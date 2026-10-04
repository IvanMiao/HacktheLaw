import { useLocale } from '../i18n/useLocale';
import { useEffect, useState } from 'react';
import { DOCS } from '../data/documents';
import { FACTS, QUALIFICATIONS } from '../data/case';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Glyphs';
import { FilmIntro } from './FilmIntro';

const STAGES = [
  { label: 'Reading documents', count: DOCS.length, unit: 'documents' },
  { label: 'Extracting facts', count: FACTS.length, unit: 'anchored facts' },
  { label: 'Qualifying', count: QUALIFICATIONS.length, unit: 'qualifications proposed' },
  { label: 'Running chains', count: 2, unit: 'chains evaluated' },
];

export function StartScreen({ loading, onLoad, onDone }: { loading: boolean; onLoad: () => void; onDone: () => void }) {
  const { t } = useLocale();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!loading) return;
    if (stage >= STAGES.length) { const t = setTimeout(onDone, 350); return () => clearTimeout(t); }
    const t = setTimeout(() => setStage((s) => s + 1), 480);
    return () => clearTimeout(t);
  }, [loading, stage, onDone]);

  return (
    <main className="start">
      {!loading && <FilmIntro />}
      <div className="start-language"><LanguageSwitch /></div>
      <div className="start-card">
        <div className="brand-lg"><Logo size={44} /><span>Domino</span></div>
        <p className="tagline">{t('Find the domino that knocks out the claim.')}</p>
        <p className="muted small">{t('Procedural consequence chains for French civil litigation — every fact anchored, every rule shown.')}</p>
        {!loading ? (
          <>
            <div className="drop" aria-disabled>
              <strong>{t('Drop a case file')}</strong>
              <span className="muted">{t('PDF, scans, .eml — disabled in this demo')}</span>
            </div>
            <button className="btn primary lg" onClick={onLoad} autoFocus>{t('Load sample case')}</button>
            <p className="muted small">{t('Atelier Lumière v. Bâtiself')} · Tribunal de commerce de Bordeaux</p>
          </>
        ) : (
          <ol className="stages">
            {STAGES.map((s, i) => (
              <li key={s.label} className={i < stage ? 'done' : i === stage ? 'now' : ''}>
                <span className="dot" />
                <span>{t(s.label)}</span>
                <span className="mono muted">{i < stage ? `${s.count} ${t(s.unit)}` : i === stage ? '…' : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
