import { useState, type ReactNode } from 'react';
import { useLocale } from '../i18n/useLocale';
import { useBundle } from '../data/useBundle';
import type { Anchor } from '../data/bundle';
import { isContested, type Analysis, type AnalysisState } from '../engine/chains';
import { buildMemo, toMd, type Part } from '../engine/memo';
import { SourceChip } from './SourceChip';

export function Memo({ analysis, state, onAnchor }: { analysis: Analysis; state: AnalysisState; onAnchor: (a: Anchor) => void }) {
  const { t } = useLocale();
  const { bundle, docOf } = useBundle();
  const blocks = buildMemo(bundle, analysis, state, t);
  const [copied, setCopied] = useState(false);
  const cited = [...new Set(blocks.flatMap((x) => x.parts.filter((p): p is Anchor => typeof p !== 'string').map((p) => p.doc)))];
  const render = (parts: Part[]): ReactNode[] => parts.map((p, i) => (typeof p === 'string' ? p : <SourceChip key={i} anchor={p} onAnchor={onAnchor} />));
  const pending = analysis.contestedQuals.filter((q) => isContested(bundle, state, q)).length;

  return (
    <div className="memo">
      <div className="memo-bar">
        <span className="ai-tag">{t('Draft')}</span>
        {pending > 0 && <span className="muted small">{t('{count} qualification(s) still provisional', { count: pending })}</span>}
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(toMd(bundle, blocks, t)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t('Copied') : t('Copy Markdown')}</button>
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
        <h2>5. Sources</h2>
        {cited.map((d) => <p key={d} className="li">{t(docOf(d).title)}{docOf(d).provenance === 'mock' && docOf(d).group !== 'case' ? t(' — mock, to replace') : ''}</p>)}
        <p className="muted small">{t('{count} documents in the file.', { count: bundle.docs.length })}</p>
      </article>
    </div>
  );
}
