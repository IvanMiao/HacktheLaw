import type { Doc } from './documents.js';

let libraryDocs: Doc[] = [];

export function registerLibrary(docs: Doc[]) {
  libraryDocs = docs;
}

export type Text = string | { en: string; fr: string };
export type Anchor = { doc: string; quote: string; verified?: boolean };

export type FactRole =
  | 'conciliation_clause' | 'limitation_start' | 'debtor_communication' | 'formal_notice'
  | 'writ' | 'writ_placement' | 'writ_sanction' | 'exhibits_list' | 'other';

export type Fact = {
  id: string; date: string; doc: string; kind: string; summary: Text; anchors: Anchor[];
  role: FactRole;
  attrs: { servedAt?: string; hearingDate?: string; placedAt?: string; writFactId?: string; amountEur?: number };
  qualification?: string;
  verified: boolean;
};

export type QualKind = 'conciliation_clause' | 'acknowledgment' | 'formal_notice' | 'writ_outcome' | 'conciliation_attempted';

export type Qualification = {
  id: string; kind: QualKind; factId: string;
  question: Text; proposed: boolean; yes: Text; no: Text;
  source: 'rule' | 'ai_inferred'; confidence: 'high' | 'medium' | 'low';
  rule: string; reasoning: Text; whatIfLabel: Text;
  anchors?: Anchor[];
  model?: string;
};

export type CaseProfile = {
  title: Text; court: string; courtType: 'tribunal_commerce' | 'tribunal_judiciaire' | 'other';
  side: Text; claimant: string; defendant: string; amount?: string;
  relationship: 'commercial' | 'civil' | 'consumer';
  asOf: string; nextHearing?: string; summary?: Text;
};

export type AgentEvent = { at: number; stage: 'ingest' | 'extract' | 'qualify' | 'engine' | 'memo'; kind: 'tool' | 'note' | 'warn' | 'error'; text: string };

export type CaseBundle = {
  id: string; origin: 'cached' | 'ai';
  provider?: string; models?: Record<string, string>; generatedAt?: string;
  usage?: Record<string, { input: number; output: number; reasoning: number }>;
  steps?: number;
  profile: CaseProfile; docs: Doc[];
  facts: Fact[]; qualifications: Qualification[];
  trace?: AgentEvent[];
};

export function allDocs(bundle: CaseBundle): Doc[] {
  return [...bundle.docs, ...libraryDocs];
}

export function docOf(bundle: CaseBundle, id: string): Doc {
  const doc = allDocs(bundle).find((item) => item.id === id);
  if (!doc) throw new Error(`Unknown document ${id}`);
  return doc;
}

export function factOf(bundle: CaseBundle, id: string): Fact {
  const fact = bundle.facts.find((item) => item.id === id);
  if (!fact) throw new Error(`Unknown fact ${id}`);
  return fact;
}

export function qualOf(bundle: CaseBundle, id: string): Qualification {
  const qualification = bundle.qualifications.find((item) => item.id === id);
  if (!qualification) throw new Error(`Unknown qualification ${id}`);
  return qualification;
}
