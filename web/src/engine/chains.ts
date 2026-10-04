import { CASE, QUALIFICATIONS, type Anchor } from '../data/case';
import { addDays, daysBetween, fr } from './dates';
import { computeLimitation, type LimitationResult } from './limitation';
import type { RegimeKey } from './regimes';

export type Decision = 'proposed' | 'confirmed' | 'rejected';

export type AnalysisState = {
  decisions: Record<string, Decision>;
  /** Counterfactual overrides — never persisted as lawyer decisions. */
  whatIf: Record<string, boolean>;
  art642: boolean;
};

export const initialState = (): AnalysisState => ({
  decisions: Object.fromEntries(QUALIFICATIONS.map((q) => [q.id, 'proposed' as Decision])),
  whatIf: {},
  art642: true,
});

export type NodeKind = 'fact' | 'requirement' | 'breach' | 'sanction' | 'lost_effect' | 'consequence' | 'outcome';
export type LinkStatus = 'established' | 'contested' | 'broken' | 'not_reached';
export type ChainStatus = 'holds' | 'contested' | 'fails';

export type Link = {
  id: string;
  kind: NodeKind;
  title: string;
  statement: string;
  rule?: string;
  anchors: Anchor[];
  deps: string[];
  computed?: [string, string][];
  regime?: RegimeKey;
  contrast?: string;
  status: LinkStatus;
  brokenReason?: string;
};

export type ChainResult = { id: 'C1' | 'C2'; title: string; subtitle: string; links: Link[]; status: ChainStatus; outcome: string; hingesOn: string[] };

export type Analysis = { chains: ChainResult[]; limitation: LimitationResult; contestedQuals: string[] };

type Ctx = { v: (q: string) => boolean; isContested: (q: string) => boolean; lim: LimitationResult };

type LinkDef = Omit<Link, 'status' | 'brokenReason'> & { holds: boolean; brokenReason?: string };

export function value(state: AnalysisState, qid: string): boolean {
  if (qid in state.whatIf) return state.whatIf[qid];
  const q = QUALIFICATIONS.find((x) => x.id === qid)!;
  return state.decisions[qid] === 'rejected' ? !q.proposed : q.proposed;
}

export function isContested(state: AnalysisState, qid: string): boolean {
  const q = QUALIFICATIONS.find((x) => x.id === qid)!;
  return q.source === 'ai_inferred' && state.decisions[qid] === 'proposed' && !(qid in state.whatIf);
}

export function limitationFor(state: AnalysisState): LimitationResult {
  const v = (q: string) => value(state, q);
  const lapsed = v('q-writ1');
  return computeLimitation({
    start: CASE.invoiceDue, years: 5, regimeRule: 'art. L110-4 C. com.', art642: state.art642,
    events: [
      { factId: 'f3', date: '2022-06-02', kind: 'acknowledgment', label: 'Email 02/06/2022', interrupts: v('q-email'),
        noEffectReason: 'not an acknowledgment of debt', rule: 'art. 2240 C. civ.' },
      { factId: 'f4', date: '2023-02-10', kind: 'formal_notice', label: 'Mise en demeure 10/02/2023', interrupts: v('q-notice'),
        noEffectReason: 'an ordinary formal notice does not interrupt', rule: 'arts. 2240–2244 C. civ.' },
      { factId: 'f5', date: CASE.writ1.served, kind: 'writ', label: 'Writ #1 12/01/2026', interrupts: !lapsed, endDate: CASE.writ1.orderDate,
        noEffectReason: 'interruption void — writ lapsed (caducité)',
        rule: lapsed ? 'art. 2243 C. civ. + case law' : 'arts. 2241 al. 2, 2242 C. civ.' },
    ],
  });
}

function settle(defs: LinkDef[], ctx: Ctx): Link[] {
  let broken = false;
  return defs.map(({ holds, brokenReason, ...l }) => {
    if (broken) return { ...l, status: 'not_reached' };
    if (!holds) { broken = true; return { ...l, status: 'broken', brokenReason }; }
    return { ...l, status: l.deps.some(ctx.isContested) ? 'contested' : 'established' };
  });
}

