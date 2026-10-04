import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { Anchor } from '../data/case';
import { DOCS, docById, type DocGroup } from '../data/documents';
import { fr } from '../engine/dates';
import { highlight, locate } from './highlight';

const GROUPS: [DocGroup, string][] = [['case', 'Case file'], ['caselaw', 'Case law'], ['statute', 'Statutes']];

type Props = { docId: string; onDoc: (id: string) => void; active: Anchor | null; quotesByDoc: Record<string, string[]>; onCollapse: () => void };

export function SourceViewer({ docId, onDoc, active, quotesByDoc, onCollapse }: Props) {
  const doc = docById(docId);
  const activeRef = useRef<HTMLElement | null>(null);
  const activeQuote = active && active.doc === docId ? active.quote : null;
  const quotes = quotesByDoc[docId] ?? [];
  const missing = activeQuote && !locate(doc.text, activeQuote);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [docId, activeQuote]);

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <select value={docId} onChange={(e) => onDoc(e.target.value)} aria-label="Document">
          {GROUPS.map(([g, label]) => (
            <optgroup key={g} label={label}>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <option key={d.id} value={d.id}>{d.date ? `${fr(d.date)} · ` : ''}{d.title}{d.provenance === 'mock' ? ' (mock)' : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="icon-btn" onClick={onCollapse} title="Collapse source viewer" aria-label="Collapse source viewer">⟩</button>
      </div>
      <div className="viewer-meta">
        <span className={`prov prov-${doc.provenance}`}>{doc.provenance === 'real' ? 'Source · Judilibre' : 'Mock'}</span>
        {doc.note && <span className="muted">{doc.note}</span>}
        {doc.pdf && <a href={doc.pdf} target="_blank" rel="noreferrer">Open PDF ↗</a>}
      </div>
      {missing && <div className="callout amber">Quote not found in this document — marked Unverified.</div>}
      <article className={`page ${doc.format}`}>
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
              {commentary && <span className="tag-commentary">Commentary — not citable</span>}
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
