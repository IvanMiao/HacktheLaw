import type { CaseBundle } from '../data/bundle.js';
/** Import provenance comes from the server's explicit ingest event, not model metadata. */
export function isFirmImport(bundle:CaseBundle){
  return Boolean(bundle.trace?.some(event=>event.stage==='ingest' && event.text==='Imported source annotations; quote verification is not legal confirmation.'));
}
