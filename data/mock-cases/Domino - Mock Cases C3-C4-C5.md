# Domino — Three New Mock Cases (C3, C4, C5)

> Companion to PRD §11 (Atelier Lumière v. Bâtiself, chains C1–C2). All parties, dates, documents and exhibits below are entirely fictitious and created for demo/testing purposes only. Legal references must be checked by a lawyer on the team before use in the live demo.

## Overview

Each case below follows the same structure as the existing synthetic case file: a one-line scenario, a table of synthetic documents with dates and purpose, the expected deterministic-engine result, and the links in the chain with their rule references. The three cases exercise chains **C3** (insolvency), **C4** (order of procedural objections) and **C5** (appeal lapse) from the chain library in the PRD, which the existing web app does not yet implement (only C1 and C2 are wired into `web/src/engine/chains.ts`).

## Case C3 — Créations Verrières SAS v. Fonderie Ardennaise SARL (insolvency / forclusion)

### Scenario

Commercial dispute between merchants. We act for the defendant, Fonderie Ardennaise SARL, which was placed into *redressement judiciaire* before the claimant, Créations Verrières SAS, sued for payment of an unpaid supply invoice. Fonderie Ardennaise never received a claim declaration from Créations Verrières within the statutory period. Court seised: Tribunal de commerce de Charleville-Mézières. Demo as-of date: 4 October 2026.

### Synthetic documents

| # | Document | Date | Purpose |
|---|---|---|---|
| 1 | Supply contract between Créations Verrières (supplier) and Fonderie Ardennaise (buyer) | 2019-03-12 | Regime: between merchants — 5-year limitation (art. L110-4 C. com.) |
| 2 | Invoice F-2024-211, €42,600, due | 2024-09-05 | Pre-existing debt — arose well before the opening judgment |
| 3 | *Jugement d'ouverture* — Tribunal de commerce de Charleville-Mézières places Fonderie Ardennaise into *redressement judiciaire* | 2025-11-10 | Triggers the stay on individual payment actions (art. L622-21 C. com.) and the declaration regime |
| 4 | BODACC notice publishing the *jugement d'ouverture* | 2025-11-20 | Starts the 2-month declaration clock (art. R622-24 C. com.) |
| 5 | List of known creditors prepared by the debtor (*bordereau*, art. L622-6 C. com.) — Créations Verrières is on the list | 2025-11-25 | Shows the debtor did not omit the creditor — relevant to the *relevé-de-forclusion* counterfactual |
| 6 | No claim declaration from Créations Verrières on file with the *mandataire judiciaire* as of the 2-month deadline | 2026-01-20 | C3 breach — deadline expired with no declaration on file |
| 7 | Writ before the Tribunal de commerce de Charleville-Mézières, Créations Verrières v. Fonderie Ardennaise, seeking payment of invoice F-2024-211 | 2026-02-02 | New action for payment of a pre-existing debt, filed after the opening judgment and without a claim declaration — the fact the chain turns on |
| 8 | Email from Créations Verrières' in-house counsel: "we only learned of the *redressement* after receiving the writ reply" | 2026-02-18 | Contested fact (AI-inferred, medium confidence): whether Créations Verrières was genuinely unable to know of the proceedings, relevant to the knowledge-based exception for *relevé de forclusion* |
| 9 | No application for *relevé de forclusion* on file | — | As of the demo as-of date, no relief application has been made |

### Expected engine result

**C3 holds**: the invoice is a pre-existing debt within the meaning of art. L622-21 C. com.; the opening judgment of 10 November 2025 bars a new action for payment; Créations Verrières did not declare the claim within the 2-month period running from BODACC publication on 20 November 2025 (expiring 20 January 2026); the writ of 2 February 2026 is a new action filed after both the opening judgment and the declaration deadline. The claim is **inopposable** to the collective proceedings — not extinguished — under art. L622-26 C. com.

**Counterfactual on #5/#8:** Créations Verrières appears on the debtor's own creditor list (#5), which weakens any argument that the debtor omitted it — one of the two statutory grounds for *relevé de forclusion*. If Créations Verrières could show it was genuinely unable to know of its own claim or the proceedings before the 6-month relief deadline (20 May 2026), the judge-commissioner could still relieve it from forfeiture; on the current record (#5 showing it was listed, and #8 only asserting the writ reply as the trigger of knowledge) this ground looks weak and is flagged contested, medium confidence.

**Banner:** 1 ground (inopposabilité of the claim) · 1 contested link (*relevé de forclusion* prospects). The 6-month relief deadline is in 7 months from the demo as-of date.

### Chain C3 — links

