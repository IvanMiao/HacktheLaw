import type { AgentEvent, Anchor, Fact, QualKind, Qualification, Text } from '../../src/data/bundle.js';
import type { Doc } from '../../src/data/documents.js';
import { english } from '../../src/i18n/translate.js';
import { fr } from '../../src/engine/dates.js';
import { locate } from '../anchor.js';
import { search, type RetrievalIndex } from '../retrieval.js';
import type { LlmClient, ToolDef, Usage } from '../providers.js';
import { QUALIFY_SYSTEM, QUALIFY_USER } from './prompts.js';
import { questionFor, TEMPLATES } from './templates.js';

type Emit = (event: AgentEvent) => void;
type Candidate = { kind: QualKind; fact: Fact };
type Answer = {
  confidence: 'high' | 'medium' | 'low';
  reasoning_en: string;
  reasoning_fr: string;
  rule: string;
  evidence: { doc_id: string; quote: string }[];
  [key: string]: unknown;
};

const schema = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});

export function questionsFor(facts: Fact[]): Candidate[] {
  const verified = facts.filter((fact) => fact.verified);
  const candidates: Candidate[] = [];
  for (const fact of verified) {
    if (fact.role === 'conciliation_clause') candidates.push({ kind: 'conciliation_clause', fact });
    else if (fact.role === 'debtor_communication') candidates.push({ kind: 'acknowledgment', fact });
    else if (fact.role === 'formal_notice') candidates.push({ kind: 'formal_notice', fact });
    else if (fact.role === 'writ_sanction') candidates.push({ kind: 'writ_outcome', fact });
  }
  if (verified.some((fact) => fact.role === 'conciliation_clause')) {
    const fact = verified.find((item) => item.role === 'exhibits_list')
      ?? verified.filter((item) => item.role === 'writ')
        .sort((a, b) => (a.attrs.servedAt ?? a.date).localeCompare(b.attrs.servedAt ?? b.date)).at(-1);
    if (fact) candidates.push({ kind: 'conciliation_attempted', fact });
  }
  return candidates;
}

function event(emit: Emit, stage: 'qualify', kind: AgentEvent['kind'], text: string) {
  emit({ at: Date.now(), stage, kind, text });
}

function answerTool(kind: QualKind): ToolDef {
  const template = TEMPLATES[kind];
  const decision = kind === 'writ_outcome'
    ? { type: 'string', enum: ['caducite', 'nullite', 'other'] }
    : { type: 'boolean' };
  return {
    name: 'answer',
    description: 'Return the proposed legal qualification with bilingual reasoning and anchored evidence.',
    parameters: schema({
      [template.field]: decision,
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      reasoning_en: { type: 'string' },
      reasoning_fr: { type: 'string' },
      rule: { type: 'string' },
      evidence: {
        type: 'array',
        items: schema({ doc_id: { type: 'string' }, quote: { type: 'string' } }),
        minItems: 1,
        maxItems: 3,
      },
    }),
  };
}

function candidateTools(kind: QualKind): ToolDef[] {
  return [
    { name: 'read_document', description: 'Read a document window. Continue at next_offset until it is -1.', parameters: schema({ doc_id: { type: 'string' }, offset: { type: 'integer', minimum: 0 } }) },
    { name: 'search_documents', description: 'Search the case documents.', parameters: schema({ query: { type: 'string' } }) },
    { name: 'search_library', description: 'Search the reference library only.', parameters: schema({ query: { type: 'string' } }) },
    answerTool(kind),
  ];
}

function decisionValue(kind: QualKind, answer: Answer) {
  switch (kind) {
    case 'conciliation_clause': return answer.is_mandatory_precondition === true;
    case 'acknowledgment': return answer.is_unequivocal_acknowledgment === true;
    case 'formal_notice': return answer.interrupts_limitation === true;
    case 'writ_outcome': return answer.outcome === 'caducite';
    case 'conciliation_attempted': return answer.attempt_found !== true;
  }
}

function fallbackAnswer(kind: QualKind): Answer {
  const template = TEMPLATES[kind];
  return {
    ...template.fallback,
    confidence: 'low',
    reasoning_en: 'The agent did not return a qualification answer.',
    reasoning_fr: 'L’agent n’a pas fourni de réponse de qualification.',
    rule: template.rule,
    evidence: [],
  };
}

function dateForWrit(fact: Fact, facts: Fact[]) {
  if (!fact.attrs.writFactId) return fact.date;
  const writ = facts.find((item) => item.id === fact.attrs.writFactId && item.role === 'writ');
  return writ?.attrs.servedAt ?? writ?.date ?? fact.date;
}

