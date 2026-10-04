import { english, type Translator } from '../i18n/translate';
import { CASE, QUALIFICATIONS, type Anchor } from '../data/case';
import { addDays, daysBetween, fr } from './dates';
import { computeLimitation, type LimitationResult } from './limitation';
import type { RegimeKey } from './regimes';

export type Decision = 'unreviewed' | 'supported' | 'unsupported' | 'insufficient';
export type ReviewEntry = { note: string; nextStep: string };

export type AnalysisState = {
  decisions: Record<string, Decision>;
  reviews: Record<string, ReviewEntry>;
  /** Counterfactual overrides — never persisted as lawyer decisions. */
  whatIf: Record<string, boolean>;
  art642: boolean;
};

export const initialState = (): AnalysisState => ({
  decisions: Object.fromEntries(QUALIFICATIONS.map((q) => [q.id, q.id === 'q-concil' ? 'insufficient' : 'unreviewed'])),
  reviews: Object.fromEntries(QUALIFICATIONS.map((q) => [q.id, { note: '', nextStep: '' }])),
  whatIf: {},
  art642: true,
});

export type NodeKind = 'fact' | 'requirement' | 'breach' | 'sanction' | 'lost_effect' | 'consequence' | 'outcome';
export type LinkStatus = 'established' | 'contested' | 'unsupported' | 'insufficient' | 'broken' | 'not_reached';
export type ChainStatus = 'holds' | 'contested' | 'unsupported' | 'insufficient' | 'fails';

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

type Ctx = { v: (q: string) => boolean; review: (q: string) => Decision; lim: LimitationResult; t: Translator };

type LinkDef = Omit<Link, 'status' | 'brokenReason'> & { holds: boolean; brokenReason?: string };

export function value(state: AnalysisState, qid: string): boolean {
  if (qid in state.whatIf) return state.whatIf[qid];
  const q = QUALIFICATIONS.find((x) => x.id === qid)!;
  return q.proposed;
}

export function isContested(state: AnalysisState, qid: string): boolean {
  return reviewFor(state, qid) === 'unreviewed';
}

function reviewFor(state: AnalysisState, qid: string): Decision {
  // A hypothetical supplies an assumption for this preview, never a saved review.
  return qid in state.whatIf ? 'supported' : state.decisions[qid] ?? 'unreviewed';
}

export function limitationFor(state: AnalysisState, t: Translator = english): LimitationResult {
  const v = (q: string) => value(state, q);
  const lapsed = v('q-writ1');
  return computeLimitation({
    start: CASE.invoiceDue, years: 5, regimeRule: 'art. L110-4 C. com.', art642: state.art642,
    events: [
      { factId: 'f3', date: '2022-06-02', kind: 'acknowledgment', label: t('Email 02/06/2022'), interrupts: v('q-email'),
        noEffectReason: t('not an acknowledgment of debt'), rule: t('art. 2240 C. civ.') },
      { factId: 'f4', date: '2023-02-10', kind: 'formal_notice', label: t('Mise en demeure 10/02/2023'), interrupts: v('q-notice'),
        noEffectReason: t('an ordinary formal notice does not interrupt'), rule: t('arts. 2240–2244 C. civ.') },
      { factId: 'f5', date: CASE.writ1.served, kind: 'writ', label: t('Writ #1 12/01/2026'), interrupts: !lapsed, endDate: CASE.writ1.orderDate,
        noEffectReason: t('interruption void — writ lapsed (caducité)'),
        rule: lapsed ? t('art. 2243 C. civ. + case law') : 'arts. 2241 al. 2, 2242 C. civ.' },
    ],
  }, t);
}

function settle(defs: LinkDef[], ctx: Ctx): Link[] {
  let stopped = false;
  let provisional = false;
  return defs.map(({ holds, brokenReason, ...l }) => {
    if (stopped) return { ...l, status: 'not_reached' };
    const reviews = l.deps.map(ctx.review);
    const blocker = reviews.includes('unsupported') ? 'unsupported' : reviews.includes('insufficient') ? 'insufficient' : undefined;
    if (blocker) {
      stopped = true;
      return { ...l, status: blocker };
    }
    provisional ||= reviews.includes('unreviewed');
    if (provisional) {
      // Neither a positive nor a negative result is established by an unreviewed premise.
      if (!holds) stopped = true;
      return { ...l, status: 'contested' };
    }
    if (!holds) { stopped = true; return { ...l, status: 'broken', brokenReason }; }
    return { ...l, status: 'established' };
  });
}

