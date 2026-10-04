import { english, type Translator } from '../i18n/translate.js';
import { analyseAdditional } from './additionalChains.js';
import { factOf, qualOf, type Anchor, type CaseBundle, type Fact, type Qualification } from '../data/bundle.js';
import { addDays, daysBetween, fr } from './dates.js';
import { computeLimitation, type LimitationEvent, type LimitationResult } from './limitation.js';
import type { RegimeKey } from './regimes.js';

export type Decision = 'proposed' | 'confirmed' | 'rejected' | 'pending';
export type ReviewEntry = { note: string; nextStep: string };

export type AnalysisState = {
  decisions: Record<string, Decision>;
  interpretations: Record<string, boolean>;
  reviews: Record<string, ReviewEntry>;
  whatIf: Record<string, boolean>;
  art642: boolean;
};

export const initialState = (bundle: CaseBundle): AnalysisState => ({
  decisions: Object.fromEntries(bundle.qualifications.map((q) => [q.id, 'proposed' as Decision])),
  interpretations: {},
  reviews: {},
  whatIf: {},
  art642: true,
});

export type NodeKind = 'fact' | 'requirement' | 'breach' | 'sanction' | 'lost_effect' | 'consequence' | 'outcome';
export type LinkStatus = 'established' | 'contested' | 'broken' | 'not_reached' | 'pending';
export type ChainStatus = 'holds' | 'contested' | 'fails' | 'not_applicable' | 'pending';

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

export type ChainResult = {
  id: string; title: string; subtitle: string; links: Link[]; status: ChainStatus;
  outcome: string; hingesOn: string[]; missing?: string[];
};

export type Analysis = {
  chains: ChainResult[];
  limitation: LimitationResult | null;
  contestedQuals: string[];
  notices?: string[];
  timeline?: { label: string; date: string }[];
};

type FactQualification = { fact: Fact; qualification: Qualification };
type PlacementRule = { days: number; rule: string; anchors: Anchor[] };

export type DerivedCase = {
  limitationStart?: Fact;
  periodYears: number;
  regimeRule: string;
  placementRule?: PlacementRule;
  writs: Fact[];
  firstWrit?: Fact;
  lastWrit?: Fact;
  placement?: Fact;
  sanction?: Fact;
  writOutcomeQ?: Qualification;
  clause?: Fact;
  clauseQ?: Qualification;
  concilQ?: Qualification;
  exhibits?: Fact;
  acks: FactQualification[];
  notices: FactQualification[];
};

const kindOf = (bundle: CaseBundle, fact: Fact, kind: Qualification['kind']) =>
  bundle.qualifications.find((q) => q.factId === fact.id && q.kind === kind);

