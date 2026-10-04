import { useLocale } from '../i18n/useLocale';
import { useEffect, useState } from 'react';
import { DOCS } from '../data/documents';
import { FACTS, QUALIFICATIONS } from '../data/case';
import { LanguageSwitch } from './LanguageSwitch';
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
    <main className="landing">
      {!loading && <FilmIntro />}
      <div className="landing-language"><LanguageSwitch /></div>
      <div className="landing-in">
        <header className="landing-brand">
          <div><h1>Domino</h1><p>{t('Find the domino that knocks out the claim.')}</p></div>
          <div className="landing-dominoes" aria-hidden="true"><i /><i /><i /><i /></div>
        </header>
        <section className="landing-card" aria-live="polite">
          {!loading ? (
            <>
              <div className="landing-meta">
                <span>Sample case · synthetic</span><span>Tribunal de commerce</span>
                <span>{t('acting for the defendant')}</span><span>As of 04 Oct 2026</span>
              </div>
              <h2>Atelier Lumière SAS v. Bâtiself SARL — unpaid invoice of €18,400</h2>
              <div className="landing-drop" aria-disabled="true">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11V2.5M4.5 6L8 2.5 11.5 6M2.5 10.5v3h11v-3" /></svg>
                <div><strong>{t('Drop a case file')}</strong> — {t('PDF, scans, .eml — disabled in this demo')}</div>
                <button className="landing-load" onClick={onLoad} autoFocus>{t('Load sample case')} <kbd>↵</kbd></button>
              </div>
              <p className="landing-principle">AI finds and qualifies the facts. Rules run the chain. Lawyers decide.</p>
            </>
          ) : (
            <>
              <h2>{t('Atelier Lumière v. Bâtiself')}</h2>
              <ol className="landing-stages">
                {STAGES.map((s, i) => (
                  <li key={s.label} className={i < stage ? 'done' : i === stage ? 'now' : ''}>
                    <strong>{i < stage ? s.count : 0}</strong>
                    <span>{t(s.label)}</span>
                    <i aria-hidden="true" />
                  </li>
                ))}
              </ol>
              <div className="landing-progress"><i style={{ width: `${Math.min(stage, STAGES.length) * 25}%` }} /></div>
              <p className="landing-phase">{stage < STAGES.length ? t(STAGES[stage].label) : 'Ready · 1 fact unverified'}</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