1. **Fact** — Invoice F-2024-211 (€42,600) due 2024-09-05, a pre-existing claim against Fonderie Ardennaise.
2. **Requirement** — The *jugement d'ouverture* of 10 November 2025 interrupts or prohibits new actions seeking payment of pre-existing debts and stays enforcement (art. L622-21 C. com.; applied to *redressement judiciaire* via art. L631-14 C. com.).
3. **Breach** — Créations Verrières filed no claim declaration with the *mandataire judiciaire* within 2 months of BODACC publication on 20 November 2025 (deadline 20 January 2026) (arts. L622-24, R622-24 C. com.).
4. **Sanction** — Forclusion: absent a declaration (or a *relevé de forclusion*), the creditor is not admitted to distributions (art. L622-26 C. com.).
5. **Lost effect** — The claim is inopposable to the collective proceedings during and, in the circumstances stated by art. L622-26, after performance of any plan — it is not extinguished as between the parties, but it cannot be asserted against the proceedings or included in distributions.
6. **Consequence** — The new payment action (writ of 2 February 2026) filed after the opening judgment, without a prior declaration, is inadmissible; the claimant must proceed through the declaration/forclusion-relief route rather than ordinary litigation.
7. **Outcome (defence)** — Inadmissibility / inopposability of the claim to the collective proceedings, unless and until the judge-commissioner grants *relevé de forclusion* on an application filed within 6 months of BODACC publication (20 May 2026), art. L622-26 C. com.

### Regime notes for C3