export function deriveCase(bundle: CaseBundle): DerivedCase {
  const facts = bundle.facts.filter((fact) => fact.verified);
  const getByRole = (role: Fact['role']) => facts.filter((fact) => fact.role === role);
  const limitationStart = getByRole('limitation_start').sort((a, b) => a.date.localeCompare(b.date))[0];
  const writs = getByRole('writ').sort((a, b) => (a.attrs.servedAt ?? a.date).localeCompare(b.attrs.servedAt ?? b.date));
  const firstWrit = writs[0];
  const lastWrit = writs.at(-1);
  const firstServed = firstWrit && (firstWrit.attrs.servedAt ?? firstWrit.date);
  const lastServed = lastWrit && (lastWrit.attrs.servedAt ?? lastWrit.date);
  const placements = getByRole('writ_placement');
  const sanctions = getByRole('writ_sanction');
  const placement = firstWrit && (placements.find((fact) => fact.attrs.writFactId === firstWrit.id) ??
    placements.filter((fact) => {
      const date = fact.attrs.placedAt ?? fact.date;
      return !fact.attrs.writFactId && date > firstServed! && (!lastServed || date < lastServed);
    }).sort((a, b) => (a.attrs.placedAt ?? a.date).localeCompare(b.attrs.placedAt ?? b.date))[0]);
  const sanction = firstWrit && (sanctions.find((fact) => fact.attrs.writFactId === firstWrit.id) ??
    sanctions.filter((fact) => !fact.attrs.writFactId && fact.date > firstServed! && (!lastServed || fact.date < lastServed))
      .sort((a, b) => a.date.localeCompare(b.date))[0]);
  const writOutcomeQ = bundle.qualifications.find((q) => q.kind === 'writ_outcome' && q.factId === sanction?.id)
    ?? bundle.qualifications.find((q) => q.kind === 'writ_outcome' && q.factId === firstWrit?.id);
  const clausePair = getByRole('conciliation_clause').map((fact) => ({
    fact, qualification: kindOf(bundle, fact, 'conciliation_clause'),
  })).find((pair) => pair.qualification);
  const clauseQ = clausePair?.qualification;
  const clause = clausePair?.fact;
  const concilQ = bundle.qualifications.find((q) => q.kind === 'conciliation_attempted' && facts.some((fact) => fact.id === q.factId));
  const relationship = bundle.profile.relationship;
  const periodYears = relationship === 'consumer' ? 2 : 5;
  const regimeRule = relationship === 'commercial' ? 'art. L110-4 C. com.' : relationship === 'civil' ? 'art. 2224 C. civ.' : 'art. L218-2 C. conso.';
  const placementRule = bundle.profile.courtType === 'tribunal_commerce'
    ? { days: 8, rule: 'art. 857 CPC', anchors: [{ doc: 'cpc', quote: 'Cette remise doit avoir lieu au plus tard huit jours avant la date de l\'audience' }] }
    : bundle.profile.courtType === 'tribunal_judiciaire'
      ? { days: 15, rule: 'art. 754 CPC (to verify)', anchors: [] }
      : undefined;
  const acks = getByRole('debtor_communication').flatMap((fact) => {
    const qualification = kindOf(bundle, fact, 'acknowledgment');
    return qualification ? [{ fact, qualification }] : [];
  });
  const notices = getByRole('formal_notice').flatMap((fact) => {
    const qualification = kindOf(bundle, fact, 'formal_notice');
    return qualification ? [{ fact, qualification }] : [];
  });

  return {
    limitationStart, periodYears, regimeRule, placementRule, writs, firstWrit, lastWrit,
    placement, sanction, writOutcomeQ, clause, clauseQ, concilQ,
    exhibits: getByRole('exhibits_list')[0], acks, notices,
  };
}

export function value(bundle: CaseBundle, state: AnalysisState, qid: string): boolean {
  if (qid in state.whatIf) return state.whatIf[qid];
  if (qid in state.interpretations) return state.interpretations[qid];
  const q = qualOf(bundle, qid);
  return state.decisions[qid] === 'rejected' ? !q.proposed : q.proposed;
}

export function isContested(bundle: CaseBundle, state: AnalysisState, qid: string): boolean {
  const q = qualOf(bundle, qid);
  return !(qid in state.whatIf) && (state.decisions[qid] === 'pending' || (q.source === 'ai_inferred' && state.decisions[qid] === 'proposed'));
}

export function adoptInterpretation(bundle: CaseBundle, state: AnalysisState, qid: string, interpretation: boolean, review?: ReviewEntry): AnalysisState {
  if (Object.keys(state.whatIf).length || !bundle.qualifications.some((q) => q.id === qid)) return state;
  return {
    ...state,
    decisions: { ...state.decisions, [qid]: 'confirmed' },
    interpretations: { ...state.interpretations, [qid]: interpretation },
    reviews: review ? { ...state.reviews, [qid]: review } : state.reviews,
  };
}

export function limitationFor(bundle: CaseBundle, state: AnalysisState, t: Translator = english): LimitationResult | null {
  if (bundle.preset) return null;
  const derived = deriveCase(bundle);
  if (!derived.limitationStart) return null;
  const events: LimitationEvent[] = [
    ...derived.acks.map(({ fact, qualification }) => ({
      factId: fact.id, date: fact.date, kind: 'acknowledgment' as const,
      label: t('{kind} {date}', { kind: t(fact.kind), date: fr(fact.date) }),
      interrupts: value(bundle, state, qualification.id),
      noEffectReason: t('not an acknowledgment of debt'), rule: t('art. 2240 C. civ.'),
    })),
    ...derived.notices.map(({ fact, qualification }) => ({
      factId: fact.id, date: fact.date, kind: 'formal_notice' as const,
      label: t('{kind} {date}', { kind: t(fact.kind), date: fr(fact.date) }),
      interrupts: value(bundle, state, qualification.id),
      noEffectReason: t('an ordinary formal notice does not interrupt'), rule: t('arts. 2240–2244 C. civ.'),
    })),
  ];
  const writ = derived.firstWrit;
  if (writ) {
    const lapsed = derived.writOutcomeQ ? value(bundle, state, derived.writOutcomeQ.id) : false;
    events.push({
      factId: writ.id, date: writ.attrs.servedAt ?? writ.date, kind: 'writ' as const,
      label: t('{kind} {date}', { kind: t(writ.kind), date: fr(writ.attrs.servedAt ?? writ.date) }),
      interrupts: !lapsed, endDate: derived.sanction?.date,
      noEffectReason: t('interruption void — writ lapsed (caducité)'),
      rule: lapsed ? t('art. 2243 C. civ. + case law') : 'arts. 2241 al. 2, 2242 C. civ.',
    });
  }
  return computeLimitation({
    start: derived.limitationStart.date, years: derived.periodYears,
    regimeRule: derived.regimeRule, art642: state.art642, events,
  }, t);
}

