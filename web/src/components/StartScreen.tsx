import { useLocale } from '../i18n/useLocale';
import { useEffect, useState } from 'react';
import { useBundle } from '../data/useBundle';
import type { CaseBundle } from '../data/bundle';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Glyphs';

export function StartScreen({ loading, onLoad, onDone, onBundle }: { loading: boolean; onLoad: () => void; onDone: () => void; onBundle?: (bundle: CaseBundle) => void }) {
  const { t } = useLocale();
  const { bundle, docs } = useBundle();
  const stages = [
    { label: 'Reading documents', count: docs.length, unit: 'documents' },
    { label: 'Extracting facts', count: bundle.facts.length, unit: 'anchored facts' },
    { label: 'Qualifying', count: bundle.qualifications.length, unit: 'qualifications proposed' },
    { label: 'Running chains', count: 2, unit: 'chains evaluated' },
  ];
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!loading) return;
    if (stage >= stages.length) { const t = setTimeout(onDone, 350); return () => clearTimeout(t); }
    const t = setTimeout(() => setStage((s) => s + 1), 480);
    return () => clearTimeout(t);
  }, [loading, stage, onDone, stages.length]);

  return (
    <main className="start">
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
            <button className="btn primary lg" onClick={() => { onBundle?.(bundle); onLoad(); }} autoFocus>{t('Load sample case')}</button>
            <p className="muted small">{t(bundle.profile.title)} · {bundle.profile.court}</p>
          </>
        ) : (
          <ol className="stages">
            {stages.map((s, i) => (
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
