# ClaimClock — Product Requirements Document

> Mistral x Law hackathon (one day). Status: draft v0.2 (civil litigation).
> Legal references below must be checked by a lawyer on the team before the demo.

## 1. Summary

ClaimClock is a web app for French civil and commercial litigators. From a client's file (contract, invoices, emails, letters, mediation records) it answers one question before anyone files: **is this claim still alive, and can this defendant still be sued?**

It extracts dated events with source anchors, lets the AI **qualify** each event's legal effect on the limitation period (interruption, suspension, or no effect), computes the deadline with deterministic rules, checks the defendant's status (collective insolvency proceedings), and drafts a source-backed pre-filing memo.

**Principle:** AI finds and qualifies the facts. Rules compute the deadline. Lawyers decide.

## 2. Problem

- Missing a deadline is one of the most common sources of professional liability claims against lawyers. A time-barred claim ends in a *fin de non-recevoir* (art. 122 CPC): the case is dismissed without examining the merits.
- The limitation date is rarely just "due date + 5 years". It depends on scattered events buried in correspondence:
  - **Interruption** restarts a full new period: acknowledgment of the debt (art. 2240 C. civ.), court action (art. 2241), enforcement measures (art. 2244).
  - **Suspension** pauses the clock without erasing elapsed time (art. 2230): mediation or conciliation (art. 2238), a pre-trial expert measure (art. 2239).
  - **No effect**, despite a common belief: an ordinary formal notice (*mise en demeure*) does **not** interrupt the period, except under special regimes (e.g. art. L114-2 C. assur.).
- Whether an email counts as an acknowledgment is a **legal qualification of ambiguous French text**. That is exactly where lawyers spend time and where AI helps.
- The defendant may meanwhile have entered insolvency proceedings. Suing for payment is then barred (art. L622-21 C. com.), and the claim must be declared to the *mandataire judiciaire* within 2 months of the BODACC publication (art. R622-24 C. com.).
- Generic LLMs produce confident dates without showing their reasoning. Lawyers cannot rely on output they cannot verify.

## 3. Goals and non-goals

**Goals (hackathon)**

1. Every extracted event is linked to a page and verbatim passage, or visibly marked *Unverified*.
2. The AI qualifies each event's effect on the limitation period. Ambiguous qualifications are labelled *AI-inferred* and require lawyer confirmation.
3. A deterministic engine computes the limitation date and recomputes it live when the lawyer confirms or rejects a qualification.
4. Sensitivity analysis: show which conclusion depends on which contested event.
5. Check the defendant's status and surface the insolvency deadlines.
6. Generate an editable, source-cited pre-filing memo.
7. A polished, calm, trustworthy UI that a lawyer understands in 10 seconds.

**Non-goals**

- Ruling on the merits, or guaranteeing the outcome; giving legal advice.
- Covering every special limitation regime; jurisdiction routing; drafting the *assignation* (writ of summons).
- Real client data, authentication, multi-user, desktop packaging.

## 4. Users

| Persona | Need |
|---|---|
| **Claimant's lawyer** | Before filing: is the claim time-barred? Against whom, and by when, must I act? |
| **Defendant's lawyer** | Find the *fin de non-recevoir*: is the opposing claim already time-barred? |
| **In-house counsel / collections team** | Triage a portfolio of unpaid invoices by legal urgency. |
| **Hackathon jury** (lawyers + Mistral) | See legal soundness, verifiability, and a clear role for the model in under 2 minutes. |

## 5. User stories

1. As a lawyer, I upload a client file and see a timeline of dated events with their sources.
2. As a lawyer, I see each event's proposed legal effect (*starts / interrupts / suspends / no effect / bars action*) with the rule and the reasoning.
3. As a lawyer, I click any event and the source document scrolls to the highlighted passage.
4. As a lawyer, I confirm or reject an AI-inferred qualification, and the deadline recomputes instantly.
5. As a lawyer, I see the claim's status as of a chosen date: **Alive (N days left)** or **Time-barred since DATE**.
6. As a lawyer, I see which events the conclusion hinges on ("without event X, the claim is time-barred").
7. As a lawyer, I see whether the defendant is in insolvency proceedings and what that changes.
8. As a lawyer, I generate a pre-filing memo, edit it, and export it.