**Raised:** by the debtor/*mandataire* or the judge; the stay and declaration requirement are public-order provisions. **Curable:** yes, via *relevé de forclusion* within 6 months of BODACC publication (longer only if the creditor proves it could not have known of the debt/proceedings before the 6-month period expired — this is no longer an automatic 1-year extension after Ordinance 2014-326, but a knowledge-based postponement). **Effect:** inopposability to the proceedings, not extinction of the debt.

## Case C4 — M. Antoine Rigal v. MobiPlus Distribution SAS (order of procedural objections)

### Scenario

B2C dispute. We act for the defendant, M. Antoine Rigal, a consumer domiciled in Nantes, sued by MobiPlus Distribution SAS (an online electronics retailer) before the Tribunal judiciaire de Paris pursuant to a jurisdiction clause in its general terms designating the courts of Paris. M. Rigal's counsel filed submissions contesting the merits of the claim (disputing that the goods were defective) before later raising an objection of lack of territorial jurisdiction. Demo as-of date: 4 October 2026.

### Synthetic documents

| # | Document | Date | Purpose |
|---|---|---|---|
| 1 | MobiPlus general terms and conditions of sale, art. 22: *"Tout litige relatif à l'exécution des présentes sera porté devant les tribunaux de Paris"* | 2025-01-01 (in force when the contract was concluded) | C4 trigger: territorial jurisdiction clause in a consumer contract — presumptively deemed unwritten under art. 48 CPC absent an exception for merchants |
| 2 | Online order confirmation — M. Rigal, consumer, domiciled 14 rue de la Fosse, Nantes | 2025-09-02 | Establishes the consumer's domicile for territorial jurisdiction purposes (art. 42 CPC; art. R631-3 C. conso.) |
| 3 | Writ before the Tribunal judiciaire de Paris, MobiPlus v. Rigal, for payment of the balance of the purchase price | 2025-12-05 | Filed in the forum named by the clause rather than at the consumer's domicile |
| 4 | M. Rigal's first *conclusions*: deny that the price balance is owed and argue the goods were defective and validly rejected | 2026-01-15 | Breach: genuine defence on the merits filed first, with no mention of jurisdiction |
| 5 | M. Rigal's second *conclusions*, filed after a change of counsel, raising for the first time an *exception d'incompétence territoriale* and asking that the case be sent to the Tribunal judiciaire de Nantes | 2026-03-01 | The objection, though well-founded on the clause, comes after the merits defence — the fact the chain turns on |
| 6 | MobiPlus reply brief invoking art. 74 CPC and the chronology of M. Rigal's submissions | 2026-04-10 | MobiPlus's own procedural defence to the late objection |
| 7 | Case-management order noting the objection was raised in the second set of *conclusions* | 2026-04-20 | Confirms the sequencing of submissions is undisputed |

### Expected engine result

**C4 holds** (against the consumer's objection, i.e. the objection fails and the Paris court retains the case at this procedural stage): art. 48 CPC renders the Paris jurisdiction clause unwritten as against a consumer and M. Rigal had a sound substantive basis to contest territorial jurisdiction, but art. 74 CPC requires a procedural objection to be raised simultaneously with and before any defence on the merits, on pain of inadmissibility — a rule that applies even where the underlying ground is of public policy. Because M. Rigal's first *conclusions* of 15 January 2026 argued the merits (disputing the defect and the price balance) without raising jurisdiction, the later objection of 1 March 2026 is inadmissible. The outcome does not validate the clause; it only forfeits the party-raised objection.

**Counterfactual on #4:** had M. Rigal's first *conclusions* raised the territorial objection — reasoned, naming the Tribunal judiciaire de Nantes under art. 75 CPC — before pleading the merits only in the alternative ("à titre subsidiaire"), the objection would have been timely and the chain would break (case sent to Nantes).

**Residual counterfactual:** even with the objection inadmissible, the court retains a residual power under art. R632-1 C. conso. to exclude an abusive or legally ineffective clause of its own motion after hearing the parties; this is a different procedural act from granting a late party-raised exception and does not by itself transfer the case, but it may affect how the court treats the clause on the merits of any argument MobiPlus makes about forum.

**Banner:** Procedural objection inadmissible — case remains before the Tribunal judiciaire de Paris · 1 contested residual point (art. R632-1 own-motion review).

### Chain C4 — links

1. **Fact** — Art. 22 of MobiPlus's general terms designates the courts of Paris for any dispute relating to performance of the contract.
2. **Requirement** — A clause directly or indirectly derogating from the statutory rules of territorial jurisdiction is deemed unwritten unless agreed between parties all contracting as merchants and set out in a particularly apparent manner (art. 48 CPC); a consumer may in any event seise the court of the place where it lived when the contract was concluded (art. R631-3 C. conso.).
3. **Breach** — M. Rigal's *conclusions* of 15 January 2026 argued the merits (denying the debt, asserting the defect) without raising any procedural objection.
4. **Sanction** — Procedural objections, including an *exception d'incompétence*, must be raised simultaneously with and before any defence on the merits, on pain of inadmissibility — even where the underlying rule is public policy (art. 74 CPC); an *exception d'incompétence* must also designate the court sought (art. 75 CPC).
5. **Lost effect** — The objection raised on 1 March 2026, after the merits defence, is inadmissible regardless of the merits of the jurisdiction argument.
6. **Consequence** — The Tribunal judiciaire de Paris is not dispossessed of the case on the objection as raised; whether the clause is independently disregarded is a separate question for the court's own-motion powers under art. R632-1 C. conso.
7. **Outcome** — The territorial-jurisdiction defence is procedurally lost (forfeited by the order of submissions), not substantively vindicated for MobiPlus.

### Regime notes for C4

**Raised:** by the party, before any merits defence, art. 74 CPC; the timing rule applies even to public-policy jurisdictional rules. **Prejudice:** not required to establish the objection, but irrelevant once art. 74 bars it procedurally. **Curable:** no — the strict case law (Cass. 2e civ., 10 June 2021, no. 20-14.812; Cass. 2e civ., 12 May 2016, no. 14-28.086) treats the order of submissions in the single proceeding as decisive. **Raised of the judge's own motion:** territorial lack of jurisdiction can be raised *sua sponte* only in limited cases (personal status, exclusive jurisdiction of another court, non-appearing defendant — art. 77 CPC); separately, the consumer-law judge may exclude an abusive clause of its own motion after hearing the parties (art. R632-1 C. conso.).

## Case C5 — Trans-Alpine Logistique SAS v. Minoterie du Verdon SA (appeal lapse)

### Scenario

Commercial dispute on appeal. We act for the respondent, Minoterie du Verdon SA, which won at first instance before the Tribunal de commerce de Grenoble. The claimant at first instance, Trans-Alpine Logistique SAS, appealed but its counsel failed to file the appellant's submissions within the statutory three-month period, so the notice of appeal lapsed. Court seised: Cour d'appel de Grenoble. Demo as-of date: 4 October 2026.

### Synthetic documents

| # | Document | Date | Purpose |
|---|---|---|---|
| 1 | First-instance judgment, Tribunal de commerce de Grenoble, dismissing Trans-Alpine's claim for carriage charges | 2025-07-01 | Judgment under appeal |
| 2 | Bailiff's certificate of *signification* of the judgment on Trans-Alpine | 2025-07-08 | Starts the 1-month ordinary appeal period (art. 538 CPC) — expires 8 August 2025 |
| 3 | *Déclaration d'appel* filed by Trans-Alpine (ordinary procedure with mandatory representation, not *bref délai*) | 2025-08-01 | Timely — within the appeal period; starts the art. 908 CPC 3-month clock for appellant's submissions (deadline 1 November 2025) |
| 4 | Internal email, Trans-Alpine's counsel to the client: "we are still waiting on the expert report before finalising our submissions" | 2025-10-20 | Shows awareness of the approaching deadline — relevant to whether any force majeure excuse under art. 911 CPC could apply |
| 5 | Trans-Alpine's appellant's *conclusions*, remitted to the registry | 2025-11-20 | Breach: filed 19 days after the 1 November 2025 deadline under art. 908 CPC |
| 6 | Order of the *conseiller de la mise en état* recording the *caducité* of the declaration of appeal, raised of his own motion, after inviting the parties' observations | 2025-12-15 | Sanction — art. 908 and 911 CPC |
| 7 | Minoterie du Verdon's letter noting it filed no incidental appeal and that the appeal period for a principal appeal had already expired by the time of the *caducité* order | 2026-01-10 | Confirms no incidental appeal survives under art. 550 CPC and no fresh appeal is available (original appeal period long expired) |

### Expected engine result

**C5 holds**: the notice of appeal of 1 August 2025 was timely, but Trans-Alpine's appellant's *conclusions* of 20 November 2025 were filed 19 days after the art. 908 CPC three-month deadline (1 November 2025, running from the declaration of appeal). The *conseiller de la mise en état* correctly raised the *caducité* of the declaration of appeal of his own motion on 15 December 2025 (arts. 908, 911 CPC). Because Minoterie du Verdon filed no incidental appeal within the time available for a principal appeal (art. 550 CPC, as applied in Cass. 2e civ., 1 October 2020, no. 19-10.726) and the original one-month appeal period (expired 8 August 2025) is long past, the first-instance judgment of 1 July 2025 is final: Trans-Alpine cannot revive the appeal.

**Counterfactual on #4:** the internal email shows the delay was a matter of litigation strategy (awaiting an expert report), not an external and unavoidable circumstance. If Trans-Alpine could instead show a genuine force majeure — a circumstance not attributable to it and insurmountable for it — the *conseiller de la mise en état* could disapply the art. 908 sanction under art. 911 CPC and the chain would break. On the current record this ground is weak.

**Banner:** 1 ground (first-instance judgment final) · 1 contested link (force majeure excuse, currently weak).

### Chain C5 — links

1. **Fact** — *Déclaration d'appel* filed 1 August 2025, within the one-month period following *signification* of the judgment on 8 July 2025 (art. 538 CPC).
2. **Requirement** — In ordinary proceedings with mandatory representation (outside the *bref délai* track), the appellant must remit its submissions to the registry within three months of the declaration of appeal, on pain of *caducité* raised of the court's own motion (art. 908 CPC).
3. **Breach** — Appellant's *conclusions* remitted 20 November 2025, 19 days after the 1 November 2025 deadline.
4. **Sanction** — *Caducité de la déclaration d'appel*, pronounced by order of the *conseiller de la mise en état* after inviting the parties' observations (arts. 908, 911 CPC); the order has the authority of *chose jugée* on that procedural dispute.
5. **Lost effect** — The appeal instance is terminated and the Cour d'appel de Grenoble is *dessaisie* of Trans-Alpine's appeal; a properly filed incidental appeal could in principle survive if filed within the time available for a principal appeal (art. 550 CPC), but none was filed here.
6. **Consequence** — With no valid appeal (principal or incidental) remaining and the original one-month appeal period (expired 8 August 2025) long past, there is no route back to a live appeal.
7. **Outcome** — The first-instance judgment of 1 July 2025 is final and enforceable as between the parties.

### Regime notes for C5

**Raised:** of the court's own motion, by the *conseiller de la mise en état* (art. 908, 911 CPC) — note this is the post-1 September 2024 numbering; the appellant's three-month deadline remained at art. 908 CPC through the 2023 reform, which mainly restructured the *bref délai* track (now arts. 906 to 906-5, with the appellant's submissions deadline at art. 906-2 CPC, not art. 905-2). **Curable:** not by late filing; only a qualifying force majeure under art. 911 CPC (not the "cause grave" of art. 912 CPC, which concerns calendar deadlines) can excuse it, and only before the order is made since an order pronouncing *caducité* cannot be withdrawn (art. 911 CPC). **Effect:** termination of the appeal instance; the first-instance judgment is restored to practical finality once no appeal period or valid appeal remains.

## Appendix — Structured data sketches (for `web/src/data` and `web/src/engine`)

The blocks below are written in the same TypeScript shape as the existing `web/src/data/case.ts`, `web/src/engine/chains.ts` and `web/src/engine/regimes.ts` so a developer can turn them into new fixture files (e.g. `data/caseC3.ts`, `engine/chainsC3.ts`) without redesigning the data model. They are illustrative sketches, not drop-in compiled code — field values should be reviewed against the final wording of the synthetic documents above.

### C3 — Facts and qualifications (`case.ts` shape)

```ts
export const CASE_C3 = {
  title: 'Créations Verrières SAS v. Fonderie Ardennaise SARL',
  court: 'Tribunal de commerce de Charleville-Mézières',
  side: 'Defendant (Fonderie Ardennaise SARL)',
  amount: '42 600 €',
  relationship: 'Between merchants — 5-year limitation (art. L110-4 C. com.)',
  asOf: '2026-10-04',
  openingJudgment: '2025-11-10',
  bodacc: '2025-11-20',
  declarationDeadline: '2026-01-20',
  reliefDeadline: '2026-05-20',
  secondSuit: '2026-02-02',
};

export const FACTS_C3: Fact[] = [
  { id: 'g1', date: '2024-09-05', doc: 'invoice', kind: 'Invoice', summary: 'Invoice F-2024-211 (42 600 €) falls due — pre-existing debt',
    anchors: [{ doc: 'invoice', quote: "Date d'échéance : 05/09/2024" }] },
  { id: 'g2', date: '2025-11-10', doc: 'jugement', kind: 'Court order', summary: "Jugement d'ouverture places Fonderie Ardennaise into redressement judiciaire",
    anchors: [{ doc: 'jugement', quote: 'Ouvre une procédure de redressement judiciaire' }] },
  { id: 'g3', date: '2025-11-20', doc: 'bodacc', kind: 'Registry', summary: 'BODACC publication of the opening judgment',
    anchors: [{ doc: 'bodacc', quote: 'Jugement du 10 novembre 2025' }] },
  { id: 'g4', date: '2025-11-25', doc: 'bordereau', kind: 'Exhibits', summary: "Debtor's creditor list includes Créations Verrières",
    anchors: [{ doc: 'bordereau', quote: 'Créations Verrières SAS — 42 600 €' }], qualification: 'q-listed' },
  { id: 'g5', date: '2026-01-20', doc: 'mandataire', kind: 'Registry', summary: 'No declaration on file as of the 2-month deadline',
    anchors: [{ doc: 'mandataire', quote: 'Aucune déclaration reçue' }], qualification: 'q-declared' },
  { id: 'g6', date: '2026-02-02', doc: 'writ', kind: 'Writ', summary: 'New writ for payment filed after the opening judgment, without a declaration',
    anchors: [{ doc: 'writ', quote: 'paiement de la facture F-2024-211' }] },
  { id: 'g7', date: '2026-02-18', doc: 'email', kind: 'Email', summary: 'Claimant counsel: only learned of the redressement after the writ reply',
    anchors: [{ doc: 'email', quote: 'nous avons appris la procédure collective' }], qualification: 'q-knowledge' },
];

export const QUALIFICATIONS_C3: Qualification[] = [
  { id: 'q-listed', factId: 'g4', question: "Was the creditor omitted from the debtor's list (art. L622-6 C. com.)?",
    proposed: false, yes: 'Omitted — supports relief', no: 'Listed — weakens relief',
    source: 'rule', confidence: 'high', rule: 'art. L622-26 C. com.',
    reasoning: 'The bordereau lists Créations Verrières by name and amount; it was not omitted by the debtor.',
    whatIfLabel: 'The creditor was in fact omitted from the list' },
  { id: 'q-declared', factId: 'g5', question: 'Was a claim declared within 2 months of BODACC publication?',
    proposed: false, yes: 'Declared in time', no: 'No declaration on file',
    source: 'rule', confidence: 'high', rule: 'arts. L622-24, R622-24 C. com.',
    reasoning: "The mandataire's register shows nothing received by the 20 January 2026 deadline.",
    whatIfLabel: 'A declaration was in fact filed in time' },
  { id: 'q-knowledge', factId: 'g7', question: 'Was the creditor genuinely unable to know of the proceedings before the 6-month relief deadline?',
    proposed: false, yes: 'Unable to know — relief available', no: 'Could have known — relief unlikely',
    source: 'ai_inferred', confidence: 'medium', rule: 'art. L622-26 C. com. (knowledge-based exception)',
    reasoning: 'The creditor was listed by the debtor and is a sophisticated commercial party; the email only asserts subjective ignorance without explaining why BODACC publication or the list would not have reached it.',
    whatIfLabel: 'The creditor proves it could not have known of the proceedings' },
];
```

### C3 — Chain sketch (`chains.ts` shape)

```ts
function c3(ctx: Ctx): LinkDef[] {
  return [
    { id: 'c3-fact', kind: 'fact', title: 'Pre-existing debt', statement: 'Invoice F-2024-211 (42 600 €) due 05/09/2024',
      anchors: [/* ... */], deps: [], holds: true },
    { id: 'c3-req', kind: 'requirement', title: 'Stay on payment actions', statement: 'Opening judgment of 10/11/2025 bars new payment actions',
      rule: 'art. L622-21 C. com. (via art. L631-14)', anchors: [/* ... */], deps: [], holds: true },
    { id: 'c3-breach', kind: 'breach', title: 'No declaration filed', statement: 'No claim declared by the 20/01/2026 deadline (2 months from BODACC)',
      rule: 'arts. L622-24, R622-24 C. com.', deps: ['q-declared'], holds: !ctx.v('q-declared') },
    { id: 'c3-sanction', kind: 'sanction', title: 'Forclusion', statement: 'Creditor excluded from distributions absent relief',
      rule: 'art. L622-26 C. com.', deps: [], holds: true },
    { id: 'c3-lost', kind: 'lost_effect', title: 'Inopposabilité', statement: 'Claim inopposable to the proceedings — not extinguished',
      rule: 'art. L622-26 C. com.', deps: [], holds: true },
    { id: 'c3-cons', kind: 'consequence', title: 'New suit inadmissible', statement: 'Writ of 02/02/2026 filed after opening and without declaration',
      deps: [], holds: true },
    { id: 'c3-out', kind: 'outcome', title: 'Inopposability / inadmissibility',
      statement: 'Claim inopposable unless relevé de forclusion granted within 6 months of BODACC (20/05/2026)',
      rule: 'art. L622-26 C. com.', deps: ['q-listed', 'q-knowledge'], holds: true },
  ];
}
```

### C4 — Facts, qualifications and chain sketch

```ts
export const CASE_C4 = {
  title: 'M. Antoine Rigal v. MobiPlus Distribution SAS',
  court: 'Tribunal judiciaire de Paris',
  side: 'Defendant (M. Antoine Rigal, consumer)',
  amount: 'n/a (jurisdiction dispute)',
  relationship: 'B2C — consumer contract',
  asOf: '2026-10-04',
  writFiled: '2025-12-05',
  firstConclusions: '2026-01-15',
  objectionRaised: '2026-03-01',
};