function c1(ctx: Ctx): LinkDef[] {
  const { served, hearing, placed, orderDate } = CASE.writ1;
  const deadline = addDays(hearing, -8);
  const late = daysBetween(deadline, placed);
  const lapsed = ctx.v('q-writ1');
  const timeBarred = ctx.lim.expiry < CASE.writ2.served;
  return [
    { id: 'c1-fact', kind: 'fact', title: 'Writ served', statement: `Writ #1 served ${fr(served)}, hearing ${fr(hearing)}`,
      anchors: [{ doc: 'writ1', quote: "L'an deux mille vingt-six et le douze janvier" }, { doc: 'writ1', quote: "l'audience du vendredi 20 février 2026" }],
      deps: [], holds: true },
    { id: 'c1-req', kind: 'requirement', title: 'Placement deadline', statement: `Copy to be placed with the registry by ${fr(deadline)}`,
      rule: 'art. 857 CPC', anchors: [{ doc: 'cpc', quote: 'Cette remise doit avoir lieu au plus tard huit jours avant la date de l\'audience' }],
      computed: [['Hearing', fr(hearing)], ['− 8 days', fr(deadline)]], deps: [], holds: true },
    { id: 'c1-breach', kind: 'breach', title: 'Late placement', statement: `Placed ${fr(placed)} — ${late} days late`,
      anchors: [{ doc: 'registry', quote: "Copie de l'assignation remise au greffe le 16 février 2026" }],
      computed: [['Deadline', fr(deadline)], ['Placed', fr(placed)], ['Delay', `${late} days`]], deps: [], holds: placed > deadline,
      brokenReason: 'Writ placed in time' },
    { id: 'c1-sanction', kind: 'sanction', title: lapsed ? 'Caducité' : 'Nullité', statement: lapsed ? `Lapse recorded by order of ${fr(orderDate)}` : 'Writ annulled for a procedural defect',
      rule: 'art. 857 CPC', regime: 'caducite', anchors: [{ doc: 'order', quote: "Constatons la caducité de l'assignation." }],
      deps: ['q-writ1'], holds: lapsed,
      contrast: 'Annulled ≠ lapsed: a writ annulled for a procedural defect keeps its interruptive effect (art. 2241 al. 2 C. civ.).',
      brokenReason: 'Writ annulled, not lapsed — interruption kept (art. 2241 al. 2)' },
    { id: 'c1-lost', kind: 'lost_effect', title: 'Interruption void', statement: 'Writ #1 no longer interrupts the limitation period',
      rule: 'art. 2243 C. civ. + case law', anchors: [{ doc: 'civ', quote: "L'interruption est non avenue" }, { doc: 'cassC1', quote: "elle prive l'assignation de tout effet interruptif de prescription" }],
      deps: ['q-writ1'], holds: lapsed },
    { id: 'c1-cons', kind: 'consequence', title: 'Limitation expired', statement: timeBarred ? `Period expired ${fr(ctx.lim.expiry)}, before writ #2 (${fr(CASE.writ2.served)})` : `Period runs until ${fr(ctx.lim.expiry)}`,
      rule: 'arts. 2224, 2229 C. civ.; L110-4 C. com.', anchors: [{ doc: 'invoice', quote: "Date d'échéance : 15/03/2021" }, { doc: 'writ2', quote: "L'an deux mille vingt-six et le huit avril" }],
      computed: [['Expiry', fr(ctx.lim.expiry)], ['Writ #2', fr(CASE.writ2.served)], ['Margin', `${daysBetween(ctx.lim.expiry, CASE.writ2.served)} days`]],
      deps: ['q-email', 'q-notice'], holds: timeBarred,
      brokenReason: `Writ #2 served in time — period runs until ${fr(ctx.lim.expiry)}` },
    { id: 'c1-out', kind: 'outcome', title: 'Fin de non-recevoir', statement: 'Claim time-barred → inadmissible',
      rule: 'art. 122 CPC', regime: 'fnr', anchors: [{ doc: 'cpc', quote: 'Constitue une fin de non-recevoir' }], deps: [], holds: true },
  ];
}

