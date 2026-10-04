import { describe, expect, it } from 'vitest';
import type { FactRole } from '../../src/data/bundle';
import { SAMPLE } from '../../src/data/sample';
import type { IngestedDoc } from '../ingest';
import type { LlmClient } from '../providers';
import { extractCase } from './extract';

const docs = SAMPLE.docs as IngestedDoc[];
const profileArgs = {
  title: 'Atelier Lumière v. Bâtiself',
  court: 'Tribunal de commerce de Bordeaux',
  court_type: 'tribunal_commerce',
  claimant: 'Atelier Lumière SAS',
  defendant: 'Bâtiself SARL',
  side: 'Defendant (Bâtiself SARL)',
  amount: '18 400 €',
  relationship: 'commercial',
  summary_en: '',
  summary_fr: '',
};

function factArgs(role: FactRole, values: Record<string, unknown> = {}) {
  const placement = role === 'writ_placement';
  return {
    doc_id: placement ? 'registry' : 'writ1',
    role,
    date: placement ? '2026-02-16' : '2026-01-12',
    kind: 'Writ',
    summary_en: 'A writ was served.',
    summary_fr: 'Une assignation a été signifiée.',
    quotes: [placement ? "Copie de l'assignation remise au greffe le 16 février 2026" : "L'an deux mille vingt-six et le douze janvier"],
    served_at: role === 'writ' ? '2026-01-12' : '',
    hearing_date: role === 'writ' ? '2026-02-20' : '',
    placed_at: role === 'writ_placement' ? '2026-02-16' : '',
    writ_fact_id: '',
    amount_eur: 0,
    ...values,
  };
}

function fakeClient(script: (call: (name: string, args: unknown) => Promise<unknown>) => Promise<void>): LlmClient {
  const client = {
    provider: 'openai' as const,
    async runTools({ handlers, onStep }: {
      handlers: Record<string, (args: any) => Promise<unknown>>;
      onStep?: (call: { name: string; args: any; result: unknown }) => void;
    }) {
      let steps = 0;
      await script(async (name, args) => {
        const result = await handlers[name](args);
        onStep?.({ name, args, result });
        steps++;
        return result;
      });
      return { steps, usage: {} };
    },
    async json() { throw new Error('unused'); },
    async embed() { return []; },
  };
  return client as unknown as LlmClient;
}

function extract(client: LlmClient) {
  return extractCase(docs, { chunks: [], vectors: [] }, {
    client,
    model: 'test',
    asOf: '2026-10-04',
    emit: () => undefined,
  });
}

describe('extraction tool validation', () => {
  it('rejects an unanchored fact once, then records it unverified after the second attempt', async () => {
    const attempts: unknown[] = [];
    const client = fakeClient(async (call) => {
      await call('set_case_profile', profileArgs);
      const args = factArgs('other', {
        quotes: ['This exact quote does not occur anywhere in the source.'],
      });
      attempts.push(await call('record_fact', args));
      attempts.push(await call('record_fact', args));
      await call('finish', { notes: '' });
    });

    const result = await extract(client);
    expect(attempts[0]).toMatchObject({ error: expect.stringContaining('None of the quotes'), attempt: 1 });
    expect(attempts[1]).toEqual({ id: 'f1', verified: false });
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({ verified: false, anchors: [] });
  });

  it('requires writ_fact_id to reference an already recorded writ', async () => {
    const attempts: unknown[] = [];
    const client = fakeClient(async (call) => {
      await call('set_case_profile', profileArgs);
      attempts.push(await call('record_fact', factArgs('writ_placement', { writ_fact_id: 'f1' })));
      await call('record_fact', factArgs('writ'));
      attempts.push(await call('record_fact', factArgs('writ_placement', { writ_fact_id: 'f1' })));
      await call('finish', { notes: '' });
    });

    const result = await extract(client);
    expect(attempts[0]).toEqual({ error: 'writ_fact_id f1 must refer to a recorded writ fact' });
    expect(attempts[1]).toMatchObject({ id: 'f2', verified: true });
    expect(result.facts.find((fact) => fact.role === 'writ_placement')?.attrs.writFactId).toBe('f1');
  });

  it('rejects finish without a profile, then accepts it after profile and facts exist', async () => {
    let finishWithoutProfile: unknown;
    const client = fakeClient(async (call) => {
      finishWithoutProfile = await call('finish', { notes: '' });
      await call('set_case_profile', profileArgs);
      await call('record_fact', factArgs('writ'));
      await call('finish', { notes: '' });
    });

    await expect(extract(client)).resolves.toMatchObject({ profile: { side: 'Defendant (Bâtiself SARL)' } });
    expect(finishWithoutProfile).toEqual({ error: 'Set the case profile before finishing extraction' });
  });

  it('normalizes a represented party name into the role-aware profile side', async () => {
    const client = fakeClient(async (call) => {
      await call('set_case_profile', { ...profileArgs, side: 'BÂTISELF SARL' });
      await call('record_fact', factArgs('writ'));
      await call('finish', { notes: '' });
    });

    await expect(extract(client)).resolves.toMatchObject({
      profile: { side: 'Defendant (Bâtiself SARL)' },
    });
  });
});
