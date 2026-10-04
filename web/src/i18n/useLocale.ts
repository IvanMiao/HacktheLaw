import { createContext, useContext } from 'react';
import type { Locale, Translator } from './translate';

export const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: Translator } | null>(null);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('LocaleProvider is required');
  return context;
}