function c1(ctx: Ctx): LinkDef[] {
  const { t } = ctx;
  const { served, hearing, placed, orderDate } = CASE.writ1;
  const deadline = addDays(hearing, -8);
  const late = daysBetween(deadline, placed);
  const lapsed = ctx.v('q-writ1');
  const timeBarred = ctx.lim.expiry < CASE.writ2.served;
  return [
    { id: 'c1-fact', kind: 'fact', title: t('Writ served'), statement: t('Writ #1 served {served}, hearing {hearing}', { served: fr(served), hearing: fr(hearing) }),
      anchors: [{ doc: 'writ1', quote: "L'an deux mille vingt-six et le douze janvier" }, { doc: 'writ1', quote: "l'audience du vendredi 20 février 2026" }],
      deps: [], holds: true },
    { id: 'c1-req', kind: 'requirement', title: t('Placement deadline'), statement: t('Copy to be placed with the registry by {date}', { date: fr(deadline) }),
      rule: t('art. 857 CPC'), anchors: [{ doc: 'cpc', quote: 'Cette remise doit avoir lieu au plus tard huit jours avant la date de l\'audience' }],
      computed: [[t('Hearing'), fr(hearing)], [t('− 8 days'), fr(deadline)]], deps: [], holds: true },
    { id: 'c1-breach', kind: 'breach', title: t('Late placement'), statement: t('Placed {date} — {days} days late', { date: fr(placed), days: late }),
      anchors: [{ doc: 'registry', quote: "Copie de l'assignation remise au greffe le 16 février 2026" }],
      computed: [[t('Deadline'), fr(deadline)], [t('Placed'), fr(placed)], [t('Delay'), t('{days} days', { days: late })]], deps: [], holds: placed > deadline,
      brokenReason: t('Writ placed in time') },
    { id: 'c1-sanction', kind: 'sanction', title: lapsed ? 'Caducité' : 'Nullité', statement: lapsed ? t('Lapse recorded by order of {date}', { date: fr(orderDate) }) : t('Writ annulled for a procedural defect'),
      rule: t('art. 857 CPC'), regime: 'caducite', anchors: [{ doc: 'order', quote: "Constatons la caducité de l'assignation." }],
      deps: ['q-writ1'], holds: lapsed,
      contrast: t('Annulled ≠ lapsed: a writ annulled for a procedural defect keeps its interruptive effect (art. 2241 al. 2 C. civ.).'),
      brokenReason: t('Writ annulled, not lapsed — interruption kept (art. 2241 al. 2)') },
    { id: 'c1-lost', kind: 'lost_effect', title: t('Interruption void'), statement: t('Writ #1 no longer interrupts the limitation period'),
      rule: t('art. 2243 C. civ. + case law'), anchors: [{ doc: 'civ', quote: "L'interruption est non avenue" }, { doc: 'cassC1', quote: "elle prive l'assignation de tout effet interruptif de prescription" }],
      deps: ['q-writ1'], holds: lapsed },
    { id: 'c1-cons', kind: 'consequence', title: t('Limitation expired'), statement: timeBarred ? t('Period expired {expiry}, before writ #2 ({served})', { expiry: fr(ctx.lim.expiry), served: fr(CASE.writ2.served) }) : t('Period runs until {date}', { date: fr(ctx.lim.expiry) }),
      rule: t('arts. 2224, 2229 C. civ.; L110-4 C. com.'), anchors: [{ doc: 'invoice', quote: "Date d'échéance : 15/03/2021" }, { doc: 'writ2', quote: "L'an deux mille vingt-six et le huit avril" }],
      computed: [[t('Expiry'), fr(ctx.lim.expiry)], [t('Writ #2'), fr(CASE.writ2.served)], [t('Margin'), t('{days} days', { days: daysBetween(ctx.lim.expiry, CASE.writ2.served) })]],
      deps: ['q-email', 'q-notice'], holds: timeBarred,
      brokenReason: t('Writ #2 served in time — period runs until {date}', { date: fr(ctx.lim.expiry) }) },
    { id: 'c1-out', kind: 'outcome', title: t('Fin de non-recevoir'), statement: t('Claim time-barred → inadmissible'),
      rule: t('art. 122 CPC'), regime: 'fnr', anchors: [{ doc: 'cpc', quote: 'Constitue une fin de non-recevoir' }], deps: [], holds: true },
  ];
}