export const FACTS_C4: Fact[] = [
  { id: 'h1', date: '2025-01-01', doc: 'cgv', kind: 'Contract', summary: 'Art. 22 CGV designates the courts of Paris for any dispute',
    anchors: [{ doc: 'cgv', quote: 'sera porté devant les tribunaux de Paris' }], qualification: 'q-clause-void' },
  { id: 'h2', date: '2025-09-02', doc: 'order', kind: 'Order confirmation', summary: 'Consumer domiciled in Nantes at the time of contracting',
    anchors: [{ doc: 'order', quote: '14 rue de la Fosse, Nantes' }] },
  { id: 'h3', date: '2025-12-05', doc: 'writ', kind: 'Writ', summary: 'MobiPlus sues in Paris per the clause',
    anchors: [{ doc: 'writ', quote: 'Tribunal judiciaire de Paris' }] },
  { id: 'h4', date: '2026-01-15', doc: 'conclusions1', kind: 'Submissions', summary: "Rigal's first conclusions argue the merits only (denies the defect claim)",
    anchors: [{ doc: 'conclusions1', quote: 'conteste le bien-fondé de la demande' }], qualification: 'q-merits-first' },
  { id: 'h5', date: '2026-03-01', doc: 'conclusions2', kind: 'Submissions', summary: "Second conclusions raise exception d'incompétence territoriale, naming Nantes",
    anchors: [{ doc: 'conclusions2', quote: "exception d'incompétence territoriale" }] },
];

