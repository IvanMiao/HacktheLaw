import { factOf, type CaseBundle } from '../data/bundle.js';
import { value, isContested, type Analysis, type AnalysisState, type ChainResult, type Link, type NodeKind } from './chains.js';
import { daysBetween } from './dates.js';
import { proceduralDeadline } from './proceduralDates.js';
import type { Translator } from '../i18n/translate.js';
import type { RegimeKey } from './regimes.js';

type Definition = {id:string; kind:NodeKind; title:string; statement:string; fact?:string; rule?:string; deps?:string[]; holds?:boolean; brokenReason?:string; regime?:RegimeKey};

export function analyseAdditional(bundle: CaseBundle, state: AnalysisState, t: Translator): Analysis {
  const v = (id:string) => value(bundle, state, id);
  const contested = (id:string) => isContested(bundle, state, id);
  const chain = (id:string, title:string, subtitle:string, outcome:string, definitions:Definition[]): ChainResult => {
    let broken = false;
    const links:Link[] = definitions.map(d => {
      const pending = (d.deps ?? []).some(qid => state.decisions[qid] === 'pending' && !(qid in state.whatIf));
      const status = broken ? 'not_reached' : pending ? 'pending' : d.holds === false ? 'broken' : (d.deps ?? []).some(contested) ? 'contested' : 'established';
      if (status === 'broken' || status === 'pending') broken = true;
      return {id:d.id, kind:d.kind, title:t(d.title), statement:t(d.statement), rule:d.rule, regime:d.regime,
        anchors:d.fact ? factOf(bundle, d.fact).anchors : [], deps:d.deps ?? [], status,
        brokenReason:d.brokenReason ? t(d.brokenReason) : undefined};
    });
    return {id, title:t(title), subtitle:t(subtitle), outcome:t(outcome), links,
      status:links.some(l => l.status === 'pending') ? 'pending' : links.some(l => l.status === 'broken') ? 'fails' : links.some(l => l.status === 'contested') ? 'contested' : 'holds',
      hingesOn:[...new Set(links.filter(l => l.status === 'contested' || l.status === 'pending').flatMap(l => l.deps))]};
  };
  let chains:ChainResult[] = []; let notices:string[] = []; let timeline:{label:string;date:string}[] = [];
  if (bundle.preset === 'c3') {
    const declaration = proceduralDeadline('2025-11-20',2), relief = proceduralDeadline('2025-11-20',6);
    notices = [
      t('SYNTHETIC — legal review required. Declaration does not lift the independent payment-action stay.'),
      t('Ordinary relief deadline {date} expired {days} days before the as-of date.',{date:relief.adjusted,days:daysBetween(relief.adjusted,bundle.profile.asOf)}),
      t('Exceptional timing concerns inability to know the existence of the debt, not merely ignorance of proceedings. Relief requires an application and a court order; no relief is adjudicated here.'),
      t('Inopposability is subject to statutory plan conditions, not extinction. Review deemed declaration by the debtor under L622-24, creditor domicile and published security exceptions.'),
    ];
    if (v('q-listed') || v('q-knowledge')) notices.push(t('Hypothetical omission or debt-knowledge evidence may support review of relief, but does not itself remove forclusion or the payment stay.'));
    timeline = [{label:'Opening judgment',date:'2025-11-10'},{label:'BODACC publication',date:'2025-11-20'},{label:'Declaration deadline',date:declaration.adjusted},{label:'Ordinary relief deadline',date:relief.adjusted},{label:'As of',date:bundle.profile.asOf}];
    chains = [
      chain('C3-stay','Stay on individual payment actions','Independent from declaration and relief','Payment-action stay — collective route required',[
        {id:'c3-stay-fact',kind:'fact',title:'Pre-existing debt',statement:'Invoice predates the opening judgment.',fact:'g1'},
        {id:'c3-stay-req',kind:'requirement',title:'Opening judgment',statement:'Opening on 10 November 2025 prohibits individual payment actions for pre-existing debts.',fact:'g2',rule:'L622-21 / L631-14 C. com.'},
        {id:'c3-stay-breach',kind:'breach',title:'New payment action',statement:'The 2 February 2026 writ seeks payment after opening.',fact:'g6'},
        {id:'c3-stay-out',kind:'outcome',title:'Payment action barred',statement:'A timely declaration does not authorize this new payment suit. Use the collective proceedings route.',fact:'g2',regime:'insolvency_stay',rule:'L622-21 C. com.'},
      ]),
      chain('C3','Non-declaration → forclusion','Separate from the public-order stay','Potential exclusion from distributions — not debt extinction',[
        {id:'c3-fact',kind:'fact',title:'BODACC publication',statement:'Publication on 20 November 2025 starts the ordinary declaration period.',fact:'g3'},
        {id:'c3-req',kind:'requirement',title:'Declaration deadline',statement:'Regular declaration due 20 January 2026.',rule:'L622-24 / R622-24 C. com.',fact:'g5'},
        {id:'c3-breach',kind:'breach',title:'No regular declaration',statement:'Authored synthetic register confirms no regular declaration by the deadline.',fact:'g5',deps:['q-declared'],holds:!v('q-declared'),brokenReason:'Timely declaration removes this non-declaration consequence only; payment stay remains.'},
        {id:'c3-sanction',kind:'sanction',title:'Forclusion',statement:'No admission to distributions absent judicial relief; no relief order exists in this fixture.',fact:'g8',regime:'forclusion_insolvency',rule:'L622-26 C. com.'},
        {id:'c3-lost',kind:'lost_effect',title:'Relief prospects — contested',statement:'Omission and debt-knowledge evidence require separate judicial review; potential relief is not automatic.',fact:'g7',deps:['q-listed','q-knowledge'],rule:'L622-26 C. com.'},
        {id:'c3-out',kind:'outcome',title:'Conditional inopposability',statement:'Claim is not extinguished. Statutory plan conditions and relief application must be reviewed.',fact:'g8',rule:'L622-26 C. com.'},
      ]),
    ];
  } else if (bundle.preset === 'c4') {
    notices = [t('SYNTHETIC — legal review required. Losing the late objection does not validate the consumer jurisdiction clause.'),
      t('A timely reasoned objection naming the requested court removes the timing bar only; it does not guarantee transfer to Nantes.'),
      t('Residual own-motion consumer-clause review is distinct from territorial transfer and requires hearing the parties. CPC 77 powers are limited; R631-3 does not automatically transfer this defendant case.')];
    timeline = [{label:'Merits submissions',date:'2026-01-15'},{label:'Jurisdiction objection',date:'2026-03-01'},{label:'Case-management order',date:'2026-04-20'}];
    chains = [chain('C4','Order of procedural objections','Timing, not substantive validity of the clause','Potential inadmissibility of the jurisdiction objection',[
      {id:'c4-fact',kind:'fact',title:'Consumer jurisdiction clause',statement:v('q-clause-void') ? 'The consumer clause is deemed unwritten, subject to legal review.' : 'Hypothetical clause effectiveness does not change the sequencing rule.',fact:'h1',deps:['q-clause-void'],rule:'art. 48 CPC'},
      {id:'c4-req',kind:'requirement',title:'Objection before merits',statement:'Procedural objections must be simultaneous and before merits defences or fins de non-recevoir.',fact:'h4',rule:'arts. 74, 75 CPC'},
      {id:'c4-breach',kind:'breach',title:'Merits argued first',statement:'First submissions on 15 January precede the objection on 1 March.',fact:'h4',deps:['q-merits-first'],holds:v('q-merits-first'),brokenReason:'Timing bar removed only; jurisdiction, reasoning and designation still require review. No transfer guaranteed.'},
      {id:'c4-sanction',kind:'sanction',title:'Objection timing bar',statement:'The party-raised objection is potentially inadmissible despite the clause being ineffective.',fact:'h5',rule:'art. 74 CPC',regime:'jurisdiction_objection'},
      {id:'c4-lost',kind:'lost_effect',title:'No automatic transfer',statement:'Paris is not dispossessed on this late objection; this does not validate the clause.',fact:'h7'},
      {id:'c4-out',kind:'outcome',title:'Objection procedurally lost',statement:'Separate own-motion clause review remains a legal-review point, not an automatic transfer.',fact:'h6',rule:'CPC 77 / R632-1 C. conso.'},
    ])];
  } else {
    const deadline = proceduralDeadline('2025-08-01',3); const days = daysBetween(deadline.adjusted,'2025-11-20');
    notices = [t('SYNTHETIC — legal review required. Raw deadline {raw}; adjusted deadline {adjusted}; filing {days} days late.',{raw:deadline.raw,adjusted:deadline.adjusted,days}),
      t('Timely-filing and force-majeure previews are hypothetical pre-order scenarios. They cannot undo the existing 15 December 2025 lapse order.'),
      t('Potential finality depends on no surviving incidental appeal, no other valid appeal and review of remedies against the order. The authored fixture states these absent; verify before real use.'),
      t('CPC 641/642 procedural extension is mandatory here, independent of the substantive-limitation toggle. National France holidays only; local closures, notification and operative claims require review.')];
    timeline = [{label:'Judgment served',date:'2025-07-08'},{label:'Ordinary appeal deadline',date:proceduralDeadline('2025-07-08',1).adjusted},{label:'Notice of appeal',date:'2025-08-01'},{label:'Raw deadline',date:deadline.raw},{label:'Adjusted deadline',date:deadline.adjusted},{label:'Submissions filed',date:'2025-11-20'},{label:'Lapse order',date:'2025-12-15'}];
    chains = [chain('C5','Appeal lapse → potential finality','Ordinary appeal; hypothetical changes evaluated before order','Potential finality — no surviving appeal in fixture',[
      {id:'c5-fact',kind:'fact',title:'Timely notice of appeal',statement:'Notice on 1 August 2025 follows service on 8 July within the ordinary appeal period.',fact:'k3',rule:'art. 538 CPC'},
      {id:'c5-req',kind:'requirement',title:'Three-month procedural deadline',statement:'Raw 1 November 2025 (Saturday / All Saints) extends to Monday 3 November 2025.',fact:'k3',rule:'arts. 908, 641, 642 CPC'},
      {id:'c5-breach',kind:'breach',title:'Late submissions',statement:'20 November 2025 is 17 days after the adjusted deadline.',fact:'k5',deps:['q-late'],holds:!v('q-late'),brokenReason:'Pre-order timely-filing hypothetical removes this breach, subject to other appeal conditions; existing order unchanged.'},
      {id:'c5-sanction',kind:'sanction',title:'Caducité',statement:'Order of 15 December records lapse. Force majeure is assessed only in a hypothetical pre-order scenario.',fact:'k6',deps:['q-force-majeure'],holds:!v('q-force-majeure'),brokenReason:'Potential pre-order judicial disapplication for qualifying force majeure; not withdrawal of the existing order.',rule:'arts. 908, 911 CPC',regime:'appeal_lapse'},
      {id:'c5-lost',kind:'lost_effect',title:'Appeal instance ends',statement:'Authored fixture confirms no incidental appeal survives; verify CPC 550 and all remedies.',fact:'k7',rule:'art. 550 CPC'},
      {id:'c5-out',kind:'outcome',title:'Potential finality',statement:'First-instance judgment potentially final only if no valid appeal or remaining remedy survives.',fact:'k1'},
    ])];
  }
  return {chains, limitation:null, contestedQuals:[...new Set(chains.flatMap(c => c.hingesOn))].filter(contested),notices,timeline:timeline.sort((a,b) => a.date.localeCompare(b.date))};
}
