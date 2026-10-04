export type JSONSchema = Record<string, unknown>;
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; name: string; mime: string; base64: string };
export type Msg = { role: 'system' | 'user'; content: string | ContentPart[] };
export type ToolDef = { name: string; description: string; parameters: JSONSchema };
export type Usage = Record<string, { input: number; output: number; reasoning: number }>;

export interface LlmClient {
  provider: 'openai' | 'mistral';
  embeddingModel?: string;
  runTools(o: {
    model: string;
    system: string;
    messages: Msg[];
    tools: ToolDef[];
    handlers: Record<string, (args: any) => Promise<unknown>>;
    maxSteps: number;
    effort?: string;
    signal?: AbortSignal;
    onStep?: (call: { name: string; args: any; result: unknown }) => void;
  }): Promise<{ steps: number; usage: Usage }>;
  json<T>(o: { model: string; system: string; messages: Msg[]; schema: JSONSchema; name: string; effort?: string; signal?: AbortSignal }): Promise<{ value: T; usage: Usage }>;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export type FileInput = { name: string; mime: string; base64: string };

type ProviderResponse = Record<string, any>;
type ProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  maxRequests?: number;
  retryTries?: number;
  fetcher?: typeof fetch;
  mistralRpm?: number;
  sleep?: (ms: number) => Promise<void>;
};

const OPENAI_URL = 'https://api.openai.com/v1';
const MISTRAL_URL = 'https://api.mistral.ai/v1';
const RETRY_TRIES = 4;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function abortableWait(ms: number, signal: AbortSignal | undefined, sleep: (ms: number) => Promise<void>) {
  if (!signal) return sleep(ms);
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return Promise.race([sleep(ms), aborted]).finally(() => signal.removeEventListener('abort', onAbort));
}

function tokenBucket(rpm: number, clock: () => number, sleep: (ms: number) => Promise<void>) {
  const rate = 60_000 / Math.max(1, rpm);
  let tokens = 1;
  let updatedAt = clock();
  let queue = Promise.resolve();
  return (signal?: AbortSignal) => {
    const turn = queue.then(async () => {
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      let now = clock();
      tokens = Math.min(1, tokens + ((now - updatedAt) / rate));
      if (tokens < 1) {
        await abortableWait((1 - tokens) * rate, signal, sleep);
        now = clock();
        tokens = Math.min(1, tokens + ((now - updatedAt) / rate));
      }
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      tokens = Math.max(0, tokens - 1);
      updatedAt = now;
    });
    queue = turn.catch(() => undefined);
    return turn;
  };
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function usageFor(model: string, usage: ProviderResponse = {}): Usage {
  const input = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const output = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const reasoning = Number(
    usage.output_tokens_details?.reasoning_tokens
      ?? usage.completion_tokens_details?.reasoning_tokens
      ?? usage.reasoning_tokens
      ?? 0,
  );
  return { [model]: { input, output, reasoning } };
}

function addUsage(target: Usage, next: Usage) {
  for (const [model, count] of Object.entries(next)) {
    const current = target[model] ??= { input: 0, output: 0, reasoning: 0 };
    current.input += count.input;
    current.output += count.output;
    current.reasoning += count.reasoning;
  }
}

function jsonText(response: ProviderResponse): string {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = (response.output ?? []).flatMap((item: ProviderResponse) =>
    item.type === 'message' ? (item.content ?? []).filter((part: ProviderResponse) => part.type === 'output_text').map((part: ProviderResponse) => part.text) : [],
  );
  if (chunks.length) return chunks.join('');
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part: ProviderResponse) => part.text ?? '').join('');
  throw new Error('Provider returned no text output');
}

function parseArgs(value: unknown): { args: any; error?: string } {
  if (typeof value !== 'string') return { args: value ?? {} };
  try {
    return { args: JSON.parse(value) };
  } catch {
    return { args: {}, error: 'Invalid JSON tool arguments' };
  }
}

function serialized(value: unknown) {
  return JSON.stringify(value ?? null);
}

function openAiInput(messages: Msg[]) {
  return messages.map(({ role, content }) => {
    if (typeof content === 'string') return { role, content };
    return {
      role,
      content: content.map((part) => part.type === 'text'
        ? { type: 'input_text', text: part.text }
        : part.mime === 'application/pdf'
          ? { type: 'input_file', filename: part.name, file_data: `data:${part.mime};base64,${part.base64}` }
          : { type: 'input_image', image_url: `data:${part.mime};base64,${part.base64}` }),
    };
  });
}

