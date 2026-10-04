import library from '../../../data/library.json';
import { pdfFile, textFile } from './files';

export type DocGroup = 'case' | 'caselaw' | 'statute';

export type Doc = {
  id: string;
  group: DocGroup;
  title: string;
  short: string;
  date?: string;
  provenance: 'real' | 'mock';
  format: 'text' | 'markdown';
  text: string;
  pdf?: string;
  note?: string;
};

type LibraryDoc = Omit<Doc, 'text' | 'pdf'> & { file: string; pdf?: string };

export const LIBRARY: Doc[] = (library as LibraryDoc[]).map(({ file, pdf, ...doc }) => ({
  ...doc,
  text: textFile(file),
  ...(pdf ? { pdf: pdfFile(pdf) } : {}),
}));
