import type { AgentEvent, Anchor, CaseProfile, Fact, FactRole } from '../../src/data/bundle.js';
import { locate } from '../anchor.js';
import type { IngestedDoc } from '../ingest.js';
import type { LlmClient, ToolDef, Usage } from '../providers.js';
import { search, type RetrievalIndex } from '../retrieval.js';
import { EXTRACT_SYSTEM, EXTRACT_USER } from './prompts.js';

type Emit = (event: AgentEvent) => void;
type FactArgs = {
  doc_id: string; role: FactRole; date: string; kind: string; summary_en: string; summary_fr: string;
  quotes: string[]; served_at: string; hearing_date: string; placed_at: string; writ_fact_id: string; amount_eur: number;
};

const roles: FactRole[] = ['conciliation_clause', 'limitation_start', 'debtor_communication', 'formal_notice', 'writ', 'writ_placement', 'writ_sanction', 'exhibits_list', 'other'];
const schema = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const dateSchema = { type: 'string', pattern: '^(|\\d{4}-\\d{2}-\\d{2})$' };
const factProperties = {
  doc_id: { type: 'string' },
  role: { type: 'string', enum: roles },
  date: dateSchema,
  kind: { type: 'string' },
  summary_en: { type: 'string' },
  summary_fr: { type: 'string' },
  quotes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
  served_at: dateSchema,
  hearing_date: dateSchema,
  placed_at: dateSchema,
  writ_fact_id: { type: 'string' },
  amount_eur: { type: 'number', minimum: 0 },
};

const tools: ToolDef[] = [
  {
    name: 'read_document',
    description: 'Read a document window. Continue at next_offset until it is -1.',
    parameters: schema({ doc_id: { type: 'string' }, offset: { type: 'integer', minimum: 0 } }),
  },
  {
    name: 'search_documents',
    description: 'Search the case documents.',
    parameters: schema({ query: { type: 'string' } }),
  },
  {
    name: 'record_fact',
    description: 'Record a procedural fact with exact source quotes.',
    parameters: schema(factProperties),
  },
  {
    name: 'update_fact',
    description: 'Replace a previously recorded fact with corrected information.',
    parameters: schema({ id: { type: 'string' }, ...factProperties }),
  },
  {
    name: 'set_case_profile',
    description: 'Record the parties, court, relationship and represented side.',
    parameters: schema({
      title: { type: 'string' },
      court: { type: 'string' },
      court_type: { type: 'string', enum: ['tribunal_commerce', 'tribunal_judiciaire', 'other'] },
      claimant: { type: 'string' },
      defendant: { type: 'string' },
      side: { type: 'string' },
      amount: { type: 'string' },
      relationship: { type: 'string', enum: ['commercial', 'civil', 'consumer'] },
      summary_en: { type: 'string' },
      summary_fr: { type: 'string' },
    }),
  },
  {
    name: 'finish',
    description: 'Finish extraction after the profile and relevant facts are recorded.',
    parameters: schema({ notes: { type: 'string' } }),
  },
];

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function profileSide(side: string, claimant: string, defendant: string) {
  const party = side.trim();
  if (/^defendant(?:\s|$)/iu.test(party) && !/\(.+\)/u.test(party)) return `Defendant (${defendant})`;
  if (/^claimant(?:\s|$)/iu.test(party) && !/\(.+\)/u.test(party)) return `Claimant (${claimant})`;
  const normalized = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (normalized(party) === normalized(defendant)) return `Defendant (${defendant})`;
  if (normalized(party) === normalized(claimant)) return `Claimant (${claimant})`;
  return party;
}

function event(emit: Emit, text: string) {
  emit({ at: Date.now(), stage: 'extract', kind: 'tool', text });
}

