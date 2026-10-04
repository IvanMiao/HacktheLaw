import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlmClient } from './providers';

const response = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const tool = { name: 'finish', description: 'finish', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Worker-compatible provider requests', () => {
  it.each(['openai', 'mistral'] as const)('calls %s with a redirect mode supported by Workers', async (provider) => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.redirect !== 'manual' && options?.redirect !== 'follow') {
        throw new TypeError('Invalid redirect value');
      }
      return response(provider === 'openai'
        ? { output_text: '{"ok":true}' }
        : { choices: [{ message: { content: '{"ok":true}' } }] });
    });
    const client = createLlmClient(provider, { apiKey: 'test-only', fetcher });
    await expect(client.json({ model: 'test', system: 'test', messages: [], schema: {}, name: 'test' }))
      .resolves.toMatchObject({ value: { ok: true } });
  });

  it.each([301, 302, 303, 307, 308])('rejects HTTP %i without following or retrying the redirect', async (status) => {
    const fetcher = vi.fn(async () => response({ private: 'provider details' }, status, {
      location: 'https://untrusted.example/collect',
    }));
    const client = createLlmClient('openai', { apiKey: 'test-only', fetcher });
    await expect(client.json({ model: 'test', system: 'test', messages: [], schema: {}, name: 'test' }))
      .rejects.toThrow(`AI provider redirect rejected (${status})`);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.openai.com/v1/responses', expect.objectContaining({ redirect: 'manual' }));
  });
});

describe('OpenAI Responses tool loop', () => {
  it('round-trips function calls and stops when the done handler returns true', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        output: [{ type: 'function_call', call_id: 'call-1', name: 'record', arguments: '{"id":"f1"}' }],
        usage: { input_tokens: 10, output_tokens: 5, output_tokens_details: { reasoning_tokens: 2 } },
      }))
      .mockResolvedValueOnce(response({
        output: [{ type: 'function_call', call_id: 'call-2', name: 'finish', arguments: '{}' }],
        usage: { input_tokens: 6, output_tokens: 3 },
      })) as unknown as typeof fetch;
    const seen: unknown[] = [];
    const client = createLlmClient('openai', { fetcher });

    const result = await client.runTools({
      model: 'gpt-6.1-sol',
      system: 'system',
      messages: [{ role: 'user', content: 'go' }],
      tools: [tool],
      handlers: {
        record: async (args) => { seen.push(args); return { stored: true }; },
        finish: async () => ({ done: true }),
      },
      maxSteps: 4,
      effort: 'medium',
    });

    const requests = fetcher.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(seen).toEqual([{ id: 'f1' }]);
    expect(result.steps).toBe(2);
    expect(result.usage['gpt-6.1-sol']).toEqual({ input: 16, output: 8, reasoning: 2 });
    expect(requests[0].tools[0]).toMatchObject({ name: 'finish', strict: true });
    expect(requests[0].reasoning).toEqual({ effort: 'medium' });
    expect(requests[0]).not.toHaveProperty('temperature');
    expect(requests[1].input).toContainEqual({ type: 'function_call', call_id: 'call-1', name: 'record', arguments: '{"id":"f1"}' });
    expect(requests[1].input.at(-1)).toEqual({ type: 'function_call_output', call_id: 'call-1', output: '{"stored":true}' });
  });

  it('returns structured JSON using a strict schema', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai');
    const fetcher = vi.fn().mockResolvedValue(response({
      output_text: '{"ok":true}',
      usage: { input_tokens: 2, output_tokens: 1 },
    })) as unknown as typeof fetch;
    const client = createLlmClient('openai', { fetcher });

    const result = await client.json<{ ok: boolean }>({
      model: 'gpt-6-luna',
      system: 'classify',
      messages: [{ role: 'user', content: 'doc' }],
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      name: 'meta',
      effort: 'low',
    });

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(result.value).toEqual({ ok: true });
    expect(body.text.format).toMatchObject({ type: 'json_schema', name: 'meta', strict: true });
    expect(body.reasoning).toEqual({ effort: 'low' });
  });
});

