# Domino — Product Requirements Document

> Mistral x Law hackathon (one day). Status: draft v0.3 (civil procedure, consequence chains).
> Legal references below must be checked by a lawyer on the team before the demo.

## 1. Summary

Domino is a web app for French civil and commercial litigators. From a case file (contract, invoices, correspondence, writs, court records) it reconstructs **procedural consequence chains** — *a defect → its procedural sanction → the effect that is lost → the substantive consequence → the available defence* — and shows, source by source, whether a claim can be knocked out without ever reaching the merits.

Flagship chain:

> Writ of summons (*assignation*) not filed with the court registry (*placement au greffe*) in time → **caducité** (lapse) → the writ's interruptive effect on the limitation period is lost → the limitation period kept running → **fin de non-recevoir** (art. 122 CPC) → **claim inadmissible**.

The AI extracts and qualifies facts from French documents; a deterministic engine evaluates the chains and computes deadlines; the lawyer confirms each contested link and decides.

**Principle:** AI finds and qualifies the facts. Rules run the chain. Lawyers decide.

**Pitch:** Find the domino that knocks out the claim.

## 2. Problem

- In French civil procedure, admissibility comes before the merits. A single procedural slip can end a case: *fin de non-recevoir* (arts. 122–126 CPC), *nullité* (arts. 112–121), *caducité*, *exception d'incompétence* (arts. 73–75).
- The decisive issues are **chains**, not isolated checks. A late filing of a writ does nothing by itself; it matters because the writ lapses, the lapse wipes out the interruption of the limitation period, and by the time the claimant re-files, the period has expired.
- Each sanction has its own regime, and the regimes are easy to confuse:
  - when it must be raised;
  - whether prejudice (*grief*) must be shown;
  - whether it can be cured;
  - whether the judge raises it of their own motion;
  - what happens to the interruption of the limitation period.

  Example: a writ **annulled for a procedural defect keeps its interruptive effect** (art. 2241 al. 2 C. civ.); a writ that **lapses does not** (art. 2243 C. civ. and settled case law).
- The facts that trigger these chains are scattered across dozens of documents: dates in writs, registry stamps, contract clauses, emails.
- Generic LLMs produce fluent conclusions without showing which fact and which rule they rest on. Lawyers cannot rely on them.

## 3. Goals and non-goals

**Goals (hackathon)**

1. Every extracted fact is linked to a page and verbatim passage, or visibly marked *Unverified*.
2. The AI qualifies facts (e.g. *Is this a nullity or a lapse? Is this email an acknowledgment of debt? Does this contract contain a mandatory prior-conciliation clause?*). Ambiguous qualifications are labelled *AI-inferred* and require lawyer confirmation.
3. A deterministic engine evaluates a small library of consequence chains, including deadline computation.
4. Counterfactual analysis: show which link each conclusion hinges on, and what happens if it is overturned.
5. Generate an editable, source-cited defence memo ordering the arguments correctly.
6. A polished, calm, trustworthy UI that a lawyer understands in 10 seconds.

**Non-goals**

- Ruling on the merits; guaranteeing outcomes; giving legal advice.
- Exhaustive coverage of the CPC; every special limitation regime; drafting full *conclusions* (written submissions).
- Real client data, authentication, multi-user, desktop packaging.

## 4. Users

| Persona | Need |
|---|---|
| **Defendant's lawyer** (primary) | Find every admissibility defence in the opposing claim, ranked by strength, with sources. |
| **Claimant's lawyer** | Pre-filing and in-flight risk audit: *"Place this writ by DATE or it lapses — and your claim will be time-barred."* |
| **In-house counsel / professional-liability insurer** | Spot procedural risk across a portfolio of cases. |
| **Hackathon jury** (lawyers + Mistral) | See legal soundness, verifiability, and a clear role for the model in under 2 minutes. |

## 5. User stories

