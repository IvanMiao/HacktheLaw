export type Provider = 'openai' | 'mistral';
export type ModelSet = { agent: string; fast: string; ocr: string };

export function defaultProvider(): Provider {
  return process.env.DOMINO_PROVIDER === 'mistral' ? 'mistral' : 'openai';
}

export function providerConfig(provider = defaultProvider(), overrides: Partial<ModelSet> = {}) {
  const defaults: ModelSet = provider === 'openai'
    ? { agent: 'gpt-6.1-sol', fast: 'gpt-6-luna', ocr: 'gpt-6.1-sol' }
    : { agent: 'ministral-14b-latest', fast: 'ministral-8b-latest', ocr: 'pixtral-12b-latest' };
  return {
    provider,
    models: {
      agent: overrides.agent ?? process.env.DOMINO_AGENT_MODEL ?? defaults.agent,
      fast: overrides.fast ?? process.env.DOMINO_FAST_MODEL ?? defaults.fast,
      ocr: overrides.ocr ?? process.env.DOMINO_OCR_MODEL ?? defaults.ocr,
    },
    reasoning: process.env.DOMINO_REASONING || 'medium',
  };
}

export function configuredProvider(value?: string): Provider {
  if (value === 'openai' || value === 'mistral') return value;
  return defaultProvider();
}
