import { describe, expect, it } from 'vitest';
import type { Fact, QualKind } from '../../src/data/bundle';
import type { Doc } from '../../src/data/documents';
import type { LlmClient } from '../providers';
import { qualifyFacts, questionsFor } from './qualify';

const quote = 'The source records this procedural event with exact words.';
const caseDoc: Doc = {
  id: 'case-doc',
  group: 'case',
  title: 'Case source',
  short: 'Source',
  provenance: 'uploaded',
  format: 'text',
  text: quote,
};

function fact(id: string, role: Fact['role'], date = '2026-01-12'): Fact {
  return {
    id,
    date,
    doc: caseDoc.id,
    kind: role,
    summary: { en: 'A procedural fact.', fr: 'Un fait de procédure.' },
    anchors: [{ doc: caseDoc.id, quote, verified: true }],
    role,
    attrs: {},
    verified: true,
  };
}

function fakeClient(confidenceFor?: Partial<Record<QualKind, 'high' | 'medium' | 'low'>>): LlmClient {
  const client = {
    provider: 'openai' as const,
    async runTools(options: {
      model: string;
      tools: { name: string; parameters: { properties: Record<string, unknown> } }[];
      handlers: Record<string, (args: any) => Promise<unknown>>;
      onStep?: (call: { name: string; args: any; result: unknown }) => void;
    }) {
      const answerTool = options.tools.find((tool) => tool.name === 'answer')!;
      const decision = Object.keys(answerTool.parameters.properties)
        .find((key) => !['confidence', 'reasoning_en', 'reasoning_fr', 'rule', 'evidence'].includes(key))!;
      const kindByDecision: Record<string, QualKind> = {
        is_mandatory_precondition: 'conciliation_clause',
        is_unequivocal_acknowledgment: 'acknowledgment',
        interrupts_limitation: 'formal_notice',
        outcome: 'writ_outcome',
        attempt_found: 'conciliation_attempted',
      };
      const kind = kindByDecision[decision];
      const values: Record<string, unknown> = {
        is_mandatory_precondition: true,
        is_unequivocal_acknowledgment: false,
        interrupts_limitation: false,
        outcome: 'caducite',
        attempt_found: false,
      };
      const args = {
        [decision]: values[decision],
        confidence: confidenceFor?.[kind] ?? 'high',
        reasoning_en: 'The text supports the answer. The opposite is possible.',
        reasoning_fr: 'Le texte étaye la réponse. L’inverse reste possible.',
        rule: 'Agent rule',
        evidence: [{ doc_id: caseDoc.id, quote }],
      };
      const result = await options.handlers.answer(args);
      options.onStep?.({ name: 'answer', args, result });
      return { steps: 1, usage: { [options.model]: { input: 5, output: 4, reasoning: 0 } } };
    },
    async json() { throw new Error('unused'); },
    async embed() { return []; },
  };
  return client as unknown as LlmClient;
}

const profile = {
  title: { en: 'Case', fr: 'Dossier' },
  court: 'Tribunal',
  side: { en: 'Defendant (Company)', fr: 'Défendeur (Société)' },
  relationship: 'commercial',
};

const emptyIndex = { chunks: [], vectors: [] };
const emit = () => undefined;

describe('qualification question generation and mapping', () => {
  it('does not ask about attempted conciliation when no clause exists', () => {
    const facts = [fact('f1', 'debtor_communication'), fact('f2', 'writ')];
    expect(questionsFor(facts).map((item) => item.kind)).toEqual(['acknowledgment']);
  });

  it('maps every answer, links facts, and anchors evidence', async () => {
    const facts = [
      fact('f1', 'conciliation_clause'),
      fact('f2', 'debtor_communication', '2022-06-02'),
      fact('f3', 'formal_notice', '2023-02-10'),
      fact('f4', 'writ_sanction', '2026-02-20'),
      fact('f5', 'exhibits_list', '2026-04-08'),
      fact('f6', 'writ', '2026-04-08'),
    ];
    const result = await qualifyFacts(facts, [caseDoc], [], emptyIndex, {
      client: fakeClient(),
      model: 'test-model',
      provider: 'openai',
      profile,
      emit,
    });
    const byKind = Object.fromEntries(result.qualifications.map((item) => [item.kind, item]));

    expect(Object.keys(byKind)).toHaveLength(5);
    expect(byKind.conciliation_clause).toMatchObject({ proposed: true, source: 'ai_inferred', rule: 'Cass. ch. mixte, 14 Feb 2003' });
    expect(byKind.acknowledgment).toMatchObject({ proposed: false, source: 'ai_inferred', rule: 'art. 2240 C. civ.' });
    expect(byKind.formal_notice).toMatchObject({ proposed: false, source: 'rule', rule: 'arts. 2240–2244 C. civ. (exhaustive list)' });
    expect(byKind.writ_outcome).toMatchObject({ proposed: true, source: 'rule', rule: 'Agent rule' });
    expect(byKind.conciliation_attempted).toMatchObject({ proposed: true, source: 'rule', rule: 'Required document not found', factId: 'f5' });
    expect(byKind.conciliation_attempted.anchors?.[0].quote).toBe(quote);
    expect(result.qualifications.every((item) => facts.find((entry) => entry.id === item.factId)?.qualification === item.id)).toBe(true);
  });

  it('uses ai_inferred for a low-confidence rule qualification', async () => {
    const facts = [fact('f1', 'formal_notice')];
    const result = await qualifyFacts(facts, [caseDoc], [], emptyIndex, {
      client: fakeClient({ formal_notice: 'low' }),
      model: 'test-model',
      provider: 'openai',
      profile,
      emit,
    });
    expect(result.qualifications[0]).toMatchObject({ kind: 'formal_notice', source: 'ai_inferred', confidence: 'low' });
  });
});