## 6. Scope

**Must (demo-critical)**

- Load the bundled synthetic client file in one click; optionally upload PDFs/emails.
- Text extraction (OCR when needed) and structured event extraction with page + quote anchors.
- Quote verification against the source text; unmatched quotes → *Unverified*.
- AI qualification of each event, with reasoning and confidence.
- Limitation engine, rules R1–R5 (§7.4), with live recomputation.
- Timeline + deadline track, event detail, source viewer with highlight.
- Sensitivity panel.
- Defendant status card (insolvency) — a live API call, or a mocked response for the demo.
- Pre-filing memo with citation chips; copy / Markdown export.
- Precomputed cache so the demo runs offline if the model API fails.

**Should**

- Rule R6 (mandatory prior amicable resolution attempt). Defendant mode ("find the *fin de non-recevoir*"). DOCX export. FR/EN UI toggle.

**Could**

- Portfolio view of several claims ranked by days left. Rule R7 (20-year long-stop). Side-by-side comparison: "plain LLM answer vs ClaimClock".

## 7. Functional requirements

### 7.1 Ingestion

- Inputs: PDF (scanned or born-digital), `.eml`/text emails; up to ~30 documents for the demo.
- Use the text layer when it exists; otherwise OCR. Keep per-page text and, if available, line/word coordinates.
- Show staged progress: *Reading documents → Extracting events → Qualifying effects → Computing deadlines*.

### 7.2 Extraction

The model returns JSON validated against a schema (§8). For each **Event**:
- date;
- author / recipient;
- document type (invoice, contract, email, LRAR registered letter, mediation agreement, mediation report, court act, registry record);
- short neutral summary;
- one or more **anchors** `{doc, page, quote}`.

Also extract **Claim** facts: creditor, debtor, amount, due date, nature of the relationship (B2B between merchants / B2C / civil).

**Anchoring guard (model-agnostic):** each `quote` is fuzzy-matched against the source text (whitespace and accents normalised, threshold ~0.9).
- Match → the highlight span is stored.
- No match → the event is kept, marked *Unverified*, and excluded from computation until the lawyer confirms it.

### 7.3 Qualification (AI)

For each event, the model proposes an **effect** with reasoning and the rule it relies on:

| Effect | Typical events | Rule |
|---|---|---|
| `starts` | due date of invoice; the date the creditor knew or should have known the facts | art. 2224 C. civ. |
| `interrupts` | debtor acknowledges the debt (explicit or implied: partial payment, request for payment terms) | art. 2240 C. civ. |
| `interrupts` | court action, including summary proceedings (*référé*) | art. 2241 C. civ. |
| `suspends` | written agreement to mediate or conciliate → end of mediation | art. 2238 C. civ. |
| `suspends` | pre-trial expert measure ordered → measure completed | art. 2239 C. civ. |
| `no_effect` | ordinary formal notice, reminder, the debtor disputing the debt | — (common misconception flagged) |
| `bars_action` | defendant's insolvency judgment | art. L622-21 C. com. |

- Each qualification has `confidence: high | medium | low` and `source: rule | ai_inferred`.
  - `rule`: unambiguous document types (court act, signed mediation agreement).
  - `ai_inferred`: interpretation of free text (emails, letters).
- `ai_inferred` qualifications are **proposals**: they are not applied until the lawyer clicks **Confirm**. The UI can preview both scenarios before that.

### 7.4 Limitation engine (deterministic, no LLM)

Inputs: claim regime, confirmed events, as-of date. Output: limitation date, status, step-by-step calculation.