type Ctx = {
  bundle: CaseBundle; state: AnalysisState; derived: DerivedCase; lim: LimitationResult | null; t: Translator;
  v: (qid: string) => boolean; isContested: (qid: string) => boolean;
};

type LinkDef = Omit<Link, 'status' | 'brokenReason'> & { holds: boolean; brokenReason?: string };

function settle(defs: LinkDef[], ctx: Ctx): Link[] {
  let broken = false;
  return defs.map(({ holds, brokenReason, ...link }) => {
    if (broken) return { ...link, status: 'not_reached' };
    if (link.deps.some((qid) => ctx.state.decisions[qid] === 'pending' && !(qid in ctx.state.whatIf))) {
      broken = true;
      return { ...link, status: 'pending' };
    }
    if (!holds) { broken = true; return { ...link, status: 'broken', brokenReason }; }
    return { ...link, status: link.deps.some(ctx.isContested) ? 'contested' : 'established' };
  });
}

function c1(ctx: Ctx): LinkDef[] {
  const { t, derived } = ctx;
  const lim = ctx.lim!;
  const first = derived.firstWrit!;
  const last = derived.lastWrit!;
  const placement = derived.placement!;
  const qualification = derived.writOutcomeQ!;
  const sanction = derived.sanction ?? factOf(ctx.bundle, qualification.factId);
  const served = first.attrs.servedAt ?? first.date;
  const lastServed = last.attrs.servedAt ?? last.date;
  const hearing = first.attrs.hearingDate!;
  const placed = placement.attrs.placedAt ?? placement.date;
  const deadline = addDays(hearing, -derived.placementRule!.days);
  const late = daysBetween(deadline, placed);
  const lapsed = ctx.v(qualification.id);
  const timeBarred = lim.expiry < lastServed;
  const firstFact = first;
  const lastFact = last;
  const startFact = derived.limitationStart!;
  const placementRule = derived.placementRule!;
  return [
    { id: 'c1-fact', kind: 'fact', title: t('Writ served'), statement: t('Writ #1 served {served}, hearing {hearing}', { served: fr(served), hearing: fr(hearing) }),
      anchors: firstFact.anchors, deps: [], holds: true },
    { id: 'c1-req', kind: 'requirement', title: t('Placement deadline'), statement: t('Copy to be placed with the registry by {date}', { date: fr(deadline) }),
      rule: t(placementRule.rule), anchors: placementRule.anchors,
      computed: [[t('Hearing'), fr(hearing)], [t('− {days} days', { days: placementRule.days }), fr(deadline)]], deps: [], holds: true },
    { id: 'c1-breach', kind: 'breach', title: t('Late placement'), statement: t('Placed {date} — {days} days late', { date: fr(placed), days: late }),
      anchors: placement.anchors, computed: [[t('Deadline'), fr(deadline)], [t('Placed'), fr(placed)], [t('Delay'), t('{days} days', { days: late })]],
      deps: [], holds: placed > deadline, brokenReason: t('Writ placed in time') },
    { id: 'c1-sanction', kind: 'sanction', title: lapsed ? 'Caducité' : 'Nullité', statement: lapsed ? t('Lapse recorded by order of {date}', { date: fr(sanction.date) }) : t('Writ annulled for a procedural defect'),
      rule: t(placementRule.rule), regime: 'caducite', anchors: sanction.anchors,
      deps: [qualification.id], holds: lapsed,
      contrast: t('Annulled ≠ lapsed: a writ annulled for a procedural defect keeps its interruptive effect (art. 2241 al. 2 C. civ.).'),
      brokenReason: t('Writ annulled, not lapsed — interruption kept (art. 2241 al. 2)') },
    { id: 'c1-lost', kind: 'lost_effect', title: t('Interruption void'), statement: t('Writ #1 no longer interrupts the limitation period'),
      rule: t('art. 2243 C. civ. + case law'), anchors: [{ doc: 'civ', quote: "L'interruption est non avenue" }, { doc: 'cassC1', quote: "elle prive l'assignation de tout effet interruptif de prescription" }],
      deps: [qualification.id], holds: lapsed },
    { id: 'c1-cons', kind: 'consequence', title: t('Limitation expired'), statement: timeBarred ? t('Period expired {expiry}, before writ #2 ({served})', { expiry: fr(lim.expiry), served: fr(lastServed) }) : t('Period runs until {date}', { date: fr(lim.expiry) }),
      rule: `${derived.regimeRule}; art. 2229 C. civ.`, anchors: [...startFact.anchors, ...lastFact.anchors],
      computed: [[t('Expiry'), fr(lim.expiry)], [t('Writ #2'), fr(lastServed)], [t('Margin'), t('{days} days', { days: daysBetween(lim.expiry, lastServed) })]],
      deps: [...ctx.derived.acks, ...ctx.derived.notices].map((event) => event.qualification.id), holds: timeBarred,
      brokenReason: t('Writ #2 served in time — period runs until {date}', { date: fr(lim.expiry) }) },
    { id: 'c1-out', kind: 'outcome', title: t('Fin de non-recevoir'), statement: t('Claim time-barred → inadmissible'),
      rule: t('art. 122 CPC'), regime: 'fnr', anchors: [{ doc: 'cpc', quote: 'Constitue une fin de non-recevoir' }], deps: [], holds: true },
  ];
}

