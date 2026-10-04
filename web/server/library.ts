import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Doc } from '../src/data/documents.js';

const DATA_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');

export async function loadLibrary(): Promise<Doc[]> {
  const entries = JSON.parse(await readFile(resolve(DATA_ROOT, 'library.json'), 'utf8')) as (Omit<Doc, 'text' | 'pdf'> & { file: string })[];
  return Promise.all(entries.map(async ({ file, ...doc }) => ({
    ...doc,
    text: await readFile(resolve(DATA_ROOT, file), 'utf8'),
  })));
}
