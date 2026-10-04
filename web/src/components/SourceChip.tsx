import { useLocale } from '../i18n/useLocale';
import type { Anchor } from '../data/case';
import { docById } from '../data/documents';

export function SourceChip({ anchor, onAnchor }: { anchor: Anchor; onAnchor: (a: Anchor) => void }) {
  const { t } = useLocale();
  const d = docById(anchor.doc);
  return (
    <button className={`chip ${d.provenance === 'mock' && d.group !== 'case' ? 'chip-mock' : ''}`} onClick={() => onAnchor(anchor)} title={`« ${anchor.quote} »`}>
      <span className="chip-doc">{t(d.short)}</span>
      {d.provenance === 'mock' && d.group !== 'case' && <span className="chip-flag">{t('mock')}</span>}
    </button>
  );
}
