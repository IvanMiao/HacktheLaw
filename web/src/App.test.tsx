import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import { LocaleProvider } from './i18n/LocaleProvider';

describe('case-aware application', () => {
  it.each(['c1-c2','c3','c4','c5'])('renders active %s facts, sources and memo without foreign case content', (id) => {
    vi.stubGlobal('localStorage', {getItem:() => null});
    const titles = {'c1-c2':'Atelier Lumière','c3':'Créations Verrières','c4':'Antoine Rigal','c5':'Trans-Alpine'};
    for (const mode of ['facts','chains','memo']) {
      vi.stubGlobal('location',{search:`?mode=${mode}&case=${id}&lang=en`});
      const html = renderToStaticMarkup(<LocaleProvider><App /></LocaleProvider>);
      expect(html).toContain(titles[id as keyof typeof titles]);
      expect(html).toContain('aria-label="Case"');
      expect(html).toContain('Connections');
      if (id !== 'c1-c2') {expect(html.replace(/<option[^>]*>.*?<\/option>/g, '')).not.toContain('Bâtiself'); expect(html).toContain('SYNTHETIC');}
      if (id === 'c5' && mode === 'chains') expect(html).toContain('2025-11-03');
    }
    vi.unstubAllGlobals();
  });
});