| ID | Rule | Logic (simplified) | Ref. |
|---|---|---|---|
| R1 | Base period by regime | Civil 5 years (art. 2224 C. civ.); between merchants 5 years (art. L110-4 C. com.); professional vs consumer 2 years (art. L218-2 C. conso.). The period starts on the `starts` event. | arts. 2224 C. civ., L110-4 C. com., L218-2 C. conso. |
| R2 | Interruption | A new period of the same length starts on the interrupting event (art. 2231). For a court action, the interruption lasts until the proceedings end (art. 2242) and is void if the claimant withdraws, the action lapses, or the claim is finally rejected (art. 2243). | arts. 2231, 2240–2244 C. civ. |
| R3 | Suspension | The clock pauses from suspension start to end; elapsed time is kept (art. 2230). After mediation or an expert measure, the remaining period is at least 6 months from the end date (arts. 2238, 2239). | arts. 2230, 2238, 2239 C. civ. |
| R4 | No-effect events | Ordinary formal notices and reminders do not change the date. Show an explicit **"Does not interrupt"** note so the common misconception is visible. | — |
| R5 | Defendant in insolvency | Insolvency judgment before filing → an action for payment of a pre-existing debt is barred (L622-21). Declaration deadline = BODACC publication + 2 months (R622-24; +2 months for creditors outside mainland France). If missed → *relevé de forclusion* within 6 months (L622-26). | arts. L622-21, L622-24, L622-26, R622-24 C. com. |
| R6 | Prior amicable resolution attempt (Should) | Claim ≤ €5,000, or a neighbour dispute, and no conciliation, mediation or participatory procedure on file → risk that the claim is inadmissible. | art. 750-1 CPC |
| R7 | Long-stop (Could) | Suspension and interruption cannot push the deadline beyond 20 years from the right arising. | art. 2232 C. civ. |

- **Computation:** the period ends at the end of its last day (art. 2229). Whether it is extended when the last day falls on a weekend or public holiday (art. 642 CPC) is a **configurable flag**; the legal reviewer decides the default.
- **Status as of a date:** `alive (N days left)` / `expires today` / `time-barred since DATE`. The as-of date defaults to today and can be changed in the UI.
- Every output shows the calculation as ordered steps, each citing its event and anchor.
- Wording never says "the claim is prescribed" as a legal conclusion. It says: *"Computed limitation date — requires lawyer review."*

### 7.5 Sensitivity analysis

- For each **contested** event (an `ai_inferred` qualification, low confidence, or one the opposing party could dispute), run the engine with and without that event.
- Display: *"Hinges on: Email of 2 June 2022 (possible acknowledgment). With it: alive until 4 Oct 2027. Without it: time-barred since 15 Jul 2026."*
- Rank events by impact (days of difference, and whether the status flips).
- This tells the lawyer which facts to secure evidence for, and which ones the opposing party will attack.

### 7.6 Defendant status

- Look up the defendant by SIREN (business ID) via a company registry/BODACC data source (e.g. Pappers API, BODACC open data). For the demo, a mocked JSON response with the same shape is acceptable.
- Show: legal status (active / struck off), insolvency proceedings (type, judgment date, BODACC publication date, *mandataire judiciaire*), and the R5 deadlines with days left.
- If the defendant is in liquidation, show that the liquidator now represents the debtor (art. L641-9 C. com.).

### 7.7 Pre-filing memo

- Inputs: the claim, the confirmed events, the engine output, sensitivity results, defendant status.
- Sections:
  1. Claim summary
  2. Limitation analysis: event-by-event table with effect, rule and source
  3. Computed status and deadline
  4. What the conclusion hinges on
  5. Defendant status and its consequences
  6. Recommended next steps with dates
  7. Points for lawyer review
  8. Sources
- Case law may only be cited from a curated local list (`data/caselaw.json`); otherwise the model writes *[authority to add]*.
- Every sentence carrying a fact has a citation chip; uncited factual sentences are underlined amber.
- Editable; export as Markdown (DOCX if time allows).

## 8. Data model (sketch)

