import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { library, sampleDocs } from '#domino-data';
import { configuredProvider, providerConfig } from './config.js';
import { runCase, type CaseInput } from './pipeline.js';
import { createHandler } from './voice-api.js';
import { bridgeRealtime, REALTIME_MODEL } from './realtime-bridge.js';
import type { IngestedDoc } from './ingest.js';
import cachedSample from '../../data/sample-case/ai-bundle.json';

type Socket = WebSocket & { accept(): void };
declare const WebSocketPair: { new(): { 0: Socket; 1: Socket } };
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MISTRAL_API_KEY?: string;
  OPENAI_API_KEY?: string;
  MISTRAL_INTENT_MODEL?: string;
};
type Context = { waitUntil(promise: Promise<unknown>): void };
const MAX_BODY = 25 * 1024 * 1024;

function json(status: number, value: unknown) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new RequestError(413, 'Request too large.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new RequestError(413, 'Request too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

async function cases(request: Request, env: Env, ctx: Context) {
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'Use application/json.' });
  let body;
  try { body = JSON.parse((await readBody(request, MAX_BODY)).toString('utf8')); }
  catch (error) {
    if (error instanceof RequestError) throw error;
    return json(400, { error: 'Invalid JSON request body.' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Invalid request.' });
  let input: CaseInput;
  if (body.sample === true) input = { sample: true };
  else if (Array.isArray(body.files) && body.files.length && body.files.every((file: any) =>
    file && typeof file.name === 'string' && typeof file.base64 === 'string'
      && (file.mime === undefined || typeof file.mime === 'string'),
  )) input = { files: body.files.map((file: any) => ({ name: file.name, base64: file.base64, mime: file.mime || 'application/octet-stream' })) };
  else return json(400, { error: 'Provide sample:true or a non-empty files array.' });
  if (body.asOf !== undefined && (typeof body.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.asOf))) {
    return json(400, { error: 'asOf must be YYYY-MM-DD.' });
  }
  if ('sample' in input && body.fresh !== true) {
    // The recorded analysis is the default demo; only Fresh run calls the model.
    const bundle = { ...cachedSample, origin: 'cached' };
    const lines = [
      { type: 'event', event: { at: Date.now(), stage: 'ingest', kind: 'note', text: 'Loaded recorded sample analysis' } },
      { type: 'bundle', bundle },
    ];
    return new Response(lines.map((line) => JSON.stringify(line)).join('\n') + '\n', {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
  const provider = configuredProvider(body.provider);
  if (!process.env[provider === 'mistral' ? 'MISTRAL_API_KEY' : 'OPENAI_API_KEY']) return json(503, { error: 'AI provider is not configured.' });
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(output) {
      const send = (item: unknown) => { if (!controller.signal.aborted) output.enqueue(encoder.encode(`${JSON.stringify(item)}\n`)); };
      // Workers' /tmp is scoped to this request. No case documents persist remotely.
      const task = runCase(input, (event) => send({ type: 'event', event }), {
        provider, asOf: body.asOf, fresh: true, cache: false,
        library, sampleDocs: sampleDocs as IngestedDoc[], cacheDir: '/tmp/domino',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8 * 60_000)]),
      }).then((bundle) => send({ type: 'bundle', bundle }))
        .catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : '';
          console.error('AI pipeline failed', detail.slice(0, 500) || 'Unknown pipeline error');
          const code = /subrequest/i.test(detail) ? 'subrequest_limit'
            : /invocation/i.test(detail) ? 'worker_invocation_limit'
            : /429/.test(detail) ? 'provider_rate_limit'
            : /abort|timeout/i.test(detail) ? 'analysis_timeout' : 'analysis_failed';
          send({ type: 'error', code, message: `AI analysis failed (${code}). Check provider availability, quota and file format, then retry.` });
        })
        .finally(() => {
          request.signal.removeEventListener('abort', abort);
          if (!controller.signal.aborted) output.close();
        });
      ctx.waitUntil(task);
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Content-Type-Options': 'nosniff' } });
}

