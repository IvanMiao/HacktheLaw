import { useState, type ReactNode } from 'react';
import { useLocale } from '../i18n/useLocale';
import type { Anchor } from '../data/case';
import { DOCS, docById } from '../data/documents';
import { type Analysis, type AnalysisState } from '../engine/chains';
import { buildMemo, toMd, type Part } from '../engine/memo';
import { SourceChip } from './SourceChip';

export function Memo({ analysis, state, onAnchor }: { analysis: Analysis; state: AnalysisState; onAnchor: (a: Anchor) => void }) {
  const { t } = useLocale();
  const blocks = buildMemo(analysis, state, t);
  const [copied, setCopied] = useState(false);
  const cited = [...new Set(blocks.flatMap((x) => x.parts.filter((p): p is Anchor => typeof p !== 'string').map((p) => p.doc)))];
  const render = (parts: Part[]): ReactNode[] => parts.map((p, i) => (typeof p === 'string' ? p : <SourceChip key={i} anchor={p} onAnchor={onAnchor} />));
  const pending = Object.values(state.decisions).filter((decision) => decision !== 'supported').length;

  return (
    <div className="memo">
      <div className="memo-bar">
        <span className="ai-tag">{t('Draft')}</span>
        <span className="muted small">{t('Includes review statuses, notes and next actions')}{pending ? t(' · {count} assessment(s) not supported', { count: pending }) : ''}</span>
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(toMd(blocks, t)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t('Copied') : t('Copy Markdown')}</button>
      </div>
      <article className="memo-doc">
        {blocks.map((x, i) => {
          const c = render(x.parts);
          if (x.t === 'h1') return <h1 key={i}>{c}</h1>;
          if (x.t === 'h2') return <h2 key={i}>{c}</h2>;
          if (x.t === 'h3') return <h3 key={i}>{c}</h3>;
          if (x.t === 'li') return <p key={i} className="li">{c}</p>;
          if (x.t === 'note') return <p key={i} className="note">{c}</p>;
          return <p key={i}>{c}</p>;
        })}
        <h2>{t('5. Sources')}</h2>
        {cited.map((d) => <p key={d} className="li">{docById(d).title}{docById(d).provenance === 'mock' && docById(d).group !== 'case' ? t(' — mock, to replace') : ''}</p>)}
        <p className="muted small">{t('{count} documents in the file.', { count: DOCS.length })}</p>
      </article>
    </div>
  );
}