describe('Mistral chat tool loop', () => {
  it('sends tool output back before the next assistant turn', async () => {
    vi.stubEnv('MISTRAL_API_KEY', 'test-mistral');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read', arguments: '{"doc_id":"contract"}' } }] } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      }))
      .mockResolvedValueOnce(response({
        choices: [{ message: { role: 'assistant', content: 'done' } }],
        usage: { prompt_tokens: 12, completion_tokens: 2 },
      })) as unknown as typeof fetch;
    const client = createLlmClient('mistral', { fetcher, sleep: async () => undefined });

    const result = await client.runTools({
      model: 'ministral-14b-latest',
      system: 'system',
      messages: [{ role: 'user', content: 'read contract' }],
      tools: [tool],
      handlers: { read: async (args) => ({ text: args.doc_id }) },
      maxSteps: 3,
    });
    const requests = fetcher.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));

    expect(result.steps).toBe(2);
    expect(result.usage['ministral-14b-latest']).toEqual({ input: 20, output: 6, reasoning: 0 });
    expect(requests[0].tools[0].function.name).toBe('finish');
    expect(requests[1].messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call-1', content: '{"text":"contract"}' });
  });

  it('returns handler errors as tool output', async () => {
    vi.stubEnv('MISTRAL_API_KEY', 'test-mistral');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'broken', arguments: '{}' } }] } }],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { role: 'assistant', content: 'recovered' } }] })) as unknown as typeof fetch;
    const client = createLlmClient('mistral', { fetcher, sleep: async () => undefined });

    await client.runTools({
      model: 'ministral-14b-latest',
      system: 'system',
      messages: [{ role: 'user', content: 'go' }],
      tools: [tool],
      handlers: { broken: async () => { throw new Error('bad input'); } },
      maxSteps: 3,
    });

    const body = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(body.messages.at(-1)).toMatchObject({ role: 'tool', content: '{"error":"bad input"}' });
  });

  it('returns invalid tool JSON as recoverable tool output', async () => {
    vi.stubEnv('MISTRAL_API_KEY', 'test-mistral');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'broken', arguments: '{' } }] } }],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { role: 'assistant', content: 'recovered' } }] })) as unknown as typeof fetch;
    const client = createLlmClient('mistral', { fetcher, sleep: async () => undefined });

    await client.runTools({
      model: 'ministral-14b-latest',
      system: 'system',
      messages: [{ role: 'user', content: 'go' }],
      tools: [tool],
      handlers: { broken: async () => ({ unreachable: true }) },
      maxSteps: 3,
    });

    const body = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(body.messages.at(-1)).toMatchObject({ role: 'tool', content: '{"error":"Invalid JSON tool arguments"}' });
  });
});

it('honors retry-after on 429 responses', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-openai');
  vi.useFakeTimers();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ error: 'rate limited' }, 429, { 'retry-after': '2' }))
    .mockResolvedValueOnce(response({ output_text: '{"ok":true}' })) as unknown as typeof fetch;
  const client = createLlmClient('openai', {
    fetcher,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  const pending = client.json({
    model: 'gpt-6-luna',
    system: 'test',
    messages: [],
    schema: { type: 'object' },
    name: 'test',
  });

  await vi.advanceTimersByTimeAsync(1999);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  await expect(pending).resolves.toMatchObject({ value: { ok: true } });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('falls back from Mistral embeddings to OpenAI and records the active model', async () => {
  vi.stubEnv('MISTRAL_API_KEY', 'test-mistral');
  vi.stubEnv('OPENAI_API_KEY', 'test-openai');
  vi.stubEnv('DOMINO_EMBED_PROVIDER', 'mistral');
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ error: 'unavailable' }, 503))
    .mockResolvedValueOnce(response({ error: 'unavailable' }, 503))
    .mockResolvedValueOnce(response({ error: 'unavailable' }, 503))
    .mockResolvedValueOnce(response({ error: 'unavailable' }, 503))
    .mockResolvedValueOnce(response({ data: [{ index: 0, embedding: [0.1, 0.2] }] })) as unknown as typeof fetch;
  const client = createLlmClient('openai', { fetcher, sleep: async () => undefined });

  await expect(client.embed(['text'])).resolves.toEqual([[0.1, 0.2]]);
  expect(client.embeddingModel).toBe('text-embedding-3-small');
  expect(fetcher).toHaveBeenCalledTimes(5);
});
