import type { Anchor } from '../data/case';
import { docById } from '../data/documents';

export function SourceChip({ anchor, onAnchor }: { anchor: Anchor; onAnchor: (a: Anchor) => void }) {
  const d = docById(anchor.doc);
  return (
    <button className={`chip ${d.provenance === 'mock' && d.group !== 'case' ? 'chip-mock' : ''}`} onClick={() => onAnchor(anchor)} title={`« ${anchor.quote} »`}>
      <span className="chip-doc">{d.short}</span>
      {d.provenance === 'mock' && d.group !== 'case' && <span className="chip-flag">mock</span>}
    </button>
  );
}