// Keep the existing command validation and provider error handling in one place.
async function voice(request: Request, env: Env) {
  const path = new URL(request.url).pathname;
  const limit = path === '/api/transcribe' ? 4 * 1024 * 1024 : 96 * 1024;
  const bytes = await readBody(request, limit);
  const incoming = Readable.from([bytes]) as unknown as IncomingMessage;
  incoming.url = path;
  incoming.method = request.method;
  incoming.headers = Object.fromEntries(request.headers);
  const outgoing = new EventEmitter() as ServerResponse;
  let status = 200;
  const headers = new Headers();
  let ended = false;
  Object.defineProperty(outgoing, 'writableEnded', { get: () => ended });
  outgoing.setHeader = ((key: string, value: string) => { headers.set(key, value); return outgoing; }) as ServerResponse['setHeader'];
  outgoing.writeHead = ((code: number, values: Record<string, string>) => {
    status = code;
    for (const [key, value] of Object.entries(values ?? {})) headers.set(key, value);
    return outgoing;
  }) as ServerResponse['writeHead'];
  const abort = () => outgoing.emit('close');
  request.signal.addEventListener('abort', abort, { once: true });
  return new Promise<Response>((resolve, reject) => {
    outgoing.end = ((body: string) => {
      ended = true;
      request.signal.removeEventListener('abort', abort);
      resolve(new Response(body, { status, headers }));
      return outgoing;
    }) as ServerResponse['end'];
    createHandler({ apiKey: env.MISTRAL_API_KEY, intentModel: env.MISTRAL_INTENT_MODEL, origins: new Set([new URL(request.url).origin]) })(incoming, outgoing).catch(reject);
  });
}

class WorkerSocket extends EventEmitter {
  raw: Socket;
  constructor(raw: Socket) {
    super(); this.raw = raw;
    raw.addEventListener('message', (event) => {
      const binary = typeof event.data !== 'string';
      this.emit('message', Buffer.from(binary ? new Uint8Array(event.data) : event.data), binary);
    });
    raw.addEventListener('close', (event) => this.emit('close', event.code));
    raw.addEventListener('error', () => this.emit('error', new Error('WebSocket unavailable')));
  }
  get readyState() { return this.raw.readyState; }
  get bufferedAmount() { return this.raw.bufferedAmount ?? 0; }
  send(data: string) { this.raw.send(data); }
  close(code = 1000) { this.raw.close(code); }
  terminate() { this.raw.close(1000); }
}

async function realtime(request: Request, env: Env) {
  if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json(426, { error: 'WebSocket upgrade required.' });
  if (!request.headers.get('origin') || new URL(request.url).search) return json(403, { error: 'Origin or route not allowed.' });
  if (!env.MISTRAL_API_KEY) return json(503, { error: 'Mistral is not configured.' });
  const upstream = await fetch(`https://api.mistral.ai/v1/audio/transcriptions/realtime?model=${REALTIME_MODEL}`, {
    headers: { Upgrade: 'websocket', Authorization: `Bearer ${env.MISTRAL_API_KEY}` }, signal: AbortSignal.timeout(10_000),
  });
  const provider = (upstream as Response & { webSocket?: Socket }).webSocket;
  if (!provider) return json(502, { error: 'Mistral realtime unavailable. Check quota and model access.' });
  const pair = new WebSocketPair();
  pair[1].accept();
  // Attach protocol listeners before accepting the provider so no handshake event is lost.
  bridgeRealtime(new WorkerSocket(pair[1]), new WorkerSocket(provider));
  provider.accept();
  return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
}

export default {
  async fetch(request: Request, env: Env, ctx: Context) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json(403, { error: 'Origin not allowed.' });
    try {
      if (url.pathname === '/api/health') {
        if (request.method !== 'GET') return json(405, { error: 'Use GET.' });
        const provider = configuredProvider();
        return json(200, { runtime: 'cloudflare-worker', providers: { openai: Boolean(env.OPENAI_API_KEY), mistral: Boolean(env.MISTRAL_API_KEY) }, defaults: { provider, models: providerConfig(provider).models } });
      }
      if (url.pathname === '/api/cases') return await cases(request, env, ctx);
      if (url.pathname === '/api/realtime') return await realtime(request, env);
      if (['/api/status', '/api/intent', '/api/transcribe'].includes(url.pathname)) return await voice(request, env);
      return json(404, { error: 'Not found.' });
    } catch (error) {
      return json(error instanceof RequestError ? error.status : 500, { error: error instanceof RequestError ? error.message : 'Backend unavailable. Please retry.' });
    }
  },
};