1. As a lawyer, I upload a case file and see a timeline of dated facts with their sources.
2. As a lawyer, I see each fact's proposed legal qualification, with the rule and the reasoning.
3. As a lawyer, I click any fact and the source document scrolls to the highlighted passage.
4. As a lawyer, I see every consequence chain that applies, from triggering fact to outcome, with the status of each link.
5. As a lawyer, I confirm or reject an AI-inferred qualification and the chains update instantly.
6. As a lawyer, I see which link each chain hinges on and what happens if the opposing party overturns it.
7. As a lawyer, I see the procedural regime of each defence: when to raise it, whether prejudice must be shown, whether it can be cured.
8. As a lawyer, I generate a defence memo with arguments in the correct order, edit it, and export it.

## 6. Scope

**Must (demo-critical)**

- Load the bundled synthetic case file in one click; optionally upload PDFs/emails.
- Text extraction (OCR when needed) and structured fact extraction with page + quote anchors.
- Quote verification against the source text; unmatched quotes → *Unverified*.
- AI qualification of facts, with reasoning and confidence.
- Chain engine with chains **C1** (lapse → limitation) and **C2** (prior-conciliation clause), and the limitation sub-engine (§7.5).
- Chain view, fact detail, source viewer with highlight.
- Counterfactual toggles with live re-evaluation.
- Defence memo with citation chips; copy / Markdown export.
- Precomputed cache so the demo runs offline if the model API fails.

**Should**

- Chain **C3** (defendant in insolvency proceedings), with a second sample file. Claimant mode (preventive deadlines). DOCX export. FR/EN UI toggle.

**Could**

- Chains **C4** (order of procedural objections) and **C5** (appeal lapse). Portfolio view. Side-by-side comparison: "plain LLM answer vs Domino".

## 7. Functional requirements

### 7.1 Ingestion

- Inputs: PDF (scanned or born-digital), `.eml`/text emails; up to ~30 documents for the demo.
- Use the text layer when it exists; otherwise OCR. Keep per-page text and, if available, line/word coordinates.
- Show staged progress: *Reading documents → Extracting facts → Qualifying → Running chains*.

### 7.2 Extraction

The model returns JSON validated against a schema (§8).

