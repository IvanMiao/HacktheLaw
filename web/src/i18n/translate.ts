import { french } from './fr';
import type { Text } from '../data/bundle';

export type Locale = 'en' | 'fr';
export type Translator = (text: Text, values?: Record<string, string | number>) => string;

export function translator(locale: Locale): Translator {
  return (text, values = {}) => {
    const value = typeof text === 'string' ? text : text[locale];
    const template = locale === 'fr' ? french[value] ?? value : value;
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
  };
}

export const english = translator('en');

export function initialLocale(search: string, saved: string | null): Locale {
  const requested = new URLSearchParams(search).get('lang');
  return requested === 'en' || requested === 'fr' ? requested : saved === 'fr' ? 'fr' : 'en';
}
