import { useState, type ReactNode } from 'react';
import { CASE, qualById, type Anchor } from '../data/case';
import { DOCS, docById } from '../data/documents';
import { isContested, value, type Analysis, type AnalysisState } from '../engine/chains';
import { daysBetween, fr } from '../engine/dates';
import { REGIMES } from '../engine/regimes';
import { SourceChip } from './SourceChip';

type Part = string | Anchor;
type Block = { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; parts: Part[] };

const A = (doc: string, quote: string): Anchor => ({ doc, quote });

function buildMemo(analysis: Analysis, state: AnalysisState): Block[] {
  const b: Block[] = [];
  const days = daysBetween(CASE.asOf, CASE.nextHearing);
  const live = analysis.chains.filter((c) => c.status !== 'fails').sort((x, y) => x.hingesOn.length - y.hingesOn.length);
  const dead = analysis.chains.filter((c) => c.status === 'fails');

  b.push({ t: 'h1', parts: [`Defence memo — ${CASE.title}`] });
  b.push({ t: 'h2', parts: ['1. Case summary'] });
  b.push({ t: 'p', parts: [`We act for Bâtiself SARL, sued by Atelier Lumière SAS before the ${CASE.court} for payment of invoice F-2021-034 (${CASE.amount}) `, A('invoice', "Date d'échéance : 15/03/2021"),
    `. A first writ of ${fr(CASE.writ1.served)} lapsed `, A('order', "Constatons la caducité de l'assignation."),
    `. The claim is now brought by a second writ of ${fr(CASE.writ2.served)} `, A('writ2', "L'an deux mille vingt-six et le huit avril"), `, hearing on ${fr(CASE.nextHearing)}.`] });

  b.push({ t: 'h2', parts: ['2. Defences, in procedural order'] });
  b.push({ t: 'p', parts: ['No exception de procédure requiring to be raised in limine litis was identified. The grounds below are fins de non-recevoir: they may be raised at any stage (art. 123 CPC) without proof of prejudice (art. 124 CPC). We nevertheless recommend raising them in the first written submissions.'] });
  if (!live.length) b.push({ t: 'note', parts: ['In the current scenario, no ground holds among the enabled chains.'] });
  live.forEach((c, i) => {
    b.push({ t: 'h3', parts: [`Ground ${String.fromCharCode(65 + i)} — ${c.outcome}${live.length > 1 ? ' (independent of the other ground)' : ''}`] });
    c.links.forEach((l) => b.push({ t: 'li', parts: [`${l.title}: ${l.statement}${l.rule ? ` (${l.rule})` : ''} `, ...l.anchors] }));
    const reg = c.links.find((l) => l.kind === 'sanction' || l.kind === 'outcome')?.regime;
    if (reg) b.push({ t: 'p', parts: [`Regime: ${REGIMES[reg].name} — ${REGIMES[reg].when}; prejudice: ${REGIMES[reg].prejudice}; curable: ${REGIMES[reg].curable}.`] });
    c.hingesOn.forEach((qid) => {
      const q = qualById(qid);
      b.push({ t: 'note', parts: [`Weak link — ${q.question} Our position: ${value(state, qid) ? q.yes : q.no}. Expect the claimant to argue the opposite. ${q.reasoning}`] });
    });
  });
  dead.forEach((c) => {
    const br = c.links.find((l) => l.status === 'broken');
    b.push({ t: 'note', parts: [`Not available in this scenario — ${c.title}: breaks at “${br?.title}” (${br?.brokenReason}).`] });
  });

  b.push({ t: 'h2', parts: ['3. Next steps'] });
  b.push({ t: 'li', parts: [`Serve written submissions raising ${live.length > 1 ? 'both fins de non-recevoir' : live.length ? 'the fin de non-recevoir' : 'our defences'} before the hearing of ${fr(CASE.nextHearing)} (${days} days).`] });
  if (live.some((c) => c.id === 'C2')) b.push({ t: 'li', parts: ['Ask the claimant to produce any referral to a conciliator under art. 14; absent any, ground C2 is established.'] });
  if (live.some((c) => c.id === 'C1')) b.push({ t: 'li', parts: ['Produce the registry record and the order of caducité of 20/02/2026 as exhibits.'] });

  b.push({ t: 'h2', parts: ['4. Points for lawyer review'] });
  analysis.contestedQuals.forEach((qid) => b.push({ t: 'li', parts: [`AI-inferred, not yet confirmed: ${qualById(qid).question}`] }));
  b.push({ t: 'li', parts: ['Replace the placeholder Cass. 2e civ. authority on caducité and interruption (C1).'] });
  b.push({ t: 'li', parts: ['Check statutory excerpts against the current Légifrance versions (arts. 857, 122–126 CPC; arts. 2224–2243 C. civ.).'] });
  if (state.art642) b.push({ t: 'li', parts: ['Confirm whether art. 642 CPC applies to the limitation period (affects 15/03 vs 16/03/2026).'] });
  return b;
}

const toMd = (blocks: Block[]) => blocks.map(({ t, parts }) => {
  const text = parts.map((p) => (typeof p === 'string' ? p : `[${docById(p.doc).short}]`)).join('');
  return { h1: `# ${text}`, h2: `\n## ${text}`, h3: `\n### ${text}`, p: text, li: `- ${text}`, note: `> ${text}` }[t];
}).join('\n');

export function Memo({ analysis, state, onAnchor }: { analysis: Analysis; state: AnalysisState; onAnchor: (a: Anchor) => void }) {
  const blocks = buildMemo(analysis, state);
  const [copied, setCopied] = useState(false);
  const cited = [...new Set(blocks.flatMap((x) => x.parts.filter((p): p is Anchor => typeof p !== 'string').map((p) => p.doc)))];
  const render = (parts: Part[]): ReactNode[] => parts.map((p, i) => (typeof p === 'string' ? p : <SourceChip key={i} anchor={p} onAnchor={onAnchor} />));
  const pending = analysis.contestedQuals.filter((q) => isContested(state, q)).length;

  return (
    <div className="memo">
      <div className="memo-bar">
        <span className="ai-tag">Draft</span>
        <span className="muted small">Generated from the confirmed analysis{pending ? ` · ${pending} qualification(s) still provisional` : ''}. In production the prose is drafted by Mistral, restricted to cited sources.</span>
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(toMd(blocks)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy Markdown'}</button>
      </div>
      <article className="memo-doc">
        {blocks.map((x, i) => {
          const c = render(x.parts);
          if (x.t === 'h1') return <h1 key={i}>{c}</h1>;
          if (x.t === 'h2') return <h2 key={i}>{c}</h2>;
          if (x.t === 'h3') return <h3 key={i}>{c}</h3>;
          if (x.t === 'li') return <p key={i} className="li">{c}</p>;
          if (x.t === 'note') return <p key={i} className="note">{c}</p>;
          return <p key={i}>{c}</p>;
        })}
        <h2>5. Sources</h2>
        {cited.map((d) => <p key={d} className="li">{docById(d).title}{docById(d).provenance === 'mock' && docById(d).group !== 'case' ? ' — mock, to replace' : ''}</p>)}
        <p className="muted small">{DOCS.length} documents in the file.</p>
      </article>
    </div>
  );
}
