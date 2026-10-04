import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CasePicker } from './CasePicker';
import { SAMPLE } from '../data/sample';
import { getCase } from '../data/catalog';
import { LocaleContext } from '../i18n/useLocale';
import { translator } from '../i18n/translate';

const locale = { locale: 'en' as const, setLocale: () => {}, t: translator('en') };
const render = (bundle: typeof SAMPLE) => renderToStaticMarkup(<LocaleContext.Provider value={locale}><CasePicker bundle={bundle} onSelect={() => {}} /></LocaleContext.Provider>);

it('uses a styled menu trigger for the sample and preset cases instead of a native select', () => {
  for (const bundle of [SAMPLE, getCase('c3'), getCase('c4'), getCase('c5')]) {
    const html = render(bundle);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('<select');
    expect(html).toContain(typeof bundle.profile.title === 'string' ? bundle.profile.title : bundle.profile.title.en);
  }
});

it('shows an uploaded case as the selected item', () => {
  const html = render({ ...SAMPLE, id: 'case-upload', profile: { ...SAMPLE.profile, title: 'Uploaded case' } });
  expect(html).toContain('Uploaded case');
});
