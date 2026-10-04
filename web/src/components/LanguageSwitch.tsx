import { useLocale } from '../i18n/useLocale';

export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="language-switch" role="group" aria-label={t('Language')}>
      <button lang="en" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
      <button lang="fr" aria-label="Français" aria-pressed={locale === 'fr'} onClick={() => setLocale('fr')}>FR</button>
    </div>
  );
}
