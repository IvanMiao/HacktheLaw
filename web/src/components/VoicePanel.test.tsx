import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoicePanel } from './VoicePanel';
import { buildContext } from '../voice/commands';
import { initialState } from '../engine/chains';

it('renders compact, accessible voice controls, editable fallback and explicit privacy/hypothetical labels', () => {
 const html = renderToStaticMarkup(<VoicePanel context={buildContext(initialState())} onIntent={()=>'result'} />);
 expect(html).toContain('aria-label="Voice command"');
 expect(html).toContain('<textarea');
 expect(html).toContain('Start recording');
 expect(html).toContain('15');
 expect(html).toContain('Cancel');
 expect(html).toContain('Mistral');
 expect(html).toContain('hypothetical');
 expect(html).toContain('中文');
 expect(html).not.toContain('SpeechRecognition');
});
