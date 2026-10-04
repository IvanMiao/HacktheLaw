import manifest from '../../../data/sample-case/manifest.json';
import type { CaseBundle } from './bundle';
import './documents';
import { textFile } from './files';
import { SAMPLE_DATA } from './sampleData';

const caseDocs = (manifest as { id: string; file: string; title: string; short: string; date: string; provenance: 'mock'; note: string }[]).map((doc) => ({
  ...doc,
  group: 'case' as const,
  format: 'text' as const,
  text: textFile(doc.file).replace(/\n$/, ''),
}));

export const SAMPLE: CaseBundle = { ...SAMPLE_DATA, docs: caseDocs };