function c2(ctx: Ctx): LinkDef[] {
  const { t, derived, lim } = ctx;
  const clause = derived.clause!;
  const concilQ = derived.concilQ!;
  const lastWrit = derived.lastWrit;
  const timeBarred = !!lim && lim.expiry < ctx.bundle.profile.asOf;
  const concilFact = factOf(ctx.bundle, concilQ.factId);
  const breachAnchors = [...(derived.exhibits?.anchors ?? []), ...(concilQ.anchors ?? [])];
  return [
    { id: 'c2-fact', kind: 'fact', title: t('Contract clause'), statement: t(clause.summary),
      anchors: clause.anchors, deps: [], holds: true },
    { id: 'c2-req', kind: 'requirement', title: t('Mandatory conciliation'), statement: t('Licit mandatory prior-conciliation clause'),
      rule: t('Cass. ch. mixte, 14 Feb 2003'), anchors: [{ doc: 'cass2003', quote: "constitue une fin de non-recevoir qui s'impose au juge si les parties l'invoquent" }],
      deps: [derived.clauseQ!.id], holds: ctx.v(derived.clauseQ!.id), brokenReason: t('Clause not mandatory — no precondition to suing') },
    { id: 'c2-breach', kind: 'breach', title: t('No prior attempt'),
      statement: lastWrit
        ? t('No conciliation on file before the writ of {date}', { date: fr(lastWrit.attrs.servedAt ?? lastWrit.date) })
        : t('No conciliation on file before the writ'),
      anchors: breachAnchors.length ? breachAnchors : concilFact.anchors, deps: [concilQ.id], holds: ctx.v(concilQ.id),
      brokenReason: t('Conciliation attempted before the writ') },
    { id: 'c2-sanction', kind: 'sanction', title: t('Fin de non-recevoir'), statement: t('Unimplemented clause bars the claim'),
      rule: t('arts. 122, 124 CPC'), regime: 'fnr', anchors: [{ doc: 'cass2003', quote: "l'irrecevabilité du cédant à agir sur le fondement du contrat" }], deps: [], holds: true },
    { id: 'c2-lost', kind: 'lost_effect', title: t('Not curable'), statement: t('A conciliation started during the proceedings cannot cure it'),
      rule: t('Cass. ch. mixte, 12 Dec 2014 (exception to art. 126 CPC)'), anchors: [{ doc: 'cass2014', quote: "n'est pas susceptible d'être régularisée par la mise en œuvre de la clause en cours d'instance" }],
      deps: [], holds: true },
    { id: 'c2-out', kind: 'outcome', title: t('Claim inadmissible'), statement: lim
      ? timeBarred ? t('Re-filing after conciliation: already time-barred ({date})', { date: fr(lim.expiry) }) : t('Re-filing possible until {date}', { date: fr(lim.expiry) })
      : t('Claim inadmissible'),
      rule: t('art. 122 CPC'), anchors: [{ doc: 'cpc', quote: 'Constitue une fin de non-recevoir' }],
      deps: [...derived.acks, ...derived.notices].map(({ qualification }) => qualification.id).concat(derived.writOutcomeQ ? [derived.writOutcomeQ.id] : []), holds: true },
  ];
}

