import library from '../../../data/library.json';
import { pdfFile, textFile } from './files.js';
import { registerLibrary } from './bundle.js';

export type DocGroup = 'case' | 'caselaw' | 'statute';

export type Doc = {
  id: string;
  group: DocGroup;
  title: string;
  short: string;
  date?: string;
  provenance: 'real' | 'mock' | 'uploaded';
  format: 'text' | 'markdown';
  text: string;
  docType?: string;
  pdf?: string;
  note?: string;
};

type LibraryDoc = Omit<Doc, 'text' | 'pdf'> & { file: string; pdf?: string };

export const LIBRARY: Doc[] = (library as LibraryDoc[]).map(({ file, pdf, ...doc }) => ({
  ...doc,
  text: textFile(file),
  ...(pdf ? { pdf: pdfFile(pdf) } : {}),
}));

registerLibrary(LIBRARY);