- **Case** facts:
  - parties;
  - nature of the relationship (B2B between merchants / B2C / civil);
  - amount;
  - court seised (*tribunal judiciaire*, *tribunal de commerce / des activités économiques*, *cour d'appel*).
- **Fact** entries:
  - date;
  - document type (contract, invoice, email, letter, LRAR registered letter, writ, registry record, court order, submissions);
  - actor;
  - short neutral summary;
  - typed attributes, e.g. `writ.servedAt`, `writ.hearingDate`, `writ.placedAt`, `clause.type`;
  - one or more **anchors** `{doc, page, quote}`.

**Anchoring guard (model-agnostic):** each `quote` is fuzzy-matched against the source text (whitespace and accents normalised, threshold ~0.9).
- Match → the highlight span is stored.
- No match → the fact is kept, marked *Unverified*, and excluded from the chains until the lawyer confirms it.

### 7.3 Qualification (AI)

For each fact that needs interpretation, the model proposes a qualification with reasoning, the rule it relies on, and a confidence level. Examples:

| Question | Possible answers | Why it matters |
|---|---|---|
| What happened to the first writ? | lapsed (*caduque*) / annulled (*nulle*) / withdrawn / still pending | A lapsed or withdrawn writ loses its interruptive effect (art. 2243 C. civ.); an annulled one keeps it (art. 2241 al. 2). |
| Is this email an acknowledgment of debt? | yes / no / uncertain | An acknowledgment restarts the limitation period (art. 2240 C. civ.). |
| Does the contract impose prior conciliation or mediation before any court action? | mandatory clause / optional / none | A mandatory clause that was not implemented is a *fin de non-recevoir* (Cass. ch. mixte, 14 Feb 2003). |
| Is this letter an ordinary formal notice (*mise en demeure*)? | yes / no | It does **not** interrupt the period — a common misconception. |
| Did the defendant argue the merits before raising this objection? | yes / no | Procedural objections must be raised before any defence on the merits (art. 74 CPC). |

- Each qualification has `confidence: high | medium | low` and `source: rule | ai_inferred`.
- `ai_inferred` qualifications are **proposals**: they are not applied until the lawyer clicks **Confirm**. The UI can preview the outcome either way.

### 7.4 Chain engine (deterministic, no LLM)

A chain is a declarative sequence of **links**. Each link has a condition evaluated on confirmed facts and computed values, a rule reference, and an output node. Node kinds:

`Fact → Requirement → Breach → Sanction → LostEffect → Consequence → Outcome (defence / remedy)`

Each link evaluates to `established` / `contested` (it depends on an unconfirmed or `ai_inferred` qualification) / `broken` / `not_applicable`. A chain's outcome holds only if every link is `established`. The chain inherits `contested` if any link is contested.

**Sanction regime table** (shown in the UI and used by the memo):

| Sanction | When to raise | Prejudice needed? | Curable? | Raised by judge of own motion? | Effect on limitation interruption |
|---|---|---|---|---|---|
| Nullité de forme | Before any defence on the merits (arts. 74, 112) | Yes (art. 114) | Yes (art. 115) | No | Kept (art. 2241 al. 2) |
| Nullité de fond | Any stage (art. 118) | No (art. 119) | Yes, until the ruling (art. 121) | In some cases (art. 120) | To verify for the case at hand |
| Fin de non-recevoir | Any stage (art. 123) | No (art. 124) | Yes, if cured before the ruling (art. 126) — except where case law says otherwise (see C2) | In some cases (art. 125) | — |
| Exception d'incompétence | Before any defence on the merits, together with all other procedural objections (art. 74) | — | — | Limited (art. 76) | Kept, even before an incompetent court (art. 2241 al. 2) |
| Caducité de l'assignation | Recorded by the judge (e.g. art. 754 / 857 CPC) | — | Not as such; a new writ can be filed | Yes | **Lost** (art. 2243 + case law) |

**Chain library**

| ID | Chain | Links (simplified) | Key refs |
|---|---|---|---|
| **C1** (Must) | Writ lapse → limitation | Writ served → copy not placed with the registry in time (tribunal de commerce: at the latest 8 days before the hearing, art. 857 CPC; tribunal judiciaire: art. 754 CPC) → **caducité** → interruption void → limitation computed without it (§7.5) → new writ served after expiry → **fin de non-recevoir** → claim inadmissible | arts. 754, 857, 122 CPC; arts. 2224, 2241, 2243 C. civ.; art. L110-4 C. com. |
| **C2** (Must) | Mandatory prior conciliation | Contract contains a mandatory prior-conciliation clause → no conciliation attempt on file before the writ → **fin de non-recevoir** → **cannot be cured by a conciliation attempted during the proceedings** → claim inadmissible; the claimant must re-file after conciliation (and limitation may then become an issue) | Cass. ch. mixte, 14 Feb 2003; Cass. ch. mixte, 12 Dec 2014; art. 122 CPC |
| **C3** (Should) | Defendant in insolvency | Insolvency judgment → action for payment of a pre-existing debt barred → claim not declared within 2 months of BODACC publication → claim **unenforceable against the proceedings** (*inopposable*) → *relevé de forclusion* within 6 months | arts. L622-21, L622-24, L622-26, R622-24 C. com. |
| **C4** (Could) | Order of objections | A jurisdiction clause in a B2C contract is deemed unwritten → objection of lack of jurisdiction available → but the defendant argued the merits first → objection inadmissible | arts. 48, 74 CPC; art. R212-2 C. conso. |
| **C5** (Could) | Appeal lapse | Notice of appeal → appellant's submissions not filed in time → notice of appeal lapses → first-instance judgment becomes final | arts. 905-1 ff. / 908 ff. CPC (**check the post-2024 reform numbering**) |

- Every chain shows its links in order, each with rule, inputs, sources and computed values.
- Wording never states a legal conclusion as certain: *"Potential fin de non-recevoir — requires lawyer review."*
- Chains are independent: several can lead to the same outcome. The UI says so ("2 independent grounds").

### 7.5 Limitation sub-engine (deterministic)

Used by any chain that needs a deadline (C1, C2's follow-on, C3).

| ID | Rule | Logic (simplified) | Ref. |
|---|---|---|---|
| L1 | Base period by regime | Civil: 5 years (art. 2224 C. civ.). Between merchants: 5 years (art. L110-4 C. com.). Professional vs consumer: 2 years (art. L218-2 C. conso.). | as stated |
| L2 | Interruption | A new period of the same length starts (art. 2231). Triggers: acknowledgment of debt (art. 2240), court action (art. 2241), enforcement measure (art. 2244). The interruption lasts until the proceedings end (art. 2242) and is **void** on withdrawal, lapse of the proceedings, final rejection (art. 2243) — and, per case law, on caducité of the writ. | arts. 2231, 2240–2244 C. civ. |
| L3 | Suspension | The clock pauses (art. 2230). After mediation/conciliation (art. 2238) or a pre-trial expert measure (art. 2239), the remaining period is at least 6 months. | as stated |
| L4 | No-effect events | Ordinary formal notices and reminders do not change the date. Show an explicit **"Does not interrupt"** note. | — |
| L5 | Long-stop (Could) | No extension beyond 20 years from the right arising. | art. 2232 C. civ. |

- **Computation:** the period ends at the end of its last day (art. 2229). Whether it is extended when the last day falls on a weekend or public holiday (art. 642 CPC) is a **configurable flag**; the legal reviewer decides the default.
- **Output:** the limitation date, the status as of a chosen date, and ordered calculation steps — each citing its fact and anchor.

### 7.6 Counterfactual analysis

The civil equivalent of a "blast radius".

- For each **contested** link (an `ai_inferred` qualification, low confidence, or one the opposing party is likely to dispute), re-run the engine with the link flipped.
- Display: *"C1 hinges on: email of 2 June 2022 is **not** an acknowledgment of debt. If it were, the limitation period would run until 2 Jun 2027 and C1 breaks. C2 is unaffected."*
- Also display regime contrasts as teaching counterfactuals, e.g.: *"Had the first writ been annulled rather than lapsed, its interruptive effect would have survived (art. 2241 al. 2) and C1 would break."*
- Rank defences by robustness: number of contested links, and whether another independent chain reaches the same outcome.

### 7.7 Defence memo

- Inputs: the case, the confirmed facts, the chain results, and the counterfactuals.
- Sections:
  1. Case summary
  2. Defences, **ordered per procedural regime**: objections that must be raised *in limine litis* first, then *fins de non-recevoir*
  3. For each defence: the chain (facts → rule → consequence) with sources; the regime (when to raise it, prejudice, curability); weak links and the expected counter-arguments
  4. Recommended next steps with dates
  5. Points for lawyer review
  6. Sources
- Case law may only be cited from a curated local list (`data/caselaw.json`); otherwise the model writes *[authority to add]*.
- Every sentence carrying a fact has a citation chip; uncited factual sentences are underlined amber.
- Editable; export as Markdown (DOCX if time allows).
- **Claimant mode** (Should): the same chains produce a preventive memo — *"Place the writ with the registry by 12 Feb 2026; otherwise it lapses, and a new writ after 16 Mar 2026 would be time-barred."*

## 8. Data model (sketch)

```ts
type Anchor = { doc: string; page: number; quote: string;
                span?: { start: number; end: number }; verified: boolean };

type Case = { claimant: string; defendant: string; relationship: 'commercial' | 'civil' | 'consumer';
              amountEur: number; court: 'tribunal_judiciaire' | 'tribunal_commerce' | 'cour_appel';
              anchors: Anchor[] };

type Fact = {
  id: string;
  date: string;                       // ISO date, Europe/Paris
  docType: 'contract' | 'invoice' | 'email' | 'letter' | 'lrar' | 'writ' | 'registry_record'
         | 'court_order' | 'submissions' | 'other';
  summary: string;
  attrs: Record<string, string | number | boolean>;   // e.g. { servedAt, hearingDate, placedAt }
  anchors: Anchor[];
  qualification?: {
    label: string;                    // e.g. "writ_lapsed", "acknowledgment_of_debt", "mandatory_conciliation_clause"
    value: string | boolean;
    rule: string;                     // e.g. "art. 857 CPC"
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
    source: 'rule' | 'ai_inferred';
    status: 'proposed' | 'confirmed' | 'rejected';
    note?: string;
  };
};

type NodeKind = 'fact' | 'requirement' | 'breach' | 'sanction' | 'lost_effect' | 'consequence' | 'outcome';

type Link = { id: string; kind: NodeKind; label: string; rule?: string;
              factIds: string[]; computed?: Record<string, string>;
              status: 'established' | 'contested' | 'broken' | 'not_applicable' };

type ChainResult = { chainId: 'C1' | 'C2' | 'C3' | 'C4' | 'C5'; title: string; links: Link[];
                     outcome: string; status: 'holds' | 'contested' | 'fails' | 'not_applicable';
                     hingesOn: string[] };   // link ids

type Counterfactual = { linkId: string; flippedTo: string; affectedChains: string[];
                        newStatus: Record<string, ChainResult['status']>; explanation: string };
```

## 9. Architecture

```
Documents ─▶ Text layer / OCR ─▶ Structured extraction (LLM, JSON schema)
                                         │
                                         ▼
                            Anchoring guard (fuzzy quote match)
                                         │
                                         ▼
                            Qualification (LLM, proposals)
                                         │
                         lawyer confirms / rejects (UI)
                                         │
             ┌───────────────────────────┼───────────────────────────┐
             ▼                           ▼                           ▼
   Chain engine (TS, pure)      Limitation sub-engine        Counterfactual runner
   declarative chain library    (dates, interruptions,       (engine × flipped links)
                                 suspensions)
             └───────────────────────────┼───────────────────────────┘
                                         ▼
                Web UI (facts · chains · source · memo)  ─▶  Memo (LLM, anchored)
```

Suggested stack (the team may change it): React + TypeScript + Vite; `pdf.js` for the viewer; Tailwind + a headless component kit; custom SVG for the chain view and the deadline track; a thin API (Node or Python FastAPI) that calls the model provider and serves cached results. The engines run client-side as pure functions, so re-evaluation is instant. Chains are data (JSON/TS objects), so a new chain needs no UI change.

### 9.1 Model layer — Mistral first, provider-agnostic

- One interface, e.g. `ocr(doc)`, `extract(text, schema)`, `qualify(fact, context, schema)`, `complete(messages, schema?)`.
- Default provider: **Mistral** — Mistral OCR for scans; a Mistral chat model with structured JSON output for extraction, qualification and the memo. Its French-language legal reasoning is the key strength here.
- Other providers are selectable via an env var: `DOMINO_PROVIDER=mistral|openai|anthropic|local`. Any OpenAI-compatible endpoint should work, including self-hosted open-weight models.
- The chain engine, limitation sub-engine, anchoring guard and counterfactual runner never depend on the model provider.
- All model outputs are validated against the schema. On failure: retry once, then fall back to cached results.
- Pitch line: open weights allow on-premise deployment, which protects *secret professionnel*.

## 10. UI/UX requirements

UI/UX is a first-class deliverable. The product must feel like a **precise legal instrument**, not a chatbot.

### 10.1 Design principles

1. **Evidence first.** No claim without a visible source. One click from any link to the highlighted passage.
2. **Show your work.** Every link shows its rule, inputs and computed values; every date shows its calculation.
3. **AI is visibly labelled.** AI-inferred qualifications and draft prose carry a consistent *AI-inferred* marker; deterministic results do not.
4. **The lawyer decides.** AI qualifications are proposals until confirmed; every confirmation updates the chains immediately.
5. **Calm density.** Information-rich but quiet: neutral palette, one accent colour per meaning, no gratuitous animation.

### 10.2 Layout (desktop, target 1440×900)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Domino · Atelier Lumière v. Bâtiself   [Facts | Chains | Memo]   As of: 04 Oct 2026 │
│ ● 2 independent grounds for inadmissibility · 1 contested link                         │
├────────────────┬───────────────────────────────────────┬──────────────────────┤
│ Facts          │ Main panel                            │ Source viewer        │
│ (chronological)│ Facts: fact detail + qualification    │ document, highlighted│
│ qualification  │ Chains: domino lanes + link detail    │ passage, doc index   │
│ badges         │ Memo: editor                          │                      │
└────────────────┴───────────────────────────────────────┴──────────────────────┘
```

- The **summary banner** is always visible: it is the product's answer, e.g. *2 independent grounds · 1 contested link* or *Provisional — 2 qualifications awaiting review*.
- Panels are resizable; the source viewer can collapse.
- The mode switcher is the primary navigation and follows the demo story (Facts → Chains → Memo).

### 10.3 Screens and key interactions

**Start screen**
- Large drop zone and a prominent **"Load sample case"** button (the demo path).
- Staged progress with live counters (documents read, facts found, qualifications proposed, chains evaluated). Never a spinner without words.

**Facts mode**
- Fact list: date, document-type icon, one-line summary, qualification badge, and an *AI-inferred* marker where applicable.
- Fact detail:
  - The quoted passage, in serif type, with a source chip (`Writ · 12/01/2026 · p.1`) that highlights it in the viewer.
  - Proposed qualification, rule, reasoning (2–3 lines), confidence.
  - Actions: **Confirm**, **Reject** (requires a short note), **Preview impact** (shows which chains change).
- *No effect* facts show an explicit note, e.g. **"Mise en demeure — does not interrupt the limitation period"**.

**Chains mode** (the hero screen)
- **Domino lanes**: one horizontal lane per applicable chain, read left to right: `Fact → Requirement → Breach → Sanction → Lost effect → Consequence → Outcome`.
  - Each node is a compact card: kind label, one-line statement, rule ref, source-chip count.
  - Link status: *established* = solid ink connector; *contested* = dashed connector + violet *AI-inferred* tag; *broken* = connector visibly severed, and downstream nodes greyed out.
  - Outcome node at the right: *"Fin de non-recevoir — claim inadmissible"*, with the chain status.
- Click a node → link detail in a drawer: rule text, inputs, computed values (monospace), sources (clicking highlights them in the viewer), and the sanction regime row from §7.4.
- **Time nodes** expand into a **deadline track**: a horizontal axis from the start of the limitation period to its expiry. Running period = solid bar; suspension = hatched gap; interruption = restart marker; a voided interruption = struck-through marker; plus an "As of" line.
- **Counterfactual toggles** on contested links (e.g. *"Treat email of 02/06/2022 as an acknowledgment"*). Flipping one makes the downstream nodes **fall in sequence** (~120 ms per node, subtle tilt + fade) or stand back up. This is the key demo moment.
- **Regime contrast hint** on the sanction node: *"If annulled instead of lapsed → interruption kept (art. 2241 al. 2) → chain breaks."*
- **Robustness summary**: defences ranked by number of contested links, with an "independent grounds" indicator.

**Memo mode**
- Structured document with the sections of §7.7; citation chips inline.
- Amber underline on factual sentences without a citation; tooltip "No source — verify or remove".
- Buttons: **Regenerate section**, **Copy**, **Export**.

### 10.4 Visual language

- Colours: neutral greys/ink; **red** = sanction / claim knocked out; **green** = claim survives / link broken in the claimant's favour; **amber** = unverified or needs attention; **violet** (or one other distinct hue) = AI-inferred. Colour is never the only signal: always add icons, line styles (solid / dashed / severed) and labels.
- Typography: sans-serif for the UI; serif for document excerpts and the memo; monospace for dates and calculations.
- Dates in French format (`12/01/2026`) in content, and an unambiguous `12 Jan 2026` in UI chrome. Legal terms stay in French (*assignation, placement, caducité, fin de non-recevoir, mise en demeure*); the UI chrome is in English. Source documents are in French.

### 10.5 States

- **Empty**: guidance + sample case button.
- **Loading**: staged progress and skeletons matching the final layout.
- **Unverified fact**: amber badge; excluded from the chains until confirmed.
- **Pending qualifications**: the banner shows *"Provisional — N qualifications awaiting review"*; the affected links are dashed.
- **No chain applies**: explicit *"No ground found among the N enabled chains"* (never implies the claim is safe).
- **Model error / timeout**: non-blocking toast, automatic fallback to cache, labelled *"Showing cached analysis"*.

### 10.6 Accessibility and quality bar

- Keyboard: `J`/`K` move between facts or nodes, `C` confirm, `R` reject, `1`/`2`/`3` switch modes, `Esc` closes drawers.
- WCAG AA contrast; visible focus rings; `prefers-reduced-motion` disables the domino animation.
- No layout shift when switching modes. Re-evaluation and UI responses take under 100 ms (model calls excluded).

### 10.7 Demo polish

- Precomputed results for the sample case; fixed as-of date for the demo (configurable); fixed lane layout.
- **Presenter mode**: larger font, hides dev controls.
- The 2-minute script in §12 must be executable in 8 clicks or fewer.

## 11. Synthetic case file

Commercial dispute. **We act for the defendant**, Bâtiself SARL, sued by Atelier Lumière SAS for an unpaid invoice. French documents, all names fictitious. Dates assume a demo as-of date of **4 Oct 2026**.

| # | Document | Date | Purpose |
|---|---|---|---|
| 1 | Supply contract; art. 14: *"Tout différend… sera soumis, préalablement à toute action judiciaire, à une tentative de conciliation…"* | 2020-11-05 | Regime: commercial → 5 years. **C2 trigger**: mandatory prior-conciliation clause (AI-inferred) |
| 2 | Invoice F-2021-034, €18,400, due | 2021-03-15 | Limitation starts → base expiry 15 Mar 2026 (Sunday → 16 Mar 2026 if the art. 642 flag is on) |
| 3 | Debtor email: *"Nous allons étudier votre facture et revenons vers vous."* | 2022-06-02 | **Contested fact**: probably *not* an acknowledgment of debt (AI-inferred, medium confidence). This is the counterfactual for C1. |
| 4 | *Mise en demeure* sent by registered letter (LRAR) + scanned receipt | 2023-02-10 | **Misconception**: does not interrupt |
| 5 | First writ before the *tribunal de commerce*, served 12 Jan 2026, hearing on 20 Feb 2026 | 2026-01-12 | Would interrupt the limitation period (art. 2241) |
| 6 | Registry stamp: copy of the writ placed on 16 Feb 2026 | 2026-02-16 | **Breach**: deadline = 8 days before the hearing = 12 Feb 2026 (art. 857 CPC) |
| 7 | Court order recording the lapse (*ordonnance de caducité*) | 2026-02-20 | Sanction: caducité → interruption void |
| 8 | Second writ, served 8 Apr 2026, hearing on 20 Oct 2026 | 2026-04-08 | Served after 16 Mar 2026 → time-barred → **C1 outcome** |
| 9 | No conciliation record anywhere in the file | — | **C2 breach** (shown as "required document not found") |

Expected engine results (to be validated by the legal reviewer):
- **C1 holds** (contested on #3): the interruption by #5 is void because of #7. The period expired on 15/16 Mar 2026; writ #8 of 8 Apr 2026 is out of time → *fin de non-recevoir*.
- **Counterfactual on #3:** if #3 is an acknowledgment, a new period runs until 2 Jun 2027 → **C1 breaks**.
- **Counterfactual on #7:** if #5 had been *annulled* instead of lapsing, its interruption would survive (art. 2241 al. 2) → **C1 breaks**.
- **C2 holds** independently of #3: the conciliation clause was not implemented, and this cannot be cured during the proceedings → *fin de non-recevoir*.
- Banner: **2 independent grounds · 1 contested link**. The hearing is in 16 days.
- #4 must not change any date.

Some documents should be lightly degraded scans (the LRAR receipt, the registry stamp, the court order) to exercise OCR.

## 12. Demo script (2 minutes)

1. **Load sample case** → staged progress → facts appear. Banner: *Provisional*.
2. **Chains** → lane C1 builds left to right: *writ served → placed 16/02, due by 12/02 → caducité → interruption void → limitation expired 16/03 → second writ 08/04 → fin de non-recevoir.* Click the registry-stamp node → the stamp is highlighted in the scan.
3. Sanction node hint: *"Annulled ≠ lapsed: an annulled writ would have kept its interruptive effect."* The lawyers on the jury nod.
4. Toggle the counterfactual *"Treat the 2022 email as an acknowledgment"* → the C1 dominoes fall back up; the banner changes. *"This is where the claimant will attack."* Toggle it back.
5. Lane C2: *mandatory conciliation clause → no attempt on file → cannot be cured → fin de non-recevoir.* Banner: **2 independent grounds**.
6. **Memo** → defence memo with arguments ordered by procedural regime, each fact source-cited.
7. Close on the principle: *AI finds and qualifies the facts. Rules run the chain. Lawyers decide.*

## 13. Success criteria

- 100% of displayed facts are anchored or marked *Unverified*.
- Every planted fact is correctly qualified: the writ lapsed (not annulled); the clause is mandatory; the *mise en demeure* has no effect; the 2022 email is flagged as contested.
- Chain and counterfactual results match §11 exactly; re-evaluation takes under 100 ms.
- The demo runs end-to-end in under 2 minutes, online or from cache.
- A lawyer on the jury can verify any link from the UI alone.

## 14. One-day plan

| Time | Legal | AI / backend | Frontend / UX |
|---|---|---|---|
| H0–1 | Fix the scenario, dates, and the C1/C2 link specs | Provider interface, schemas | Layout shell, design tokens |
| H1–4 | Write the synthetic documents; expected results | Extraction + anchoring guard + qualification prompts | Fact list, source viewer, fact detail |
| H4–6 | Review the engine output against §11 | Chain engine + limitation sub-engine + unit tests; counterfactual runner | Domino lanes, link drawer, deadline track, toggles |
| H6–7 | Curated case-law list, memo review | Memo generation, cache | Memo mode |
| H7–8 | Pitch | Hardening, fallback | Polish, animation, presenter mode, rehearsal |

## 15. Risks and open questions

- **Legal accuracy**: placement deadlines (arts. 754 / 857 CPC, and the procedure applicable before the *tribunal des activités économiques* where relevant); the case law on caducité and interruption; the cure rules for C2; the art. 642 CPC flag. All to be confirmed by the legal reviewer.
- **Qualification quality** on ambiguous French text → strict JSON schema, few-shot examples, always lawyer-confirmed.
- **Scope creep**: the chain library could grow without bound → two chains for the demo; C3–C5 are optional extras.
- **OCR coordinates**: if the chosen OCR returns no text-level positions, highlight via page + fuzzy quote match on the `pdf.js` text layer.
- **Over-claiming** → never say "the claim is inadmissible" as a certainty, or "zero hallucination"; say "potential ground, source-anchored, requires lawyer review".
- **Time** → C3, claimant mode, DOCX export and live upload are the first to cut.