export const QUALIFICATIONS_C4: Qualification[] = [
  { id: 'q-clause-void', factId: 'h1', question: 'Is the art. 22 jurisdiction clause deemed unwritten as against a consumer?',
    proposed: true, yes: 'Unwritten — ineffective against the consumer', no: 'Valid clause',
    source: 'rule', confidence: 'high', rule: 'art. 48 CPC; art. R631-3 C. conso.',
    reasoning: "The clause derogates from the consumer's domicile-based venue and was not agreed between merchants.",
    whatIfLabel: 'The clause is valid (e.g. B2B exception applies)' },
  { id: 'q-merits-first', factId: 'h4', question: 'Did the defendant argue the merits before raising the jurisdiction objection?',
    proposed: true, yes: 'Merits argued first — objection later inadmissible', no: 'Objection raised first',
    source: 'rule', confidence: 'high', rule: 'art. 74 CPC',
    reasoning: 'The first conclusions of 15/01/2026 dispute the debt and the defect without mentioning jurisdiction; the objection appears only in the second conclusions of 01/03/2026.',
    whatIfLabel: 'The objection was in fact raised in the first conclusions, in the alternative' },
];

function c4(ctx: Ctx): LinkDef[] {
  return [
    { id: 'c4-fact', kind: 'fact', title: 'Jurisdiction clause', statement: 'Art. 22 CGV names the Paris courts',
      anchors: [/* ... */], deps: [], holds: true },
    { id: 'c4-req', kind: 'requirement', title: 'Clause unwritten', statement: 'Clause ineffective against a consumer',
      rule: 'art. 48 CPC; art. R631-3 C. conso.', deps: ['q-clause-void'], holds: ctx.v('q-clause-void') },
    { id: 'c4-breach', kind: 'breach', title: 'Merits argued first', statement: 'First conclusions (15/01/2026) argued the merits only',
      deps: ['q-merits-first'], holds: ctx.v('q-merits-first') },
    { id: 'c4-sanction', kind: 'sanction', title: 'Objection inadmissible', statement: 'Exception raised 01/03/2026 comes after the merits defence',
      rule: 'art. 74 CPC', deps: [], holds: true },
    { id: 'c4-lost', kind: 'lost_effect', title: 'Forfeited, not cured', statement: 'Timing bar applies even to public-policy jurisdiction rules',
      rule: 'art. 74 CPC', deps: [], holds: true },
    { id: 'c4-cons', kind: 'consequence', title: 'Paris retains the case', statement: 'No transfer to Nantes on this objection',
      deps: [], holds: true },
    { id: 'c4-out', kind: 'outcome', title: 'Objection lost', statement: 'Residual own-motion review only under art. R632-1 C. conso.',
      deps: [], holds: true },
  ];
}
```

### C5 — Facts, qualifications and chain sketch

```ts
export const CASE_C5 = {
  title: "Trans-Alpine Logistique SAS v. Minoterie du Verdon SA",
  court: "Cour d'appel de Grenoble",
  side: 'Respondent (Minoterie du Verdon SA)',
  asOf: '2026-10-04',
  judgment: '2025-07-01',
  signification: '2025-07-08',
  appealDeadline: '2025-08-08',
  noticeOfAppeal: '2025-08-01',
  art908Deadline: '2025-11-01',
  conclusionsFiled: '2025-11-20',
  caduciteOrder: '2025-12-15',
};

