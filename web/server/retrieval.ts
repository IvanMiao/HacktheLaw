import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentEvent } from '../src/data/bundle.js';
import type { Doc } from '../src/data/documents.js';
import type { LlmClient } from './providers.js';

export type Chunk = { doc: Doc; start: number; end: number; text: string };
export type ChunkHit = { doc_id: string; excerpt: string; score: number; doc: Doc; start: number; end: number };
export type RetrievalIndex = { chunks: Chunk[]; vectors: number[][] | null; model?: string; cacheDir?: string };
type Emit = (event: AgentEvent) => void;

const CHUNK_SIZE = 800;
const OVERLAP = 150;
const EMBED_BATCH = 32;
const CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../.cache/emb');
const STOPWORDS = new Set('a au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma mais me même mes moi mon ne nos notre nous on ou par pas pour qu que qui sa sans se ses son sur ta te tes ton tu un une vos votre vous'.split(' '));

export function chunkDocuments(docs: Doc[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const doc of docs) {
    const paragraphs = doc.text.split(/\n\s*\n/u);
    let cursor = 0;
    for (const paragraph of paragraphs) {
      const paragraphStart = doc.text.indexOf(paragraph, cursor);
      if (paragraphStart < 0) continue;
      cursor = paragraphStart + paragraph.length;
      if (!paragraph.trim()) continue;
      let start = paragraphStart;
      const paragraphEnd = paragraphStart + paragraph.length;
      while (start < paragraphEnd) {
        const end = Math.min(start + CHUNK_SIZE, paragraphEnd);
        chunks.push({ doc, start, end, text: doc.text.slice(start, end) });
        if (end === paragraphEnd) break;
        start = end - OVERLAP;
      }
    }
  }
  return chunks;
}

export function tokenize(value: string) {
  return (value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => !STOPWORDS.has(token));
}

function hash(model: string, text: string) {
  return createHash('sha256').update(model).update('\0').update(text).digest('hex');
}

async function cachedVector(model: string, text: string, cacheDir: string) {
  try {
    const value = JSON.parse(await readFile(resolve(cacheDir, `${hash(model, text)}.json`), 'utf8'));
    return Array.isArray(value) && value.every(Number.isFinite) ? value as number[] : null;
  } catch {
    return null;
  }
}

async function saveVector(model: string, text: string, vector: number[], cacheDir: string) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(resolve(cacheDir, `${hash(model, text)}.json`), JSON.stringify(vector));
}

async function embedCached(texts: string[], model: string, client: LlmClient, cacheDir: string, signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  let cacheModel = client.embeddingModel ?? model;
  let vectors = await Promise.all(texts.map((text) => cachedVector(cacheModel, text, cacheDir)));
  while (true) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    const indices = vectors.flatMap((vector, index) => vector ? [] : [index]).slice(0, EMBED_BATCH);
    if (!indices.length) break;
    const requestedModel = client.embeddingModel ?? cacheModel;
    const values = await client.embed(indices.map((index) => texts[index]), signal);
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    const activeModel = client.embeddingModel ?? requestedModel;
    if (activeModel !== cacheModel) {
      cacheModel = activeModel;
      vectors = await Promise.all(texts.map((text) => cachedVector(cacheModel, text, cacheDir)));
    }
    if (values.length !== indices.length || values.some((vector) => !Array.isArray(vector) || !vector.every(Number.isFinite))) {
      throw new Error('Embedding provider returned an invalid vector batch');
    }
    await Promise.all(indices.map(async (index, vectorIndex) => {
      if (vectors[index]) return;
      vectors[index] = values[vectorIndex];
      try {
        await saveVector(cacheModel, texts[index], values[vectorIndex], cacheDir);
      } catch {}
    }));
  }
  return vectors as number[][];
}

function event(emit: Emit | undefined, text: string) {
  emit?.({ at: Date.now(), stage: 'ingest', kind: 'warn', text });
}

