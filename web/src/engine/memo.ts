import { CASE, qualById, type Anchor } from '../data/case';
import { docById } from '../data/documents';
import { value, type Analysis, type AnalysisState } from './chains';
import { daysBetween, fr } from './dates';
import { REGIMES } from './regimes';
import { english, type Translator } from '../i18n/translate';

export type Part = string | Anchor;
type Block = { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; parts: Part[] };

const A = (doc: string, quote: string): Anchor => ({ doc, quote });

export function buildMemo(analysis: Analysis, state: AnalysisState, t: Translator = english): Block[] {
  const b: Block[] = [];
  const days = daysBetween(CASE.asOf, CASE.nextHearing);
  const live = analysis.chains.filter((c) => c.status !== 'fails').sort((x, y) => x.hingesOn.length - y.hingesOn.length);
  const dead = analysis.chains.filter((c) => c.status === 'fails');

  b.push({ t: 'h1', parts: [t('Defence memo — {title}', { title: t(CASE.title) })] });
  b.push({ t: 'h2', parts: [t('1. Case summary')] });
  b.push({ t: 'p', parts: [t('We act for Bâtiself SARL, sued by Atelier Lumière SAS before the {court} for payment of invoice F-2021-034 ({amount}) ', { court: CASE.court, amount: CASE.amount }), A('invoice', "Date d'échéance : 15/03/2021"),
    t('. A first writ of {date} lapsed ', { date: fr(CASE.writ1.served) }), A('order', "Constatons la caducité de l'assignation."),
    t('. The claim is now brought by a second writ of {date} ', { date: fr(CASE.writ2.served) }), A('writ2', "L'an deux mille vingt-six et le huit avril"), t(', hearing on {date}.', { date: fr(CASE.nextHearing) })] });

  b.push({ t: 'h2', parts: [t('2. Defences, in procedural order')] });
  b.push({ t: 'p', parts: [t('No exception de procédure requiring to be raised in limine litis was identified. The grounds below are fins de non-recevoir: they may be raised at any stage (art. 123 CPC) without proof of prejudice (art. 124 CPC). We nevertheless recommend raising them in the first written submissions.')] });
  if (!live.length) b.push({ t: 'note', parts: [t('In the current scenario, no ground holds among the enabled chains.')] });
  live.forEach((c, i) => {
    b.push({ t: 'h3', parts: [t('Ground {letter} — {outcome}{independent}', { letter: String.fromCharCode(65 + i), outcome: c.outcome, independent: live.length > 1 ? t(' (independent of the other ground)') : '' })] });
    c.links.forEach((l) => b.push({ t: 'li', parts: [`${l.title}: ${l.statement}${l.rule ? ` (${l.rule})` : ''} `, ...l.anchors] }));
    const reg = c.links.find((l) => l.kind === 'sanction' || l.kind === 'outcome')?.regime;
    if (reg) b.push({ t: 'p', parts: [t('Regime: {name} — {when}; prejudice: {prejudice}; curable: {curable}.', { name: t(REGIMES[reg].name), when: t(REGIMES[reg].when), prejudice: t(REGIMES[reg].prejudice), curable: t(REGIMES[reg].curable) })] });
    c.hingesOn.forEach((qid) => {
      const q = qualById(qid);
      b.push({ t: 'note', parts: [t('Weak link — {question} Our position: {answer}. Expect the claimant to argue the opposite. {reasoning}', { question: t(q.question), answer: t(value(state, qid) ? q.yes : q.no), reasoning: t(q.reasoning) })] });
    });
  });
  dead.forEach((c) => {
    const br = c.links.find((l) => l.status === 'broken');
    b.push({ t: 'note', parts: [t('Not available in this scenario — {title}: breaks at “{link}” ({reason}).', { title: c.title, link: br?.title ?? '', reason: br?.brokenReason ?? '' })] });
  });

  b.push({ t: 'h2', parts: [t('3. Next steps')] });
  b.push({ t: 'li', parts: [t('Serve written submissions raising {defences} before the hearing of {date} ({days} days).', { defences: t(live.length > 1 ? 'both fins de non-recevoir' : live.length ? 'the fin de non-recevoir' : 'our defences'), date: fr(CASE.nextHearing), days })] });
  if (live.some((c) => c.id === 'C2')) b.push({ t: 'li', parts: [t('Ask the claimant to produce any referral to a conciliator under art. 14; absent any, ground C2 is established.')] });
  if (live.some((c) => c.id === 'C1')) b.push({ t: 'li', parts: [t('Produce the registry record and the order of caducité of 20/02/2026 as exhibits.')] });

  b.push({ t: 'h2', parts: [t('4. Points for lawyer review')] });
  analysis.contestedQuals.forEach((qid) => b.push({ t: 'li', parts: [t('AI-inferred, not yet confirmed: {question}', { question: t(qualById(qid).question) })] }));
  b.push({ t: 'li', parts: [t('Replace the placeholder Cass. 2e civ. authority on caducité and interruption (C1).')] });
  b.push({ t: 'li', parts: [t('Check statutory excerpts against the current Légifrance versions (arts. 857, 122–126 CPC; arts. 2224–2243 C. civ.).')] });
  if (state.art642) b.push({ t: 'li', parts: [t('Confirm whether art. 642 CPC applies to the limitation period (affects 15/03 vs 16/03/2026).')] });
  return b;
}

export const toMd = (blocks: Block[], t: Translator = english) => blocks.map(({ t: kind, parts }) => {
  const text = parts.map((p) => (typeof p === 'string' ? p : `[${t(docById(p.doc).short)}]`)).join('');
  return { h1: `# ${text}`, h2: `\n## ${text}`, h3: `\n### ${text}`, p: text, li: `- ${text}`, note: `> ${text}` }[kind];
}).join('\n');
