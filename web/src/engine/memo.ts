import { CASE, QUALIFICATIONS, type Anchor } from '../data/case';
import { docById } from '../data/documents';
import { type Analysis, type AnalysisState, type Decision } from './chains';
import { daysBetween, fr } from './dates';
import { REGIMES } from './regimes';
import { english, type Translator } from '../i18n/translate';

export type Part = string | Anchor;
type Block = { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; parts: Part[] };

const A = (doc: string, quote: string): Anchor => ({ doc, quote });
const decisionLabels: Record<Decision, string> = {
  unreviewed: 'Unreviewed', supported: 'Supported', unsupported: 'Unsupported', insufficient: 'Insufficient',
};

export function buildMemo(analysis: Analysis, state: AnalysisState, t: Translator = english): Block[] {
  const b: Block[] = [];
  const days = daysBetween(CASE.asOf, CASE.nextHearing);
  const hypothetical = Object.keys(state.whatIf).length > 0;
  const supported = analysis.chains.filter((c) => c.status === 'holds');
  const pending = analysis.chains.filter((c) => c.status === 'contested' || c.status === 'insufficient');
  const excluded = analysis.chains.filter((c) => c.status === 'unsupported' || c.status === 'fails');

  b.push({ t: 'h1', parts: [t('Defence memo — {title}', { title: t(CASE.title) })] });
  if (hypothetical) {
    b.push({ t: 'note', parts: [t('Hypothetical preview — not an adopted lawyer position. Saved reviews and next steps below are unchanged by this scenario.')] });
    QUALIFICATIONS.filter((q) => q.id in state.whatIf).forEach((q) => {
      b.push({ t: 'li', parts: [t('Scenario assumption — {question}: {answer}.', { question: t(q.question), answer: t(state.whatIf[q.id] ? q.yes : q.no) })] });
    });
  }
  b.push({ t: 'h2', parts: [t('1. Case summary')] });
  b.push({ t: 'p', parts: [t('We act for Bâtiself SARL, sued by Atelier Lumière SAS before the {court} for payment of invoice F-2021-034 ({amount}) ', { court: CASE.court, amount: CASE.amount }), A('invoice', "Date d'échéance : 15/03/2021"),
    t('. The file contains an order recording the lapse of the first writ of {date} ', { date: fr(CASE.writ1.served) }), A('order', "Constatons la caducité de l'assignation."),
    t('. The claim is now brought by a second writ of {date} ', { date: fr(CASE.writ2.served) }), A('writ2', "L'an deux mille vingt-six et le huit avril"), t(', hearing on {date}.', { date: fr(CASE.nextHearing) })] });

  b.push({ t: 'h2', parts: [t('2. Review outcomes')] });
  b.push({ t: 'p', parts: [t('Only supported chains are included below as potential grounds. Pending or unsupported qualifications do not establish a defence; a supported review is not a court decision.')] });
  if (!supported.length) b.push({ t: 'note', parts: [t('No supported ground in the current analysis. Resolve the review items before preparing a defence based on these chains.')] });
  supported.forEach((c) => {
    b.push({ t: 'h3', parts: [t(hypothetical ? 'Scenario result — {id}: {outcome}' : 'Supported ground — {id}: {outcome}', { id: c.id, outcome: c.outcome })] });
    c.links.forEach((l) => b.push({ t: 'li', parts: [`${l.title}: ${l.statement}${l.rule ? ` (${l.rule})` : ''} `, ...l.anchors] }));
    const reg = c.links.find((l) => l.kind === 'sanction' || l.kind === 'outcome')?.regime;
    if (reg) b.push({ t: 'p', parts: [t('Regime: {name} — {when}; prejudice: {prejudice}; curable: {curable}.', { name: t(REGIMES[reg].name), when: t(REGIMES[reg].when), prejudice: t(REGIMES[reg].prejudice), curable: t(REGIMES[reg].curable) })] });
  });
  pending.forEach((c) => {
    b.push({ t: 'note', parts: [t('Pending review — {id}: {title}. Do not treat this chain as an available defence yet.', { id: c.id, title: c.title })] });
  });
  excluded.forEach((c) => {
    const blocked = c.links.find((l) => l.status === 'unsupported' || l.status === 'broken');
    b.push({ t: 'note', parts: [t(c.status === 'unsupported'
      ? 'Excluded from supported grounds — {id}: {title}. A required qualification is unsupported; its opposite has not been adopted.'
      : 'Not available in this scenario — {id}: {title}. {reason}', { id: c.id, title: c.title, reason: blocked?.brokenReason ?? '' })] });
  });

  b.push({ t: 'h2', parts: [t('3. Next steps')] });
  b.push({ t: 'li', parts: [t('Complete the review and plan the response before the hearing of {date} ({days} days).', { date: fr(CASE.nextHearing), days })] });
  if (hypothetical) b.push({ t: 'note', parts: [t('Return to the saved analysis before adopting a position or preparing submissions.')] });
  else if (supported.length) b.push({ t: 'li', parts: [t('Prepare draft submissions only for the supported grounds, subject to final lawyer review.')] });
  if (analysis.chains.some((c) => c.id === 'C2' && c.status !== 'fails')) b.push({ t: 'li', parts: [t('Request records of any prior conciliation. A missing document does not establish that no conciliation occurred.')] });
  if (!hypothetical && supported.some((c) => c.id === 'C1')) b.push({ t: 'li', parts: [t('Produce the registry record and the order of caducité of 20/02/2026 as exhibits.')] });

  b.push({ t: 'h2', parts: [t('4. Saved lawyer reviews and follow-up')] });
  QUALIFICATIONS.forEach((q) => {
    const review = state.reviews[q.id];
    const decision = state.decisions[q.id] ?? 'unreviewed';
    b.push({ t: 'h3', parts: [t(q.question)] });
    b.push({ t: 'p', parts: [t('Proposed reading: {answer}. Review: {decision}.', { answer: t(q.proposed ? q.yes : q.no), decision: t(decisionLabels[decision]) })] });
    if (review?.note.trim()) b.push({ t: 'p', parts: [t('Review note: {note}', { note: review.note })] });
    if (review?.nextStep.trim()) b.push({ t: 'li', parts: [t('Next action: {action}', { action: review.nextStep })] });
  });
  b.push({ t: 'li', parts: [t('Replace the placeholder Cass. 2e civ. authority on caducité and interruption (C1).')] });
  b.push({ t: 'li', parts: [t('Check statutory excerpts against the current Légifrance versions (arts. 857, 122–126 CPC; arts. 2224–2243 C. civ.).')] });
  if (state.art642) b.push({ t: 'li', parts: [t('Confirm whether art. 642 CPC applies to the limitation period (affects 15/03 vs 16/03/2026).')] });
  return b;
}

export const toMd = (blocks: Block[], t: Translator = english) => blocks.map(({ t: kind, parts }) => {
  const text = parts.map((p) => (typeof p === 'string' ? p : `[${t(docById(p.doc).short)}]`)).join('');
  return { h1: `# ${text}`, h2: `\n## ${text}`, h3: `\n### ${text}`, p: text, li: `- ${text}`, note: `> ${text}` }[kind];
}).join('\n');
