import mammoth from 'mammoth';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Doc } from '../src/data/documents.js';
import type { AgentEvent } from '../src/data/bundle.js';
import { createLlmClient, type FileInput, type LlmClient, type Usage } from './providers.js';
import { META_PROMPT, OCR_PROMPT } from './agents/prompts.js';

export type InputFile = FileInput;
export type DocType = 'contract' | 'invoice' | 'correspondence' | 'formal_notice' | 'writ' | 'registry_record' | 'court_order' | 'exhibits_list' | 'pleading' | 'judgment' | 'other';
export type IngestedDoc = Doc & { docType: DocType };
type Metadata = { title: string; short: string; date: string; docType: DocType };
type Emit = (event: AgentEvent) => void;

const DOC_TYPES: DocType[] = ['contract', 'invoice', 'correspondence', 'formal_notice', 'writ', 'registry_record', 'court_order', 'exhibits_list', 'pleading', 'judgment', 'other'];
const META_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    short: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD or empty string' },
    docType: { type: 'string', enum: DOC_TYPES },
  },
  required: ['title', 'short', 'date', 'docType'],
  additionalProperties: false,
};

function extension(name: string) {
  return name.toLowerCase().split('.').at(-1) ?? '';
}

function mimeOf(file: InputFile) {
  if (file.mime && file.mime !== 'application/octet-stream') return file.mime;
  const ext = extension(file.name);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'md') return 'text/markdown';
  if (ext === 'eml') return 'message/rfc822';
  return 'text/plain';
}

function slug(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/g, '') || 'document';
}

function uniqueId(short: string, used: Set<string>) {
  const base = slug(short);
  let id = base;
  let n = 2;
  while (used.has(id)) {
    const suffix = `-${n++}`;
    id = `${base.slice(0, 24 - suffix.length).replace(/-+$/g, '')}${suffix}`;
  }
  used.add(id);
  return id;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await fn(items[index], index);
    }
  }));
  return result;
}

function event(emit: Emit, kind: AgentEvent['kind'], text: string) {
  emit({ at: Date.now(), stage: 'ingest', kind, text });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

async function sampleDocs(): Promise<IngestedDoc[]> {
  const DATA_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');
  const manifest = JSON.parse(await readFile(resolve(DATA_ROOT, 'sample-case/manifest.json'), 'utf8')) as {
    id: string; file: string; title: string; short: string; date: string; provenance: 'mock'; note: string;
  }[];
  return Promise.all(manifest.map(async (item) => ({
    id: item.id,
    group: 'case' as const,
    title: item.title,
    short: item.short,
    date: item.date,
    provenance: item.provenance,
    format: 'text' as const,
    text: (await readFile(resolve(DATA_ROOT, item.file), 'utf8')).replace(/\n$/, ''),
    note: item.note,
    docType: inferSampleType(item.id),
  })));
}

function inferSampleType(id: string): DocType {
  const types: Record<string, DocType> = {
    contract: 'contract', invoice: 'invoice', email: 'correspondence', notice: 'formal_notice',
    writ1: 'writ', registry: 'registry_record', order: 'court_order', writ2: 'writ', pieces: 'exhibits_list',
  };
  return types[id] ?? 'other';
}

async function extractText(file: InputFile, provider: 'openai' | 'mistral', ocrModel: string, client: LlmClient & { ocr: (file: FileInput, model: string, prompt: string, signal?: AbortSignal) => Promise<{ text: string; usage: Usage }> }, emit: Emit, signal?: AbortSignal) {
  throwIfAborted(signal);
  const mime = mimeOf(file);
  const ext = extension(file.name);
  const bytes = Buffer.from(file.base64, 'base64');
  if (['txt', 'md', 'eml'].includes(ext)) return { text: bytes.toString('utf8'), usage: {} };
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return { text: result.value, usage: {} };
  }
  if (mime === 'application/pdf' || mime.startsWith('image/')) {
    if (provider === 'mistral' && mime === 'application/pdf') {
      event(emit, 'error', 'PDF OCR needs OPENAI_API_KEY or mistral-ocr quota');
      if (!process.env.OPENAI_API_KEY) throw new Error('PDF OCR needs OPENAI_API_KEY or mistral-ocr quota');
      const openai = createLlmClient('openai');
      return openai.ocr({ ...file, mime }, process.env.DOMINO_OCR_MODEL || 'gpt-6.1-sol', OCR_PROMPT, signal);
    }
    return client.ocr({ ...file, mime }, ocrModel, OCR_PROMPT, signal);
  }
  throw new Error(`Unsupported document type: ${file.name}`);
}

export async function ingest(input: { sample: true } | { files: InputFile[] }, options: {
  provider: 'openai' | 'mistral';
  client: LlmClient & { ocr: (file: FileInput, model: string, prompt: string, signal?: AbortSignal) => Promise<{ text: string; usage: Usage }> };
  fastModel: string;
  ocrModel: string;
  emit: Emit;
  signal?: AbortSignal;
  sampleDocs?: IngestedDoc[];
}): Promise<{ docs: IngestedDoc[]; usage: Usage }> {
  throwIfAborted(options.signal);
  if ('sample' in input) return { docs: options.sampleDocs ?? await sampleDocs(), usage: {} };
  if (!input.files.length) throw new Error('At least one document is required');
  const usage: Usage = {};
  const extracted = await mapLimit(input.files, 4, async (file, index) => {
    throwIfAborted(options.signal);
    const result = await extractText(file, options.provider, options.ocrModel, options.client, options.emit, options.signal);
    event(options.emit, 'tool', `read ${file.name}`);
    for (const [model, values] of Object.entries(result.usage)) {
      const current = usage[model] ??= { input: 0, output: 0, reasoning: 0 };
      current.input += values.input;
      current.output += values.output;
      current.reasoning += values.reasoning;
    }
    return { file, text: result.text, index };
  });
  const metadata = await mapLimit(extracted, 4, async ({ file, text }) => {
    throwIfAborted(options.signal);
    const result = await options.client.json<Metadata>({
      model: options.fastModel,
      system: META_PROMPT,
      messages: [{ role: 'user', content: `Filename: ${file.name}\n\n${text}` }],
      schema: META_SCHEMA,
      name: 'document_metadata',
      effort: 'low',
      signal: options.signal,
    });
    for (const [model, values] of Object.entries(result.usage)) {
      const current = usage[model] ??= { input: 0, output: 0, reasoning: 0 };
      current.input += values.input;
      current.output += values.output;
      current.reasoning += values.reasoning;
    }
    return result.value;
  });
  const used = new Set<string>();
  const docs = extracted.map(({ file, text }, index) => {
    const details = metadata[index];
    const id = uniqueId(details.short, used);
    event(options.emit, 'tool', `metadata ${id}`);
    const ext = extension(file.name);
    return {
      id,
      group: 'case' as const,
      title: details.title,
      short: details.short,
      ...(details.date ? { date: details.date } : {}),
      provenance: 'uploaded' as const,
      format: ext === 'md' ? 'markdown' as const : 'text' as const,
      text,
      docType: details.docType,
    };
  });
  return { docs, usage };
}
