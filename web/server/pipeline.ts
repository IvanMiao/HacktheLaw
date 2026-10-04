import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse, initialState } from '../src/engine/chains.js';
import { english } from '../src/i18n/translate.js';
import type { AgentEvent, CaseBundle } from '../src/data/bundle.js';
import type { InputFile, IngestedDoc } from './ingest.js';
import type { Doc } from '../src/data/documents.js';
import { ingest } from './ingest.js';
import { loadLibrary } from './library.js';
import { buildIndex } from './retrieval.js';
import { createLlmClient, type Usage } from './providers.js';
import { configuredProvider, providerConfig, type ModelSet, type Provider } from './config.js';
import { extractCase } from './agents/extract.js';
import { qualifyFacts } from './agents/qualify.js';

export type CaseInput = { sample: true } | { files: InputFile[] };
export type RunOptions = {
  provider?: Provider;
  models?: Partial<ModelSet>;
  asOf?: string;
  signal?: AbortSignal;
  fresh?: boolean;
  library?: Doc[];
  sampleDocs?: IngestedDoc[];
  cacheDir?: string;
  cache?: boolean;
};

function mergeUsage(target: Usage, next: Usage) {
  for (const [model, count] of Object.entries(next)) {
    const current = target[model] ??= { input: 0, output: 0, reasoning: 0 };
    current.input += count.input;
    current.output += count.output;
    current.reasoning += count.reasoning;
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function runCase(input: CaseInput, emit: (event: AgentEvent) => void, options: RunOptions = {}): Promise<CaseBundle> {
  const provider = options.provider ?? configuredProvider();
  const config = providerConfig(provider, options.models);
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const cacheDir = options.cacheDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '../.cache/bundles');
  const cacheKey = hash(JSON.stringify({ input, provider, models: config.models, asOf, reasoning: config.reasoning }));
  const cachePath = resolve(cacheDir, `${cacheKey}.json`);
  if (!options.fresh && options.cache !== false) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8')) as CaseBundle;
      cached.origin = 'cached';
      for (const item of cached.trace ?? []) emit(item);
      return cached;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        emit({ at: Date.now(), stage: 'ingest', kind: 'warn', text: 'Ignoring an unreadable cached bundle' });
      }
    }
  }

  const trace: AgentEvent[] = [];
  const push = (event: AgentEvent) => {
    trace.push(event);
    emit(event);
  };
  const client = createLlmClient(provider);
  const throwIfAborted = () => {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Run aborted');
  };
  const docsResult = await ingest(input, {
    provider,
    client,
    fastModel: config.models.fast,
    ocrModel: config.models.ocr,
    emit: push,
    signal: options.signal,
    sampleDocs: options.sampleDocs,
  });
  throwIfAborted();
  const library = options.library ?? await loadLibrary();
  const index = await buildIndex([...docsResult.docs, ...library], client, {
    emit: push, signal: options.signal,
    ...(options.cacheDir ? { cacheDir: resolve(options.cacheDir, 'emb') } : {}),
  });
  throwIfAborted();
  const extracted = await extractCase(docsResult.docs, index, {
    client,
    model: config.models.agent,
    asOf,
    emit: push,
    effort: config.reasoning,
    signal: options.signal,
  });
  throwIfAborted();
  const qualified = await qualifyFacts(extracted.facts, docsResult.docs, library, index, {
    client,
    model: config.models.agent,
    provider,
    profile: extracted.profile,
    emit: push,
    effort: config.reasoning,
    signal: options.signal,
  });
  throwIfAborted();
  const usage: Usage = {};
  mergeUsage(usage, docsResult.usage);
  mergeUsage(usage, extracted.usage);
  mergeUsage(usage, qualified.usage);
  const bundle: CaseBundle = {
    id: `case-${cacheKey.slice(0, 12)}`,
    origin: 'ai',
    provider,
    models: config.models,
    generatedAt: new Date().toISOString(),
    usage,
    steps: extracted.steps + qualified.steps,
    profile: extracted.profile,
    docs: docsResult.docs,
    facts: extracted.facts,
    qualifications: qualified.qualifications,
    trace,
  };
  const analysis = analyse(bundle, initialState(bundle), english);
  const summary = analysis.chains.map((chain) => `${chain.id} ${chain.status}`).join(' · ');
  push({ at: Date.now(), stage: 'engine', kind: 'note', text: summary || 'No consequence chains were derived' });
  bundle.trace = trace;
  if (options.cache !== false) {
    try {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cachePath, JSON.stringify(bundle, null, 2), 'utf8');
    } catch {
      push({ at: Date.now(), stage: 'engine', kind: 'warn', text: 'Bundle cache unavailable; returning uncached analysis' });
    }
  }
  return bundle;
}

export { configuredProvider, providerConfig };