export async function buildIndex(docs: Doc[], client: LlmClient, options: {
  emit?: Emit;
  model?: string;
  cacheDir?: string;
  signal?: AbortSignal;
} = {}): Promise<RetrievalIndex> {
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
  const chunks = chunkDocuments(docs);
  const cacheDir = options.cacheDir ?? CACHE_DIR;
  if (!chunks.length) return { chunks, vectors: [], cacheDir };
  const model = options.model ?? (process.env.DOMINO_EMBED_PROVIDER === 'openai' ? 'text-embedding-3-small' : 'mistral-embed');
  try {
    const vectors = await embedCached(chunks.map((chunk) => chunk.text), model, client, cacheDir, options.signal);
    return { chunks, vectors, model: client.embeddingModel ?? model, cacheDir };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    event(options.emit, `Embeddings unavailable; using keyword search (${error instanceof Error ? error.message : String(error)})`);
    return { chunks, vectors: null, model, cacheDir };
  }
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    aNorm += a[i] ** 2;
    bNorm += b[i] ** 2;
  }
  return aNorm && bNorm ? Math.max(0, dot / Math.sqrt(aNorm * bNorm)) : 0;
}

function bm25Scores(chunks: Chunk[], query: string) {
  const terms = [...new Set(tokenize(query))];
  const docs = chunks.map((chunk) => tokenize(chunk.text));
  const averageLength = docs.reduce((sum, tokens) => sum + tokens.length, 0) / Math.max(1, docs.length);
  return docs.map((tokens) => terms.reduce((score, term) => {
    const frequency = tokens.filter((token) => token === term).length;
    if (!frequency) return score;
    const documentFrequency = docs.filter((candidate) => candidate.includes(term)).length;
    const idf = Math.log(1 + (docs.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const denominator = frequency + 1.2 * (0.25 + 0.75 * (tokens.length / Math.max(1, averageLength)));
    return score + idf * ((frequency * 2.2) / denominator);
  }, 0));
}

export function rankChunks(index: RetrievalIndex, query: string, queryVector?: number[] | null, limit = 6, predicate: (doc: Doc) => boolean = () => true): ChunkHit[] {
  const selected = index.chunks.flatMap((chunk, indexInAll) => predicate(chunk.doc) ? [{ chunk, indexInAll }] : []);
  const chunks = selected.map(({ chunk }) => chunk);
  const keywordScores = bm25Scores(chunks, query);
  const maximum = Math.max(0, ...keywordScores);
  const hasEmbeddings = !!queryVector && !!index.vectors;
  return selected.map(({ chunk, indexInAll }, indexInSelected) => {
    const keyword = maximum > 0 ? keywordScores[indexInSelected] / maximum : 0;
    const semantic = hasEmbeddings ? cosine(index.vectors![indexInAll], queryVector!) : 0;
    const score = hasEmbeddings ? (0.6 * semantic) + (0.4 * keyword) : keyword;
    return {
      doc_id: chunk.doc.id,
      excerpt: chunk.text.slice(0, 285),
      score,
      doc: chunk.doc,
      start: chunk.start,
      end: chunk.end,
    };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function search(index: RetrievalIndex, query: string, client: LlmClient, options: {
  limit?: number;
  group?: Doc['group'];
  libraryOnly?: boolean;
  emit?: Emit;
  model?: string;
  signal?: AbortSignal;
} = {}): Promise<ChunkHit[]> {
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
  let queryVector: number[] | null = null;
  if (index.vectors) {
    try {
      const model = options.model ?? index.model ?? (process.env.DOMINO_EMBED_PROVIDER === 'openai' ? 'text-embedding-3-small' : 'mistral-embed');
      [queryVector] = await embedCached([query], model, client, index.cacheDir ?? CACHE_DIR, options.signal);
      if (index.model && client.embeddingModel && client.embeddingModel !== index.model) {
        event(options.emit, `Query embedding model changed to ${client.embeddingModel}; using keyword search`);
        queryVector = null;
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
      event(options.emit, `Query embedding unavailable; using keyword search (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return rankChunks(index, query, queryVector, options.limit ?? 6, (doc) =>
    options.libraryOnly ? doc.group !== 'case' : options.group === undefined || doc.group === options.group,
  );
}
