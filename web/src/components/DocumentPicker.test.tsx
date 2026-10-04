import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentPicker } from './DocumentPicker';
import { SAMPLE } from '../data/sample';
import { LIBRARY } from '../data/documents';
import { LocaleContext } from '../i18n/useLocale';
import { translator } from '../i18n/translate';

const locale = { locale: 'en' as const, setLocale: () => {}, t: translator('en') };

it('uses the styled document menu for case files, case law and statutes', () => {
  const docs = [...SAMPLE.docs, ...LIBRARY];
  for (const group of ['case', 'caselaw', 'statute']) {
    const doc = docs.find((item) => item.group === group);
    expect(doc).toBeDefined();
    const html = renderToStaticMarkup(<LocaleContext.Provider value={locale}><DocumentPicker docs={docs} docId={doc!.id} onDoc={() => {}} /></LocaleContext.Provider>);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(doc!.title);
    expect(html).not.toContain('<select');
  }
});