export async function extractCase(docs: IngestedDoc[], index: RetrievalIndex, options: {
  client: LlmClient;
  model: string;
  asOf: string;
  emit: Emit;
  sideHint?: string;
  effort?: string;
  signal?: AbortSignal;
}): Promise<{ profile: CaseProfile; facts: Fact[]; usage: Usage; steps: number }> {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const facts: Fact[] = [];
  const failedAnchors = new Map<string, number>();
  let profile: CaseProfile | undefined;
  let finished = false;

  const saveFact = (args: FactArgs, id?: string) => {
    const doc = byId.get(args.doc_id);
    if (!doc) return { error: `Unknown case document ${args.doc_id}` };
    const date = args.date || doc.date || options.asOf;
    if (!validDate(date)) return { error: `Invalid date ${date}` };
    for (const value of [args.served_at, args.hearing_date, args.placed_at]) {
      if (value && !validDate(value)) return { error: `Invalid date ${value}` };
    }
    if (args.amount_eur < 0 || !Number.isFinite(args.amount_eur)) return { error: 'Invalid amount_eur' };
    if (args.writ_fact_id && !facts.some((fact) => fact.id === args.writ_fact_id && fact.role === 'writ')) {
      return { error: `writ_fact_id ${args.writ_fact_id} must refer to a recorded writ fact` };
    }
    const anchors: Anchor[] = args.quotes.flatMap((quote) => {
      const location = locate(doc.text, quote);
      if (location) return [{ doc: doc.id, quote: doc.text.slice(location.start, location.end), verified: true }];
      return [];
    });
    const key = `${args.doc_id}\u0000${args.role}\u0000${date}`;
    if (!anchors.length) {
      const attempt = (failedAnchors.get(key) ?? 0) + 1;
      failedAnchors.set(key, attempt);
      if (attempt < 2) return {
        error: `None of the quotes were found verbatim in ${doc.id}. Copy the exact words (they may be short) and call record_fact again.`,
        attempt,
      };
      const fact = makeFact(args, date, id ?? `f${facts.length + 1}`, doc.id, [], false);
      if (id) facts[facts.findIndex((item) => item.id === id)] = fact;
      else facts.push(fact);
      return { id: fact.id, verified: false };
    }
    const fact = makeFact(args, date, id ?? `f${facts.length + 1}`, doc.id, anchors, true);
    if (id) facts[facts.findIndex((item) => item.id === id)] = fact;
    else facts.push(fact);
    return { id: fact.id, verified: true, anchored: anchors.length };
  };

  const makeFact = (args: FactArgs, date: string, id: string, doc: string, anchors: Anchor[], verified: boolean): Fact => ({
    id,
    date,
    doc,
    kind: args.kind,
    summary: { en: args.summary_en, fr: args.summary_fr },
    anchors,
    role: args.role,
    attrs: {
      ...(args.served_at ? { servedAt: args.served_at } : {}),
      ...(args.hearing_date ? { hearingDate: args.hearing_date } : {}),
      ...(args.placed_at ? { placedAt: args.placed_at } : {}),
      ...(args.writ_fact_id ? { writFactId: args.writ_fact_id } : {}),
      ...(args.amount_eur ? { amountEur: args.amount_eur } : {}),
    },
    verified,
  });

  const handlers: Record<string, (args: any) => Promise<unknown>> = {
    read_document: async ({ doc_id, offset }) => {
      const doc = byId.get(doc_id);
      if (!doc) return { error: `Unknown case document ${doc_id}` };
      const start = Math.max(0, Math.min(doc.text.length, Number(offset) || 0));
      const end = Math.min(start + 6000, doc.text.length);
      return { doc_id, offset: start, next_offset: end < doc.text.length ? end : -1, text: doc.text.slice(start, end) };
    },
    search_documents: async ({ query }) => (await search(index, String(query), options.client, { limit: 6, group: 'case', signal: options.signal }))
      .map(({ doc_id, excerpt, score }) => ({ doc_id, excerpt, score })),
    record_fact: async (args: FactArgs) => saveFact(args),
    update_fact: async ({ id, ...args }: FactArgs & { id: string }) => {
      if (!facts.some((fact) => fact.id === id)) return { error: `Unknown fact ${id}` };
      return saveFact(args, id);
    },
    set_case_profile: async (args) => {
      if (profile) return { error: 'Case profile already set' };
      profile = {
        title: args.title,
        court: args.court,
        courtType: args.court_type,
        claimant: args.claimant,
        defendant: args.defendant,
        side: profileSide(args.side, args.claimant, args.defendant),
        ...(args.amount ? { amount: args.amount } : {}),
        relationship: args.relationship,
        asOf: options.asOf,
        summary: { en: args.summary_en, fr: args.summary_fr },
      };
      return { saved: true };
    },
    finish: async () => {
      if (!profile) return { error: 'Set the case profile before finishing extraction' };
      if (!facts.length) return { error: 'Record at least one fact before finishing extraction' };
      finished = true;
      return { done: true };
    },
  };

  const docList = docs.map((doc) => `- ${doc.id} · ${doc.title} · ${doc.date || 'undated'} · ${doc.docType} · ${doc.text.length} chars`).join('\n');
  const user = EXTRACT_USER
    .replace('{n}', String(docs.length))
    .replace('{asOf}', options.asOf)
    .replace('{side_hint}', options.sideHint ? `We act for: ${options.sideHint}.` : '')
    .replace('{doc_list}', docList);
  const result = await options.client.runTools({
    model: options.model,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: user }],
    tools,
    handlers,
    maxSteps: 40,
    effort: options.effort,
    signal: options.signal,
    onStep: ({ name, args, result: output }) => {
      const failed = !!(output as { error?: string } | null)?.error;
      let text = name;
      if (name === 'read_document') text = `read_document ${args.doc_id}`;
      else if (name === 'search_documents') text = `search "${String(args.query).slice(0, 80)}"`;
      else if (name === 'record_fact' || name === 'update_fact') {
        const status = (output as { verified?: boolean } | null)?.verified;
        const quoteMiss = String((output as { error?: string } | null)?.error ?? '').startsWith('None of the quotes');
        text = `${name} ${args.role} ${args.date || ''} ${status === false || quoteMiss ? '✗ quote not found' : failed ? '✗' : '✓'}`.trim();
      } else if (name === 'set_case_profile') text = 'set_case_profile ✓';
      else if (name === 'finish') text = failed ? 'finish ✗' : 'finish ✓';
      event(options.emit, text);
    },
  });

  if (!finished || !profile) throw new Error('Extraction agent did not finish with a case profile');
  facts.sort((a, b) => a.date.localeCompare(b.date));
  profile.nextHearing = facts
    .filter((fact) => fact.verified && fact.role === 'writ' && fact.attrs.hearingDate && fact.attrs.hearingDate >= options.asOf)
    .map((fact) => fact.attrs.hearingDate!)
    .sort()[0];
  if (typeof profile.summary === 'object' && !profile.summary.en && !profile.summary.fr) delete profile.summary;
  return { profile, facts, usage: result.usage, steps: result.steps };
}
