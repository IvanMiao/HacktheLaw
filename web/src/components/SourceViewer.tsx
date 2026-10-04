import { useLocale } from '../i18n/useLocale';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useBundle } from '../data/useBundle';
import type { Anchor } from '../data/bundle';
import type { DocGroup } from '../data/documents';
import { fr } from '../engine/dates';
import { highlight, locate } from './highlight';

const GROUPS: [DocGroup, string][] = [['case', 'Case file'], ['caselaw', 'Case law'], ['statute', 'Statutes']];

type Props = { docId: string; onDoc: (id: string) => void; active: Anchor | null; quotesByDoc: Record<string, string[]>; onCollapse: () => void };

export function SourceViewer({ docId, onDoc, active, quotesByDoc, onCollapse }: Props) {
  const { t } = useLocale();
  const { docs, docOf } = useBundle();
  const doc = docOf(docId);
  const activeRef = useRef<HTMLElement | null>(null);
  const activeQuote = active && active.verified !== false && active.doc === docId ? active.quote : null;
  const quotes = quotesByDoc[docId] ?? [];
  const missing = activeQuote && !locate(doc.text, activeQuote);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [docId, activeQuote]);

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <select value={docId} onChange={(e) => onDoc(e.target.value)} aria-label={t('Document')}>
          {GROUPS.map(([g, label]) => (
            <optgroup key={g} label={t(label)}>
              {docs.filter((d) => d.group === g).map((d) => (
                <option key={d.id} value={d.id}>{d.date ? `${fr(d.date)} · ` : ''}{d.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="icon-btn" onClick={onCollapse} title={t('Collapse source viewer')} aria-label={t('Collapse source viewer')}>⟩</button>
      </div>
      <div className="viewer-meta">
        <span className={`prov prov-${doc.provenance}`}>{doc.provenance === 'real' ? 'Source · Judilibre' : t('Mock')}</span>
        {doc.note && <span className="muted">{t(doc.note)}</span>}
        {doc.pdf && <a href={doc.pdf} target="_blank" rel="noreferrer">{t('Open PDF ↗')}</a>}
      </div>
      {missing && <div className="callout amber">{t('Quote not found in this document — marked Unverified.')}</div>}
      <article lang="fr" className={`page ${doc.format}`}>
        {doc.format === 'markdown'
          ? <Markdown text={doc.text} quotes={quotes} active={activeQuote} activeRef={activeRef} />
          : doc.text.split('\n').map((line, i) => <p key={i} className={line.trim() ? '' : 'gap'}>{highlight(line, quotes, activeQuote, activeRef)}</p>)}
      </article>
    </div>
  );
}

function inline(text: string, quotes: string[], active: string | null, ref: RefObject<HTMLElement | null>): ReactNode[] {
  if (quotes.some((q) => locate(text.replace(/\*\*/g, ''), q))) return highlight(text.replace(/\*\*/g, ''), quotes, active, ref);
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function Markdown({ text, quotes, active, activeRef }: { text: string; quotes: string[]; active: string | null; activeRef: RefObject<HTMLElement | null> }) {
  const { t } = useLocale();
  const lines = text.split('\n').map((raw) => raw.trimEnd());
  const inCommentary = lines.reduce<boolean[]>((acc, line, i) => {
    acc.push(line.startsWith('## ') ? /^## (Portée|Référence)/.test(line) : i > 0 && acc[i - 1]);
    return acc;
  }, []);
  return (
    <>
      {lines.map((line, i) => {
        const commentary = inCommentary[i];
        const ins = (s: string) => inline(s, quotes, active, activeRef);
        if (line.startsWith('## ')) {
          return (
            <h4 key={i} className={commentary ? 'commentary-h' : ''}>
              {line.slice(3)}
              {commentary && <span className="tag-commentary">{t('Commentary — not citable')}</span>}
            </h4>
          );
        }
        const cls = commentary ? 'commentary' : '';
        if (line.startsWith('# ')) return <h3 key={i}>{line.slice(2)}</h3>;
        if (line.startsWith('> ')) return <blockquote key={i} className={cls}>{ins(line.slice(2))}</blockquote>;
        if (/^(-|\d+\.) /.test(line)) return <p key={i} className={`li ${cls}`}>{ins(line.replace(/^(-|\d+\.) /, ''))}</p>;
        if (!line) return <p key={i} className="gap" />;
        return <p key={i} className={cls}>{ins(line)}</p>;
      })}
    </>
  );
}