function c2(ctx: Ctx): LinkDef[] {
  const timeBarred = ctx.lim.expiry < CASE.asOf;
  return [
    { id: 'c2-fact', kind: 'fact', title: 'Contract clause', statement: 'Art. 14: conciliation “préalablement à toute action judiciaire”',
      anchors: [{ doc: 'contract', quote: 'sera soumis, préalablement à toute action judiciaire, à une tentative de conciliation' }], deps: [], holds: true },
    { id: 'c2-req', kind: 'requirement', title: 'Mandatory conciliation', statement: 'Licit mandatory prior-conciliation clause',
      rule: 'Cass. ch. mixte, 14 Feb 2003', anchors: [{ doc: 'cass2003', quote: "constitue une fin de non-recevoir qui s'impose au juge si les parties l'invoquent" }],
      deps: ['q-clause'], holds: ctx.v('q-clause'), brokenReason: 'Clause not mandatory — no precondition to suing' },
    { id: 'c2-breach', kind: 'breach', title: 'No prior attempt', statement: 'No conciliation on file before writ #2',
      anchors: [{ doc: 'pieces', quote: 'BORDEREAU DES PIÈCES COMMUNIQUÉES' }], deps: ['q-concil'], holds: ctx.v('q-concil'),
      brokenReason: 'Conciliation attempted before the writ' },
    { id: 'c2-sanction', kind: 'sanction', title: 'Fin de non-recevoir', statement: 'Unimplemented clause bars the claim',
      rule: 'arts. 122, 124 CPC', regime: 'fnr', anchors: [{ doc: 'cass2003', quote: "l'irrecevabilité du cédant à agir sur le fondement du contrat" }], deps: [], holds: true },
    { id: 'c2-lost', kind: 'lost_effect', title: 'Not curable', statement: 'A conciliation started during the proceedings cannot cure it',
      rule: 'Cass. ch. mixte, 12 Dec 2014 (exception to art. 126 CPC)', anchors: [{ doc: 'cass2014', quote: "n'est pas susceptible d'être régularisée par la mise en œuvre de la clause en cours d'instance" }],
      deps: [], holds: true },
    { id: 'c2-out', kind: 'outcome', title: 'Claim inadmissible', statement: timeBarred ? `Re-filing after conciliation: already time-barred (${fr(ctx.lim.expiry)})` : `Re-filing possible until ${fr(ctx.lim.expiry)}`,
      rule: 'art. 122 CPC', anchors: [{ doc: 'cpc', quote: 'Constitue une fin de non-recevoir' }], deps: [], holds: true },
  ];
}

function chainResult(id: ChainResult['id'], title: string, subtitle: string, outcome: string, links: Link[]): ChainResult {
  const status: ChainStatus = links.some((l) => l.status === 'broken') ? 'fails' : links.some((l) => l.status === 'contested') ? 'contested' : 'holds';
  const hingesOn = [...new Set(links.flatMap((l) => (l.status === 'contested' ? l.deps : [])))];
  return { id, title, subtitle, links, status, outcome, hingesOn };
}

export function analyse(state: AnalysisState): Analysis {
  const lim = limitationFor(state);
  const ctx: Ctx = { v: (q) => value(state, q), isContested: (q) => isContested(state, q), lim };
  const chains = [
    chainResult('C1', 'Writ lapse → limitation', 'Caducité wipes out the interruption; the period ran out', 'Fin de non-recevoir — time-barred', settle(c1(ctx), ctx)),
    chainResult('C2', 'Mandatory prior conciliation', 'Unimplemented clause, not curable in the proceedings', 'Fin de non-recevoir — conciliation clause', settle(c2(ctx), ctx)),
  ];
  const contestedQuals = [...new Set(chains.flatMap((c) => c.hingesOn))].filter((q) => isContested(state, q));
  return { chains, limitation: lim, contestedQuals };
}

export type Counterfactual = { qid: string; label: string; flipsTo: boolean; active: boolean; effects: { chain: string; from: ChainStatus; to: ChainStatus }[] };

export function counterfactuals(state: AnalysisState): Counterfactual[] {
  const baseState = { ...state, whatIf: {} };
  const base = analyse(baseState);
  return QUALIFICATIONS.map((q) => {
    const flipsTo = !value(baseState, q.id);
    const alt = analyse({ ...baseState, whatIf: { [q.id]: flipsTo } });
    const effects = alt.chains
      .map((c, i) => ({ chain: c.id, from: base.chains[i].status, to: c.status }))
      .filter((e) => (e.from === 'fails') !== (e.to === 'fails'));
    return { qid: q.id, label: q.whatIfLabel, flipsTo, active: q.id in state.whatIf, effects };
  });
}
