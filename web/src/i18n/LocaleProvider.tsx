import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initialLocale, translator, type Locale } from './translate';

const STORAGE_KEY = 'domino-language';
import { LocaleContext } from './useLocale';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(() => {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    return initialLocale(location.search, saved);
  });
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    const url = new URL(location.href);
    url.searchParams.set('lang', next);
    history.replaceState(null, '', url);
  }, []);
  const t = useMemo(() => translator(locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('Domino — procedural consequence chains');
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* Switching still works without storage. */ }
  }, [locale, t]);
  const context = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={context}>{children}</LocaleContext.Provider>;
}
