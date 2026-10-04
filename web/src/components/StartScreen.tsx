import { useLocale } from '../i18n/useLocale';
import { useRef, useState } from 'react';
import type { AgentEvent, CaseBundle } from '../data/bundle';
import aiBundleJson from '../../../data/sample-case/ai-bundle.json';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Glyphs';
import { FilmIntro } from './FilmIntro';

const aiBundle = aiBundleJson as unknown as CaseBundle;
type StreamLine = { type: 'event'; event: AgentEvent } | { type: 'bundle'; bundle: CaseBundle } | { type: 'error'; message: string };
type Props = {
  loading: boolean;
  onLoad: () => void;
  onDone: () => void;
  onError: (message: string) => void;
  onFallback: (message: string) => void;
  onReference: () => void;
  error?: string;
  onBundle?: (bundle: CaseBundle) => void;
};

async function encodeFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { name: file.name, mime: file.type || 'application/octet-stream', base64: btoa(binary) };
}

export function StartScreen({ loading, onLoad, onDone, onError, onFallback, onReference, error, onBundle }: Props) {
  const { t } = useLocale();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (input: { sample: true; fresh?: boolean } | { files: File[] }) => {
    setBusy(true);
    setEvents([]);
    onLoad();
    try {
      if ('sample' in input && !input.fresh) {
        onBundle?.({ ...aiBundle, origin: 'cached' });
        onDone();
        return;
      }
      const payload = 'sample' in input
        ? { sample: true, ...(input.fresh ? { fresh: true } : {}) }
        : { files: await Promise.all(input.files.map(encodeFile)) };
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error('Streaming responses are unavailable in this browser');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      let receivedBundle: CaseBundle | undefined;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const item = JSON.parse(line) as StreamLine;
        if (item.type === 'event') setEvents((previous) => [...previous, item.event].slice(-100));
        else if (item.type === 'error') throw new Error(item.message);
        else receivedBundle = item.bundle;
      };
      while (true) {
        const { value, done } = await reader.read();
        buffered += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        lines.forEach(consume);
        if (done) break;
      }
      consume(buffered);
      if (!receivedBundle) throw new Error('The pipeline ended without returning a case bundle');
      onBundle?.(receivedBundle);
      onDone();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if ('sample' in input) {
        onBundle?.({ ...aiBundle, origin: 'cached' });
        onFallback(message);
        onDone();
      } else onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="start">
      {!loading && <FilmIntro />}
      <div className="start-language"><LanguageSwitch /></div>
      <div className="start-card">
        <div className="brand-lg"><Logo size={44} /><span>Domino</span></div>
        <p className="tagline">{t('Find the domino that knocks out the claim.')}</p>
        {!loading ? (
          <>
            <input
              ref={fileInput}
              className="file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.eml,image/*"
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <div
              className="drop"
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click(); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); setFiles(Array.from(event.dataTransfer.files)); }}
            >
              <strong>{files.length ? files.map((file) => file.name).join(', ') : t('Drop a case file')}</strong>
              <span className="muted">{t('PDF, DOCX, text, Markdown, email, or image')}</span>
            </div>
            {error && <p className="callout amber" role="alert">{error}</p>}
            {files.length > 0 && (
              <button className="btn primary lg" onClick={() => void run({ files })} disabled={busy}>
                {t('Analyze uploaded files')}
              </button>
            )}
            <button className="btn primary lg" onClick={() => void run({ sample: true, fresh })} disabled={busy} autoFocus>
              {t('Analyse sample case with AI')}
            </button>
            <label className="fresh-run"><input type="checkbox" checked={fresh} onChange={(event) => setFresh(event.target.checked)} />{t('Fresh run (calls the model)')}</label>
            <button className="linkish reference-link" onClick={() => { onReference(); onDone(); }}>{t('Open hand-checked reference')}</button>
          </>
        ) : (
          <div className="stages" aria-live="polite">
            <strong>{t('Analyzing case files')}</strong>
            <ol>{events.length ? events.slice(-12).map((item, i) => (
              <li key={`${item.at}-${i}`} className={item.kind === 'error' || item.kind === 'warn' ? 'event-warn' : ''}>
                <span className="mono muted">{item.stage}</span>
                <span>{item.text}</span>
              </li>
            )) : <li>{t('Preparing pipeline…')}</li>}</ol>
          </div>
        )}
      </div>
    </main>
  );
}