function c2(ctx: Ctx): LinkDef[] {
  const { t } = ctx;
  const timeBarred = ctx.lim.expiry < CASE.asOf;
  return [
    { id: 'c2-fact', kind: 'fact', title: t('Contract clause'), statement: t('Art. 14: conciliation “préalablement à toute action judiciaire”'),
      anchors: [{ doc: 'contract', quote: 'sera soumis, préalablement à toute action judiciaire, à une tentative de conciliation' }], deps: [], holds: true },
    { id: 'c2-req', kind: 'requirement', title: t('Mandatory conciliation'), statement: t('Licit mandatory prior-conciliation clause'),
      rule: t('Cass. ch. mixte, 14 Feb 2003'), anchors: [{ doc: 'cass2003', quote: "constitue une fin de non-recevoir qui s'impose au juge si les parties l'invoquent" }],
      deps: ['q-clause'], holds: ctx.v('q-clause'), brokenReason: t('Clause not mandatory — no precondition to suing') },
    { id: 'c2-breach', kind: 'breach', title: t('No prior attempt'), statement: t('No conciliation on file before writ #2'),
      anchors: [{ doc: 'pieces', quote: 'BORDEREAU DES PIÈCES COMMUNIQUÉES' }], deps: ['q-concil'], holds: ctx.v('q-concil'),
      brokenReason: t('Conciliation attempted before the writ') },
    { id: 'c2-sanction', kind: 'sanction', title: t('Fin de non-recevoir'), statement: t('Unimplemented clause bars the claim'),
      rule: t('arts. 122, 124 CPC'), regime: 'fnr', anchors: [{ doc: 'cass2003', quote: "l'irrecevabilité du cédant à agir sur le fondement du contrat" }], deps: [], holds: true },
    { id: 'c2-lost', kind: 'lost_effect', title: t('Not curable'), statement: t('A conciliation started during the proceedings cannot cure it'),
      rule: t('Cass. ch. mixte, 12 Dec 2014 (exception to art. 126 CPC)'), anchors: [{ doc: 'cass2014', quote: "n'est pas susceptible d'être régularisée par la mise en œuvre de la clause en cours d'instance" }],
      deps: [], holds: true },
    { id: 'c2-out', kind: 'outcome', title: t('Claim inadmissible'), statement: timeBarred ? t('Re-filing after conciliation: already time-barred ({date})', { date: fr(ctx.lim.expiry) }) : t('Re-filing possible until {date}', { date: fr(ctx.lim.expiry) }),
      rule: t('art. 122 CPC'), anchors: [{ doc: 'cpc', quote: 'Constitue une fin de non-recevoir' }], deps: ['q-email', 'q-notice', 'q-writ1'], holds: true },
  ];
}

function chainResult(id: ChainResult['id'], title: string, subtitle: string, outcome: string, defs: LinkDef[], ctx: Ctx): ChainResult {
  const links = settle(defs, ctx);
  const requiredReviews = [...new Set(defs.flatMap((l) => l.deps))];
  const hingesOn = requiredReviews.filter((qid) => ctx.review(qid) !== 'supported');
  const reviews = hingesOn.map(ctx.review);
  // Review support is distinct from the Boolean result of the provisional calculation.
  // Include every prerequisite even when an earlier link stops the displayed chain.
  const status: ChainStatus = reviews.includes('unsupported') ? 'unsupported'
    : reviews.includes('insufficient') ? 'insufficient'
    : reviews.includes('unreviewed') ? 'contested'
    : links.some((l) => l.status === 'broken') ? 'fails' : 'holds';
  return { id, title, subtitle, links, status, outcome, hingesOn };
}

export function analyse(state: AnalysisState, t: Translator = english): Analysis {
  const lim = limitationFor(state, t);
  const ctx: Ctx = { v: (q) => value(state, q), review: (q) => reviewFor(state, q), lim, t };
  const chains = [
    chainResult('C1', t('Writ lapse → limitation'), t('Caducité wipes out the interruption; the period ran out'), t('Fin de non-recevoir — time-barred'), c1(ctx), ctx),
    chainResult('C2', t('Mandatory prior conciliation'), t('Unimplemented clause, not curable in the proceedings'), t('Fin de non-recevoir — conciliation clause'), c2(ctx), ctx),
  ];
  const contestedQuals = [...new Set(chains.flatMap((c) => c.hingesOn))].filter((q) => isContested(state, q));
  return { chains, limitation: lim, contestedQuals };
}

export type Counterfactual = { qid: string; label: string; flipsTo: boolean; active: boolean; effects: { chain: string; from: ChainStatus; to: ChainStatus }[] };

export function counterfactuals(state: AnalysisState, t: Translator = english): Counterfactual[] {
  const baseState = { ...state, whatIf: {} };
  const base = analyse(baseState);
  return QUALIFICATIONS.map((q) => {
    const flipsTo = !value(baseState, q.id);
    const alt = analyse({ ...baseState, whatIf: { [q.id]: flipsTo } });
    const effects = alt.chains
      .map((c, i) => ({ chain: c.id, from: base.chains[i].status, to: c.status }))
      .filter((e) => e.from !== e.to);
    return { qid: q.id, label: t(q.whatIfLabel), flipsTo, active: q.id in state.whatIf, effects };
  });
}