function mistralMessages(messages: Msg[]) {
  return messages.map(({ role, content }) => ({
    role,
    content: typeof content === 'string' ? content : content.map((part) => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      if (!part.mime.startsWith('image/')) throw new Error(`Mistral does not support ${part.mime} file input`);
      return { type: 'image_url', image_url: { url: `data:${part.mime};base64,${part.base64}` } };
    }),
  }));
}

function mistralToolDefs(tools: ToolDef[]) {
  return tools.map(({ name, description, parameters }) => ({
    type: 'function',
    function: { name, description, parameters },
  }));
}

export function createLlmClient(provider: 'openai' | 'mistral', options: ProviderOptions = {}): LlmClient & {
  ocr: (file: FileInput, model: string, prompt: string, signal?: AbortSignal) => Promise<{ text: string; usage: Usage }>;
} {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? wait;
  const mistralKey = provider === 'mistral' ? options.apiKey ?? process.env.MISTRAL_API_KEY : process.env.MISTRAL_API_KEY;
  const openAiKey = provider === 'openai' ? options.apiKey ?? process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY;
  const mistralUrl = provider === 'mistral' ? options.baseUrl ?? MISTRAL_URL : MISTRAL_URL;
  const openAiUrl = provider === 'openai' ? options.baseUrl ?? OPENAI_URL : OPENAI_URL;
  let requests = 0;
  const configuredRpm = options.mistralRpm ?? Number(process.env.DOMINO_MISTRAL_RPM ?? 25);
  const rpm = Number.isFinite(configuredRpm) && configuredRpm > 0 ? configuredRpm : 25;
  const takeMistralToken = tokenBucket(rpm, Date.now, sleep);
  let embeddingProvider: 'openai' | 'mistral' = process.env.DOMINO_EMBED_PROVIDER === 'openai' ? 'openai' : 'mistral';

  const request = async (url: string, key: string | undefined, body: ProviderResponse, limit = false, signal?: AbortSignal) => {
    if (!key) throw new Error(`${url.includes('mistral') ? 'MISTRAL_API_KEY' : 'OPENAI_API_KEY'} is required`);
    const tries = options.retryTries ?? RETRY_TRIES;
    for (let attempt = 0; attempt < tries; attempt++) {
      if (requests >= (options.maxRequests ?? Infinity)) throw new Error('Provider request budget exhausted');
      requests++;
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      if (limit) await takeMistralToken(signal);
      const response = await fetcher(url, {
        method: 'POST',
        // Workers support manual redirects; reject them without forwarding credentials.
        redirect: 'manual',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
      if (response.status >= 300 && response.status < 400) {
        throw new Error(`AI provider redirect rejected (${response.status})`);
      }
      if (response.ok) return response.json() as Promise<ProviderResponse>;
      const detail = await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === tries - 1) {
        throw new Error(`${url.includes('mistral') ? 'Mistral' : 'OpenAI'} request failed (${response.status}): ${detail}`);
      }
      const retryAfter = response.status === 429 ? retryAfterMs(response.headers.get('retry-after')) : undefined;
      await abortableWait(retryAfter ?? Math.min(1000 * (2 ** attempt), 8000), signal, sleep);
    }
    throw new Error('Provider request exhausted retries');
  };

  const chat = (body: ProviderResponse, signal?: AbortSignal) =>
    request(`${mistralUrl}/chat/completions`, mistralKey, body, true, signal);
  const responses = (body: ProviderResponse, signal?: AbortSignal) =>
    request(`${openAiUrl}/responses`, openAiKey, body, false, signal);

  const client: LlmClient & {
    ocr: (file: FileInput, model: string, prompt: string, signal?: AbortSignal) => Promise<{ text: string; usage: Usage }>;
  } = {
    provider,
    get embeddingModel() {
      return embeddingProvider === 'mistral' ? 'mistral-embed' : 'text-embedding-3-small';
    },

    async runTools({ model, system, messages, tools, handlers, maxSteps, effort, signal, onStep }) {
      const usage: Usage = {};
      let steps = 0;
      if (provider === 'openai') {
        const input: ProviderResponse[] = openAiInput([{ role: 'system', content: system }, ...messages]);
        while (steps < maxSteps) {
          steps++;
          const response = await responses({
            model,
            input,
            tools: tools.map(({ name, description, parameters }) => ({ type: 'function', name, description, strict: true, parameters })),
            tool_choice: 'auto',
            ...(effort ? { reasoning: { effort } } : {}),
          }, signal);
          addUsage(usage, usageFor(model, response.usage));
          const output = response.output ?? [];
          const calls = output.filter((item: ProviderResponse) => item.type === 'function_call');
          if (!calls.length) break;
          input.push(...output);
          let done = false;
          for (const call of calls) {
            const parsed = parseArgs(call.arguments);
            let result: unknown;
            if (parsed.error) result = { error: parsed.error };
            else if (!handlers[call.name]) result = { error: `Unknown tool ${call.name}` };
            else {
              try {
                result = await handlers[call.name](parsed.args);
              } catch (error) {
                result = { error: error instanceof Error ? error.message : String(error) };
              }
            }
            onStep?.({ name: call.name, args: parsed.args, result });
            if ((result as { done?: boolean } | null)?.done) { done = true; break; }
            input.push({ type: 'function_call_output', call_id: call.call_id, output: serialized(result) });
          }
          if (done) break;
        }
      } else {
        const conversation: ProviderResponse[] = [{ role: 'system', content: system }, ...mistralMessages(messages)];
        while (steps < maxSteps) {
          steps++;
          const response = await chat({
            model,
            messages: conversation,
            tools: mistralToolDefs(tools),
            tool_choice: 'auto',
          }, signal);
          addUsage(usage, usageFor(model, response.usage));
          const message = response.choices?.[0]?.message;
          if (!message) throw new Error('Mistral returned no assistant message');
          const calls = message.tool_calls ?? [];
          if (!calls.length) break;
          conversation.push(message);
          let done = false;
          for (const call of calls) {
            const parsed = parseArgs(call.function?.arguments);
            let result: unknown;
            if (parsed.error) result = { error: parsed.error };
            else if (!handlers[call.function?.name]) result = { error: `Unknown tool ${call.function?.name}` };
            else {
              try {
                result = await handlers[call.function.name](parsed.args);
              } catch (error) {
                result = { error: error instanceof Error ? error.message : String(error) };
              }
            }
            onStep?.({ name: call.function?.name ?? '', args: parsed.args, result });
            if ((result as { done?: boolean } | null)?.done) { done = true; break; }
            conversation.push({ role: 'tool', tool_call_id: call.id, content: serialized(result) });
          }
          if (done) break;
        }
      }
      return { steps, usage };
    },

    async json<T>({ model, system, messages, schema, name, effort, signal }: {
      model: string;
      system: string;
      messages: Msg[];
      schema: JSONSchema;
      name: string;
      effort?: string;
      signal?: AbortSignal;
    }) {
      if (provider === 'openai') {
        const response = await responses({
          model,
          input: openAiInput([{ role: 'system', content: system }, ...messages]),
          text: { format: { type: 'json_schema', name, schema, strict: true } },
          ...(effort ? { reasoning: { effort } } : {}),
        }, signal);
        return { value: JSON.parse(jsonText(response)) as T, usage: usageFor(model, response.usage) };
      }
      const response = await chat({
        model,
        messages: mistralMessages([{ role: 'system', content: system }, ...messages]),
        response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } },
      }, signal);
      return { value: JSON.parse(jsonText(response)) as T, usage: usageFor(model, response.usage) };
    },

    async embed(texts, signal) {
      const embedRequest = async (embeddingProvider: 'openai' | 'mistral') => {
        const model = embeddingProvider === 'mistral' ? 'mistral-embed' : 'text-embedding-3-small';
        const key = embeddingProvider === 'mistral' ? mistralKey : openAiKey;
        const url = `${embeddingProvider === 'mistral' ? MISTRAL_URL : OPENAI_URL}/embeddings`;
        const response = await request(url, key, { model, input: texts }, embeddingProvider === 'mistral', signal);
        return (response.data ?? []).sort((a: ProviderResponse, b: ProviderResponse) => a.index - b.index).map((item: ProviderResponse) => item.embedding as number[]);
      };
      if (embeddingProvider === 'openai') return embedRequest('openai');
      try {
        return await embedRequest('mistral');
      } catch (error) {
        if (signal?.aborted) throw error;
        if (!openAiKey) throw error;
        embeddingProvider = 'openai';
        return embedRequest('openai');
      }
    },

    async ocr(file, model, prompt, signal) {
      if (provider === 'openai') {
        const part: ContentPart = { type: 'file', ...file };
        const response = await responses({
          model,
          input: openAiInput([{ role: 'user', content: [{ type: 'text', text: prompt }, part] }]),
        }, signal);
        return { text: jsonText(response), usage: usageFor(model, response.usage) };
      }
      const response = await chat({
        model,
        messages: mistralMessages([{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'file', ...file }] }]),
      }, signal);
      return { text: jsonText(response), usage: usageFor(model, response.usage) };
    },
  };
  return client;
}