```ts
type Anchor = { doc: string; page: number; quote: string;
                span?: { start: number; end: number }; verified: boolean };

type Claim = { creditor: string; debtor: string; debtorSiren?: string; amountEur: number;
               dueDate: string; regime: 'civil' | 'commercial' | 'consumer'; anchors: Anchor[] };

type Effect = 'starts' | 'interrupts' | 'suspends' | 'suspension_ends' | 'no_effect' | 'bars_action';

type Event = {
  id: string;
  date: string;                       // ISO date, Europe/Paris
  docType: 'invoice' | 'contract' | 'email' | 'letter' | 'lrar' | 'mediation_agreement'
         | 'mediation_report' | 'court_act' | 'registry_record' | 'other';
  summary: string;
  anchors: Anchor[];
  qualification: {
    effect: Effect;
    rule: string;                     // e.g. "art. 2240 C. civ."
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
    source: 'rule' | 'ai_inferred';
    status: 'proposed' | 'confirmed' | 'rejected';
    note?: string;
  };
};

type EngineResult = {
  limitationDate: string;
  status: { kind: 'alive' | 'expires_today' | 'time_barred'; days: number; asOf: string };
  steps: { text: string; eventId?: string; rule?: string }[];
};

type Sensitivity = { eventId: string; withDate: string; withoutDate: string;
                     flipsStatus: boolean; deltaDays: number };
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
   Limitation engine (TS)       Sensitivity runner           Defendant status
   deterministic, pure          (engine × scenarios)         (registry API / mock)
             └───────────────────────────┼───────────────────────────┘
                                         ▼
                Web UI (timeline · deadline track · source · memo)
```

Suggested stack (the team may change it): React + TypeScript + Vite; `pdf.js` for the viewer; Tailwind + a headless component kit; a small charting or custom SVG layer for the deadline track; a thin API (Node or Python FastAPI) that calls the model provider and serves cached results. The engine runs client-side as a pure function, so recomputation is instant.

### 9.1 Model layer — Mistral first, provider-agnostic

- One interface, e.g. `ocr(doc)`, `extract(text, schema)`, `qualify(event, context, schema)`, `complete(messages, schema?)`.
- Default provider: **Mistral** — Mistral OCR for scans; a Mistral chat model with structured JSON output for extraction, qualification and the memo. Its French-language reasoning is the key strength here.
- Other providers are selectable via an env var: `CLAIMCLOCK_PROVIDER=mistral|openai|anthropic|local`. Any OpenAI-compatible endpoint should work, including self-hosted open-weight models.
- The limitation engine, the anchoring guard and the sensitivity runner never depend on the model provider.
- All model outputs are validated against the schema. On failure: retry once, then fall back to cached results.
- Pitch line: open weights allow on-premise deployment, which protects *secret professionnel*.

## 10. UI/UX requirements

UI/UX is a first-class deliverable. The product must feel like a **precise legal instrument**, not a chatbot.

### 10.1 Design principles

1. **Evidence first.** No claim without a visible source. One click from any event to the highlighted passage.
2. **Show your work.** Every date shows the rule and the calculation that produced it.
3. **AI is visibly labelled.** AI-inferred qualifications and draft prose carry a consistent *AI-inferred* marker; deterministic results do not.
4. **The lawyer decides.** AI qualifications are proposals until confirmed; every confirmation updates the result immediately.
5. **Calm density.** Information-rich but quiet: neutral palette, one accent colour per meaning, no gratuitous animation.