export const FACTS_C5: Fact[] = [
  { id: 'k1', date: '2025-07-01', doc: 'judgment', kind: 'Court order', summary: "First-instance judgment dismisses Trans-Alpine's claim",
    anchors: [{ doc: 'judgment', quote: 'déboute la société Trans-Alpine Logistique' }] },
  { id: 'k2', date: '2025-07-08', doc: 'signification', kind: 'Bailiff act', summary: 'Judgment signified on Trans-Alpine — starts the 1-month appeal period',
    anchors: [{ doc: 'signification', quote: 'signifié le 08 juillet 2025' }] },
  { id: 'k3', date: '2025-08-01', doc: 'declaration', kind: 'Notice of appeal', summary: "Déclaration d'appel filed, within the 1-month period",
    anchors: [{ doc: 'declaration', quote: 'déclare interjeter appel' }] },
  { id: 'k4', date: '2025-10-20', doc: 'email', kind: 'Email', summary: 'Counsel email shows the delay was strategic (awaiting an expert report)',
    anchors: [{ doc: 'email', quote: "en attente du rapport d'expertise" }], qualification: 'q-force-majeure' },
  { id: 'k5', date: '2025-11-20', doc: 'conclusions', kind: 'Submissions', summary: "Appellant's conclusions filed 19 days after the art. 908 deadline",
    anchors: [{ doc: 'conclusions', quote: 'concluant pour la société Trans-Alpine' }], qualification: 'q-late' },
  { id: 'k6', date: '2025-12-15', doc: 'order', kind: 'Court order', summary: 'Conseiller de la mise en état records the caducité ex officio',
    anchors: [{ doc: 'order', quote: "constate la caducité de la déclaration d'appel" }] },
];

