import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoicePanel, OffOnlyFallback, DisabledVoicePanel } from './VoicePanel';
import { buildContext } from '../voice/commands';
import { initialState } from '../engine/chains';
import { getCase } from '../data/catalog';
import { LocaleContext } from '../i18n/useLocale';
import { translator } from '../i18n/translate';

it('renders compact, accessible voice controls, editable fallback and explicit privacy/hypothetical labels', () => {
 const sample = getCase('c1-c2');
 const html = renderToStaticMarkup(<VoicePanel context={buildContext(initialState(sample), sample)} onIntent={()=>'result'} />);
 expect(html).toContain('aria-label="Voice command"');
 expect(html).toContain('<textarea');
 expect(html).toContain('role="switch"');
 expect(html).toContain('aria-checked="false"');
 expect(html).toContain('Continuous listening');
 expect(html).toContain('Partial transcript');
 expect(html).toContain('data-testid="voice-diagnostics"');
 expect(html).toContain('Pipeline diagnostics');
 expect(html).toContain('automatically');
 expect(html).not.toContain('Start recording');
 expect(html).not.toContain('Stop recording');
 expect(html).not.toContain('Apply command');
 expect(html).toContain('Cancel');
 expect(html).toContain('Mistral');
 expect(html).toContain('hypothetical');
 expect(html).toContain('中文');
 expect(html).not.toContain('SpeechRecognition');
});
it('removes the typed submit UI entirely while listening is ON; fallback returns when OFF',()=>{
 const fallback=<form><textarea aria-label="Voice command"/><button>Send typed command</button></form>;
 expect(renderToStaticMarkup(<OffOnlyFallback listening={true}>{fallback}</OffOnlyFallback>)).toBe('');
 expect(renderToStaticMarkup(<OffOnlyFallback listening={false}>{fallback}</OffOnlyFallback>)).toContain('Send typed command');
});
it('shows the translated demo-only voice note for non-demo bundles', () => {
 const locale = { locale: 'en' as const, setLocale: () => {}, t: translator('en') };
 const html = renderToStaticMarkup(<LocaleContext.Provider value={locale}><DisabledVoicePanel /></LocaleContext.Provider>);
 expect(html).toContain('Voice commands are available for the demo cases only.');
});