### 10.2 Layout (desktop, target 1440×900)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ClaimClock · Atelier Lumière v. Bâtiself   [Review | Deadline | Memo]   As of: 04 Oct 2026 │
│ Status: ● ALIVE — 365 days left   (hinges on 1 contested event)                         │
├────────────────┬──────────────────────────────────────┬──────────────────────┤
│ Events         │ Main panel                           │ Source viewer        │
│ (chronological)│ Review: event detail + qualification │ document, highlighted│
│ effect badges  │ Deadline: deadline track + scenarios │ passage, doc index   │
│                │ Memo: editor                         │                      │
└────────────────┴──────────────────────────────────────┴──────────────────────┘
```

- The **status banner** is always visible: it is the product's answer. Colour + icon + text, e.g. *ALIVE — 365 days left* / *TIME-BARRED since 15 Jul 2026*.
- Panels are resizable; the source viewer can collapse.
- The mode switcher is the primary navigation and follows the demo story (Review → Deadline → Memo).

### 10.3 Screens and key interactions

**Start screen**
- Large drop zone and a prominent **"Load sample file"** button (the demo path).
- Staged progress with live counters (documents read, events found, qualifications proposed). Never a spinner without words.

**Review mode**
- Event list: date, document-type icon, one-line summary, **effect badge** (*Starts*, *Interrupts*, *Suspends*, *No effect*, *Bars action*), and an *AI-inferred* marker where applicable.
- Event detail:
  - The quoted passage, in serif type, with a source chip (`Email · 02/06/2022 · p.1`) that highlights it in the viewer.
  - Proposed effect, rule, reasoning (2–3 lines), confidence.
  - Actions: **Confirm**, **Reject** (requires a short note), **Preview impact** (hover/press to show the deadline with and without this event).
- *No effect* events show an explicit **"Does not interrupt — art. 2240/2241 not met"** note, so the common misconception is visible.

**Deadline mode**
- **Deadline track**: a horizontal time axis from the start event to the computed limitation date.
  - Running periods = solid bar; suspension = hatched gap; interruption = a restart marker with a new bar; no-effect events = small grey ticks.
  - An "As of" marker (today line) and the **limitation-date marker**.
  - When a qualification is confirmed or rejected, the limitation-date marker **animates to its new position** (~400 ms) and the status banner updates. This is the key demo moment.
- **Calculation panel**: ordered steps in monospace, each with its rule and source chip.
- **Sensitivity panel**: contested events ranked by impact, each with *with / without* dates and a status-flip indicator. A toggle per event lets the lawyer explore scenarios without confirming anything.
- **Defendant card**: registry status, insolvency proceedings, R5 deadlines with a countdown (*Declare claim by 10 Nov 2026 — 37 days left*), and a "Data source: live / mocked" label.

**Memo mode**
- Structured document with the sections of §7.7; citation chips inline.
- Amber underline on factual sentences without a citation; tooltip "No source — verify or remove".
- Buttons: **Regenerate section**, **Copy**, **Export**.

### 10.4 Visual language

- Colours: neutral greys/ink; **green** = alive / safe margin; **red** = time-barred / action barred; **amber** = unverified, or under 90 days left; **violet** (or one other distinct hue) = AI-inferred. Colour is never the only signal: always add icons, patterns (hatched suspension) and labels.
- Typography: sans-serif for the UI; serif for document excerpts and the memo; monospace for dates and calculations.
- Dates in French format (`02/06/2022`) in content, and an unambiguous `2 Jun 2022` in UI chrome. Legal terms stay in French (*mise en demeure, fin de non-recevoir, mandataire judiciaire*); the UI chrome is in English. Source documents are in French.

### 10.5 States

- **Empty**: guidance + sample file button.
- **Loading**: staged progress and skeletons matching the final layout.
- **Unverified event**: amber badge; excluded from computation until confirmed.
- **Pending qualifications**: the banner shows *"Provisional — 2 qualifications awaiting review"*.
- **Model error / timeout**: non-blocking toast, automatic fallback to cache, labelled *"Showing cached analysis"*.
- **Registry unavailable**: card shows *"Defendant status not verified"* (never implies the defendant is solvent).

### 10.6 Accessibility and quality bar

- Keyboard: `J`/`K` move between events, `C` confirm, `R` reject, `1`/`2`/`3` switch modes, `Esc` closes popovers.
- WCAG AA contrast; visible focus rings.
- No layout shift when switching modes. Recomputation and UI responses take under 100 ms (model calls excluded).

### 10.7 Demo polish

- Precomputed results for the sample file; fixed as-of date for the demo (configurable).
- **Presenter mode**: larger font, hides dev controls.
- The 2-minute script in §12 must be executable in 8 clicks or fewer.

## 11. Synthetic client file

B2B unpaid-invoice dispute, French documents, all names fictitious. Dates assume a demo as-of date of **4 Oct 2026**; shift them if the demo date changes.

| # | Document | Date | Purpose |
|---|---|---|---|
| 1 | Supply contract, Atelier Lumière SAS → Bâtiself SARL | 2020-11-05 | Regime: commercial (both are merchants) → 5 years |
| 2 | Invoice F-2021-034, €18,400, due | 2021-03-15 | `starts` → base date 15 Mar 2026 |
| 3 | Debtor email: *"Nous contestons la conformité de la livraison."* | 2021-04-02 | **Distractor**: disputing the debt ≠ acknowledgment → `no_effect` |
| 4 | Debtor director's email: *"Nous réglerons le solde le mois prochain, merci de votre patience."* | 2022-06-02 | **Key contested event**: possible acknowledgment (art. 2240) → `interrupts`, AI-inferred |
| 5 | *Mise en demeure* sent by registered letter (LRAR) + scanned receipt | 2023-02-10 | **Misconception**: `no_effect` |
| 6 | Signed mediation agreement | 2024-01-15 | `suspends` |
| 7 | Mediator's report recording the failure | 2024-05-15 | `suspension_ends` |
| 8 | Registry/BODACC record: Bâtiself placed in *redressement judiciaire* (judgment 25 Aug 2026, published 10 Sep 2026) | 2026-09-10 | `bars_action` → declare by 10 Nov 2026 |

Expected engine results (to be validated by the legal reviewer):
- **Without #4:** 15 Mar 2026; the 4-month suspension pushes it to **15 Jul 2026** → *time-barred* as of 4 Oct 2026.
- **With #4 confirmed:** a new 5-year period from 2 Jun 2022 → 2 Jun 2027; the 4-month suspension pushes it to 2 Oct 2027 (a Saturday) → **4 Oct 2027** if the art. 642 CPC extension flag is on → *alive*.
- **R5:** suing for payment is barred anyway. **Declare the claim to the *mandataire judiciaire* by 10 Nov 2026 (37 days left).**
- #3 and #5 must not change the date.

Some documents should be lightly degraded scans (the LRAR receipt, the signed mediation agreement) to exercise OCR.

## 12. Demo script (2 minutes)

1. **Load sample file** → staged progress → events appear. Banner: *Provisional*.
2. The naive answer: invoice due 15 Mar 2021 + 5 years. The *mise en demeure* shows **"Does not interrupt"**. The mediation is shown as a hatched gap on the track. Banner: **TIME-BARRED since 15 Jul 2026**.
3. ClaimClock highlights the 2022 email: *AI-inferred — possible acknowledgment of debt (art. 2240)*. Click the source chip → the passage is highlighted.
4. Click **Confirm** → the limitation marker slides to **4 Oct 2027**, and the banner turns green: **ALIVE**. *"This claim lives or dies on one email."*
5. Defendant card: *redressement judiciaire* → **Don't file — declare the claim by 10 Nov 2026 (37 days left).**
6. **Memo** → source-cited pre-filing memo, ready to edit.
7. Close on the principle: *AI finds and qualifies the facts. Rules compute the deadline. Lawyers decide.*

## 13. Success criteria

- 100% of displayed events are anchored or marked *Unverified*.
- Every planted event is correctly qualified: the distractor and the *mise en demeure* produce no effect; the mediation suspends; the email is proposed as an acknowledgment.
- Engine results match §11 exactly; recomputation takes under 100 ms.
- The demo runs end-to-end in under 2 minutes, online or from cache.
- A lawyer on the jury can verify any date from the UI alone.

## 14. One-day plan

| Time | Legal | AI / backend | Frontend / UX |
|---|---|---|---|
| H0–1 | Fix the scenario, dates, and the rule specs | Provider interface, schemas | Layout shell, design tokens |
| H1–4 | Write the synthetic documents; expected results | Extraction + anchoring guard + qualification prompts | Event list, source viewer, event detail |
| H4–6 | Review the engine output against §11 | Limitation engine + unit tests, sensitivity runner, defendant mock | Deadline track + live recompute animation |
| H6–7 | Curated case-law list, memo review | Memo generation, cache | Memo mode, defendant card |
| H7–8 | Pitch | Hardening, fallback | Polish, presenter mode, rehearsal |

## 15. Risks and open questions

- **Art. 642 CPC extension** for limitation periods: confirm the default with the legal reviewer (it is a configurable flag).
- **Qualification quality** on ambiguous emails → strict JSON schema, few-shot examples, always lawyer-confirmed.
- **Special limitation regimes** (consumer, insurance, construction, employment) → out of scope; the regime is chosen explicitly, with the 3 regimes of R1 only.
- **Registry API access** (keys, rate limits) → a mocked response with the same shape is acceptable for the demo.
- **OCR coordinates**: if the chosen OCR returns no text-level positions, highlight via page + fuzzy quote match on the `pdf.js` text layer.
- **Over-claiming** → never say "the claim is prescribed" or "zero hallucination"; say "computed date, source-anchored, requires lawyer review".
- **Time** → R6, defendant mode, DOCX export and live upload are the first to cut.