function qualifyOne(candidate: Candidate, facts: Fact[], allDocs: Doc[], index: RetrievalIndex, options: {
  client: LlmClient;
  model: string;
  provider: 'openai' | 'mistral';
  effort?: string;
  signal?: AbortSignal;
  profile: { title: Text; court: string; side: Text; relationship: string };
  emit: Emit;
}) {
  return async (): Promise<{ qualification: Qualification; usage: Usage; steps: number }> => {
    const { kind, fact } = candidate;
    const template = TEMPLATES[kind];
    let answer: Answer | undefined;
    const docsById = new Map(allDocs.map((doc) => [doc.id, doc]));
    const handlers: Record<string, (args: any) => Promise<unknown>> = {
      read_document: async ({ doc_id, offset }) => {
        const doc = docsById.get(doc_id);
        if (!doc) return { error: `Unknown document ${doc_id}` };
        const start = Math.max(0, Math.min(doc.text.length, Number(offset) || 0));
        const end = Math.min(start + 6000, doc.text.length);
        return { doc_id, offset: start, next_offset: end < doc.text.length ? end : -1, text: doc.text.slice(start, end) };
      },
      search_documents: async ({ query }) => (await search(index, String(query), options.client, { limit: 6, group: 'case', signal: options.signal }))
        .map(({ doc_id, excerpt, score }) => ({ doc_id, excerpt, score })),
      search_library: async ({ query }) => (await search(index, String(query), options.client, { limit: 6, libraryOnly: true, signal: options.signal }))
        .map(({ doc_id, excerpt, score }) => ({ doc_id, excerpt, score })),
      answer: async (value: Answer) => {
        if (answer) return { error: 'answer may only be called once' };
        answer = value;
        return { done: true };
      },
    };
    const writDate = dateForWrit(fact, facts);
    const question = questionFor(kind, fact.date, writDate);
    const user = QUALIFY_USER
      .replace('{task}', template.task)
      .replace('{fact_id}', fact.id)
      .replace('{date}', fr(fact.date))
      .replace('{doc}', fact.doc)
      .replace('{summary}', english(fact.summary))
      .replace('{quotes}', fact.anchors.map((anchor) => anchor.quote).join('\n'))
      .replace('{title}', english(options.profile.title))
      .replace('{court}', options.profile.court)
      .replace('{side}', english(options.profile.side))
      .replace('{relationship}', options.profile.relationship);

    const tools = candidateTools(kind);
    const result = await options.client.runTools({
      model: options.model,
      system: QUALIFY_SYSTEM,
      messages: [{ role: 'user', content: user }],
      tools,
      handlers,
      maxSteps: 12,
      effort: options.effort,
      signal: options.signal,
      onStep: ({ name, args }) => {
        const query = name === 'search_documents' || name === 'search_library' ? ` "${String(args.query).slice(0, 80)}"` : '';
        event(options.emit, 'qualify', 'tool', `${kind}: ${name}${query}`);
      },
    });
    if (!answer) {
      answer = fallbackAnswer(kind);
      event(options.emit, 'qualify', 'warn', `${kind} ${fact.id}: agent did not call answer; using fallback`);
    }
    const anchors: Anchor[] = [];
    for (const item of answer.evidence ?? []) {
      const doc = docsById.get(item.doc_id);
      const location = doc && locate(doc.text, item.quote);
      if (!doc || !location) {
        event(options.emit, 'qualify', 'warn', `${kind} ${fact.id}: unanchored evidence dropped (${item.doc_id})`);
        continue;
      }
      anchors.push({ doc: doc.id, quote: doc.text.slice(location.start, location.end), verified: true });
    }
    const lowConfidence = answer.confidence === 'low';
    const source = kind === 'conciliation_clause' || kind === 'acknowledgment' || lowConfidence ? 'ai_inferred' : 'rule';
    const id = `q-${kind}-${fact.id}`;
    const qualification: Qualification = {
      id,
      kind,
      factId: fact.id,
      question,
      proposed: decisionValue(kind, answer),
      yes: template.yes,
      no: template.no,
      source,
      confidence: answer.confidence,
      rule: kind === 'writ_outcome' ? answer.rule || 'art. 857 CPC' : template.rule,
      reasoning: { en: answer.reasoning_en, fr: answer.reasoning_fr },
      whatIfLabel: template.whatIf,
      ...(anchors.length ? { anchors } : {}),
      model: options.model,
    };
    fact.qualification = id;
    return { qualification, usage: result.usage, steps: result.steps };
  };
}

export async function qualifyFacts(facts: Fact[], caseDocs: Doc[], libraryDocs: Doc[], index: RetrievalIndex, options: {
  client: LlmClient;
  model: string;
  provider: 'openai' | 'mistral';
  profile: { title: Text; court: string; side: Text; relationship: string };
  emit: Emit;
  effort?: string;
  signal?: AbortSignal;
}): Promise<{ qualifications: Qualification[]; usage: Usage; steps: number }> {
  const candidates = questionsFor(facts);
  const allDocs = [...caseDocs, ...libraryDocs];
  const workers = options.provider === 'openai' ? 3 : 2;
  const results: { qualification: Qualification; usage: Usage; steps: number }[] = new Array(candidates.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, candidates.length) }, async () => {
    while (next < candidates.length) {
      const indexInList = next++;
      results[indexInList] = await qualifyOne(candidates[indexInList], facts, allDocs, index, options)();
    }
  }));
  const usage: Usage = {};
  let steps = 0;
  for (const item of results) {
    steps += item.steps;
    for (const [model, count] of Object.entries(item.usage)) {
      const current = usage[model] ??= { input: 0, output: 0, reasoning: 0 };
      current.input += count.input;
      current.output += count.output;
      current.reasoning += count.reasoning;
    }
  }
  return { qualifications: results.map((item) => item.qualification), usage, steps };
}