function chainResult(id: string, title: string, subtitle: string, outcome: string, links: Link[]): ChainResult {
  const status: ChainStatus = links.some((link) => link.status === 'pending') ? 'pending' : links.some((link) => link.status === 'broken') ? 'fails' : links.some((link) => link.status === 'contested') ? 'contested' : 'holds';
  const hingesOn = [...new Set(links.flatMap((link) => link.status === 'contested' || link.status === 'pending' ? link.deps : []))];
  return { id, title, subtitle, links, status, outcome, hingesOn };
}

function unavailable(id: string, title: string, subtitle: string, outcome: string, missing: string[]): ChainResult {
  return { id, title, subtitle, outcome, status: 'not_applicable', links: [], hingesOn: [], missing };
}

export function analyse(bundle: CaseBundle, state: AnalysisState, t: Translator = english): Analysis {
  if (bundle.preset) return analyseAdditional(bundle, state, t);
  const derived = deriveCase(bundle);
  const lim = limitationFor(bundle, state, t);
  const c1Title = t('Writ lapse → limitation');
  const c1Subtitle = t('Caducité wipes out the interruption; the period ran out');
  const c1Outcome = t('Fin de non-recevoir — time-barred');
  const c2Title = t('Mandatory prior conciliation');
  const c2Subtitle = t('Unimplemented clause, not curable in the proceedings');
  const c2Outcome = t('Fin de non-recevoir — conciliation clause');
  const missingC1 = [
    ...(!derived.limitationStart ? [t('No limitation start found')] : []),
    ...(derived.writs.length < 2 ? [t('No second writ in the file')] : []),
    ...(!derived.firstWrit?.attrs.hearingDate ? [t('No hearing date for the first writ')] : []),
    ...(!derived.placement ? [t('No placement record for the first writ')] : []),
    ...(!derived.writOutcomeQ ? [t('No writ-outcome qualification found')] : []),
    ...(!derived.placementRule ? [t('No placement rule for the court')] : []),
  ];
  const ctx: Ctx = {
    bundle, state, derived, lim, t,
    v: (qid) => value(bundle, state, qid), isContested: (qid) => isContested(bundle, state, qid),
  };
  const c1Result = missingC1.length
    ? unavailable('C1', c1Title, c1Subtitle, c1Outcome, missingC1)
    : chainResult('C1', c1Title, c1Subtitle, c1Outcome, settle(c1(ctx), ctx));
  const missingC2 = [
    ...(!derived.clause || !derived.clauseQ ? [t('No mandatory-conciliation clause found')] : []),
    ...(!derived.concilQ ? [t('No conciliation-attempt qualification found')] : []),
  ];
  const c2Result = missingC2.length
    ? unavailable('C2', c2Title, c2Subtitle, c2Outcome, missingC2)
    : chainResult('C2', c2Title, c2Subtitle, c2Outcome, settle(c2(ctx), ctx));
  const chains = [c1Result, c2Result];
  const contestedQuals = [...new Set(chains.flatMap((chain) => chain.hingesOn))].filter((qid) => isContested(bundle, state, qid));
  return { chains, limitation: lim, contestedQuals };
}

export type Counterfactual = { qid: string; label: string; flipsTo: boolean; active: boolean; effects: { chain: string; from: ChainStatus; to: ChainStatus }[] };

export function counterfactuals(bundle: CaseBundle, state: AnalysisState, t: Translator = english): Counterfactual[] {
  const baseState = { ...state, whatIf: {} };
  const base = analyse(bundle, baseState);
  return bundle.qualifications.map((q) => {
    const flipsTo = !value(bundle, baseState, q.id);
    const alt = analyse(bundle, { ...baseState, whatIf: { [q.id]: flipsTo } });
    const effects = alt.chains
      .map((chain, i) => ({ chain: chain.id, from: base.chains[i].status, to: chain.status }))
      .filter((effect) => effect.from !== 'not_applicable' && effect.to !== 'not_applicable' && (effect.from === 'fails') !== (effect.to === 'fails'));
    return { qid: q.id, label: flipsTo === !q.proposed ? t(q.whatIfLabel) : t(flipsTo ? q.yes : q.no), flipsTo, active: q.id in state.whatIf, effects };
  });
}