export const QUALIFICATIONS_C5: Qualification[] = [
  { id: 'q-late', factId: 'k5', question: "Were the appellant's conclusions filed within 3 months of the declaration of appeal?",
    proposed: false, yes: 'Filed in time', no: 'Filed late (19 days)',
    source: 'rule', confidence: 'high', rule: 'art. 908 CPC',
    reasoning: 'Declaration of appeal 01/08/2025 → deadline 01/11/2025; conclusions filed 20/11/2025.',
    whatIfLabel: 'The conclusions were in fact filed by 01/11/2025' },
  { id: 'q-force-majeure', factId: 'k4', question: 'Does a qualifying force majeure excuse the late filing?',
    proposed: false, yes: 'Force majeure — sanction disapplied', no: 'No force majeure — sanction stands',
    source: 'ai_inferred', confidence: 'low', rule: 'art. 911 CPC',
    reasoning: 'The email shows the delay was a litigation-strategy choice (awaiting an expert report), not a circumstance external to and insurmountable for the appellant.',
    whatIfLabel: 'A genuine force majeure is established' },
];

function c5(ctx: Ctx): LinkDef[] {
  return [
    { id: 'c5-fact', kind: 'fact', title: 'Notice of appeal', statement: 'Filed 01/08/2025, within the 1-month period',
      anchors: [/* ... */], deps: [], holds: true },
    { id: 'c5-req', kind: 'requirement', title: 'Art. 908 deadline', statement: 'Conclusions due within 3 months (by 01/11/2025)',
      rule: 'art. 908 CPC', anchors: [/* ... */], deps: [], holds: true },
    { id: 'c5-breach', kind: 'breach', title: 'Late conclusions', statement: 'Filed 20/11/2025 — 19 days late',
      deps: ['q-late'], holds: !ctx.v('q-late') },
    { id: 'c5-sanction', kind: 'sanction', title: 'Caducité', statement: 'Caducité recorded ex officio by order of 15/12/2025',
      rule: 'arts. 908, 911 CPC', deps: ['q-force-majeure'], holds: !ctx.v('q-force-majeure') },
    { id: 'c5-lost', kind: 'lost_effect', title: 'Appeal extinguished', statement: "Cour d'appel de Grenoble dessaisie of the appeal; no incidental appeal filed",
      rule: 'art. 550 CPC', deps: [], holds: true },
    { id: 'c5-cons', kind: 'consequence', title: 'No route back', statement: 'Original 1-month appeal period (expired 08/08/2025) long past',
      deps: [], holds: true },
    { id: 'c5-out', kind: 'outcome', title: 'Judgment final', statement: 'First-instance judgment of 01/07/2025 is final and enforceable',
      deps: [], holds: true },
  ];
}
```

### Regime table additions (`regimes.ts` shape)

```ts
forclusion_insolvabilite: {
  name: 'Forclusion (défaut de déclaration de créance)',
  when: 'Within 2 months of BODACC publication (art. R622-24 C. com.)',
  prejudice: '—',
  curable: 'Yes — relevé de forclusion within 6 months of BODACC publication, or longer on proof the creditor could not have known of the debt/proceedings (art. L622-26 C. com.)',
  ownMotion: 'No — raised by the debtor/mandataire; the stay itself is public order',
  interruption: 'n/a — governs claim admissibility in the collective proceeding, not limitation',
},

