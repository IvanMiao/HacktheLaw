import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { ModelSet, Provider } from './config.js';
import { configuredProvider, providerConfig } from './config.js';
import type { InputFile } from './ingest.js';
import { runCase } from './pipeline.js';

const MAX_BODY = 25 * 1024 * 1024;

type RequestBody = {
  sample?: boolean;
  files?: InputFile[];
  provider?: Provider;
  models?: Partial<ModelSet>;
  asOf?: string;
  fresh?: boolean;
};

class BodyTooLargeError extends Error {}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY) {
        settled = true;
        reject(new BodyTooLargeError('Request exceeds 25 MB'));
      } else if (!settled) chunks.push(chunk);
    });
    request.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('aborted', () => {
      if (!settled) reject(new Error('Request aborted'));
    });
    request.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function validFiles(value: unknown): value is InputFile[] {
  return Array.isArray(value) && value.length > 0 && value.every((file) =>
    file && typeof file.name === 'string' && typeof file.base64 === 'string'
      && (file.mime === undefined || typeof file.mime === 'string'),
  );
}

async function handleCases(request: IncomingMessage, response: ServerResponse) {
  const length = Number(request.headers['content-length'] ?? 0);
  if (length > MAX_BODY) return json(response, 413, { error: 'Request exceeds 25 MB' });
  let body: RequestBody;
  try {
    body = JSON.parse(await readBody(request)) as RequestBody;
  } catch (error) {
    return json(response, error instanceof BodyTooLargeError ? 413 : 400, {
      error: error instanceof BodyTooLargeError ? error.message : 'Invalid JSON request body',
    });
  }
  const input = body.sample === true
    ? { sample: true as const }
    : validFiles(body.files)
      ? { files: body.files.map((file) => ({ ...file, mime: file.mime || 'application/octet-stream' })) }
      : undefined;
  if (!input) return json(response, 400, { error: 'Provide sample:true or a non-empty files array' });

  const provider: Provider = configuredProvider(body.provider);
  const controller = new AbortController();
  let completed = false;
  const abort = () => {
    if (!completed) controller.abort();
  };
  request.on('aborted', abort);
  response.on('close', abort);
  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  try {
    const bundle = await runCase(input, (event) => {
      if (!controller.signal.aborted) response.write(`${JSON.stringify({ type: 'event', event })}\n`);
    }, {
      provider,
      models: body.models,
      asOf: body.asOf,
      fresh: body.fresh,
      signal: controller.signal,
    });
    if (!controller.signal.aborted) response.write(`${JSON.stringify({ type: 'bundle', bundle })}\n`);
  } catch (error) {
    if (!controller.signal.aborted) {
      const message = error instanceof Error ? error.message : String(error);
      response.write(`${JSON.stringify({ type: 'error', message })}\n`);
    }
  } finally {
    completed = true;
    response.end();
  }
}

function middleware(request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) {
  const pathname = new URL(request.url ?? '/', 'http://domino.local').pathname;
  if (pathname === '/api/health') {
    if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed' });
    const provider = configuredProvider();
    const config = providerConfig(provider);
    return json(response, 200, {
      providers: { openai: Boolean(process.env.OPENAI_API_KEY), mistral: Boolean(process.env.MISTRAL_API_KEY) },
      defaults: { provider, models: config.models },
    });
  }
  if (pathname === '/api/cases') {
    if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed' });
    void handleCases(request, response).catch((error) => {
      if (!response.headersSent) json(response, 500, { error: error instanceof Error ? error.message : String(error) });
      else if (!response.writableEnded) response.end();
    });
    return;
  }
  next();
}

export function dominoApi(): Plugin {
  return {
    name: 'domino-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