exception_incompetence_territoriale: {
  name: "Exception d'incompétence territoriale",
  when: 'Simultaneously with and before any defence on the merits (art. 74 CPC); must designate the court sought (art. 75 CPC)',
  prejudice: '—',
  curable: 'No — order of submissions in the single proceeding is decisive',
  ownMotion: 'Limited — personal status, exclusive jurisdiction, non-appearing defendant (art. 77 CPC); separate own-motion exclusion of abusive clauses under art. R632-1 C. conso.',
  interruption: 'n/a',
},

caducite_appel: {
  name: "Caducité de la déclaration d'appel",
  when: 'Recorded ex officio after expiry of the art. 908 CPC 3-month deadline (ordinary procedure) or art. 906-2 CPC 2-month deadline (bref délai)',
  prejudice: '—',
  curable: 'Only by a qualifying force majeure under art. 911 CPC, raised before the order is made',
  ownMotion: 'Yes — conseiller de la mise en état (art. 908, 911, 913-5 CPC) or president of chamber for bref délai (art. 906-2, 906-3 CPC)',
  interruption: 'n/a — governs the appeal instance; the first-instance judgment becomes final once no appeal period or valid appeal remains',
},
```

## Sources and verification notes

- **C3 (insolvency/forclusion):** based on Code de commerce arts. L622-21, L622-22, L622-24, L622-26, R622-24, L631-14, L641-3, cross-checked against Cass. com., 27 November 2019, no. 18-13.730 (inopposabilité, not extinction, since the Law of 26 July 2005); Cass. com., 23 May 2024, no. 23-10.699 (strict knowledge-based exception to the 6-month period); Cass. com., 13 April 2022, no. 20-18.175 (new post-opening payment action inadmissible); Cass. com., 23 April 2013, no. 11-25.963 and Cass. com., 8 September 2015, no. 14-16.771 (declaration must be filed within the relief period even while a relief application is pending). Note the 2021 insolvency reform (Ordinance 2021-1193, in force 1 October 2021) amended arts. L622-21, L622-24, L622-26 and L641-3; the two-month declaration period and six-month relief period are unaffected and remain current. The exact current wording of the geographic extension in art. R622-24 for creditors domiciled outside metropolitan France should be confirmed against the live Code text before the demo.
- **C4 (order of objections):** based on CPC arts. 42, 48, 71 (*défense au fond*, not "exceptions de procédure" — corrected from an earlier draft reference), 73 (defines *exception de procédure*), 74, 75, 76, 77, 82-1; Code de la consommation arts. R212-2 (10°), R631-3, R632-1. Cross-checked against Cass. 2e civ., 16 October 2003, no. 01-13.036; Cass. 2e civ., 26 June 2014, no. 13-20.396; Cass. 2e civ., 10 April 2014, no. 13-16.116; Cass. 2e civ., 12 May 2016, no. 14-28.086; Cass. 2e civ., 10 June 2021, no. 20-14.812; Cass. 2e civ., 20 January 2011, no. 10-10.163 (art. 75 designation requirement). No decision was found addressing the exact fact pattern (B2C territorial clause plus merits-first sequencing); the conclusion applies the general art. 74 case law, which is consistently strict about the order of submissions.
- **C5 (appeal lapse):** based on CPC arts. 538, 907, 908, 909, 910, 911, 912, 913-5, 913-6, and the *bref délai* provisions at arts. 905, 906, 906-1, 906-2, 906-3 as restructured by Decree no. 2023-1391 of 29 December 2023 (in force 1 September 2024). The PRD's original references to "arts. 905-1 ff./908 ff." are corrected here: art. 908 remains the controlling deadline for ordinary appeals with mise en état (unchanged by the 2023 reform); the former art. 905-2 reference for the *bref délai* track is now art. 906-2. Cross-checked against Cass. 2e civ., 9 September 2021, no. 20-17.263 (conclusions must contain the required operative claims within the period); Cass. 2e civ., 4 March 2021, no. 19-15.695 (notification to opposing counsel required within the same period, not just remittal to the registry); Cass. 2e civ., 1 October 2020, no. 19-10.726 (incidental appeal under art. 550 CPC can survive caducité of the principal appeal if filed within the time for a principal appeal); Cass. 2e civ., 4 November 2021, nos. 20-15.757 et al. (dispositif must seek reversal or annulment).
