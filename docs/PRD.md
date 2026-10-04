# ProcGuard — Product Requirements Document

> Mistral x Law hackathon (one day). Status: draft v0.1.
> Legal references below must be checked by a lawyer on the team before the demo.

## 1. Summary

ProcGuard is a web app for French criminal defence lawyers. It turns a criminal case file (PDF scans of procès-verbaux) into a **source-anchored procedural timeline and dependency graph**, flags procedural irregularities with deterministic rules, traces which downstream acts depend on a flawed act, and drafts a source-backed nullity argument.

**Principle:** AI finds the facts. Rules test the procedure. Lawyers decide the law.

## 2. Problem

- Case files are long, scanned, and fragmented across many PVs.
- Procedural nullities (arts. 171, 173, 174, 385, 802 CPP) are the defence's strongest lever, but finding them means rebuilding the timeline by hand.
- Annulment extends only to acts for which the void act was the *support nécessaire* (art. 174 CPP and case law). Mapping that dependency, and spotting independent sources that save downstream evidence, is slow and error-prone.
- Generic LLM summaries fill gaps with plausible fiction. Lawyers cannot trust output they cannot verify.

## 3. Goals and non-goals

**Goals (hackathon)**

1. Every extracted fact is linked to a page and verbatim passage, or visibly marked *Unverified*.
2. Detect 3–4 procedural irregularities in a synthetic dossier with deterministic, explainable rules.
3. Show the downstream "blast radius" of a flagged act and at least one independent source.
4. Generate an editable, source-cited argument outline.
5. A polished, calm, trustworthy UI that a lawyer understands in 10 seconds.

**Non-goals**

- Deciding whether a nullity will succeed; giving legal advice.
- Full CPP coverage; real client data; desktop packaging; authentication; multi-user.

## 4. Users

| Persona | Need |
|---|---|
| **Defence lawyer** (counsel for a *mis en examen* or *prévenu*) | Find the weak point fast, verify it, and build a requête en nullité / conclusions in limine litis. |
| **Junior associate / paralegal** | Rebuild the timeline and dossier index without missing a page. |
| **Hackathon jury** (lawyers + Mistral) | See legal soundness, verifiability, and a clear role for the model in under 2 minutes. |

## 5. User stories

1. As a lawyer, I upload a dossier and see a timeline of procedural acts with their sources.
2. As a lawyer, I see a list of alerts ranked by severity, each with the rule, the facts, and the calculation.
3. As a lawyer, I click any fact and the source PDF scrolls to the highlighted passage.
4. As a lawyer, I select a flagged act and see every downstream act that may depend on it, and why.
5. As a lawyer, I see which downstream acts are also supported by an independent source.
6. As a lawyer, I confirm or dismiss an alert and add a note.
7. As a lawyer, I generate an argument outline for a confirmed alert, edit it, and export it.

## 6. Scope

**Must (demo-critical)**

- Load the bundled synthetic dossier (one click) and optionally upload a PDF.
- OCR + structured extraction of events with page + quote anchors.
- Quote verification against the source text; unmatched → *Unverified*.
- Rules R1–R3 (see §7.3).
- Timeline view, alert list, alert detail, source viewer with highlight.
- Dependency graph with Impact mode and independent-source detection.
- Argument draft with citation chips; copy / Markdown export.
- Precomputed cache so the demo runs offline if the model API fails.

**Should**

- Rule R4. Confirm / dismiss alert with note. DOCX export. FR/EN UI toggle.

**Could**

- Live upload of a second dossier. Side-by-side "plain LLM summary vs ProcGuard" comparison.

## 7. Functional requirements

### 7.1 Ingestion

- Input: PDF (scanned or born-digital), up to ~50 pages for the demo.
- If a text layer exists, use it; otherwise OCR. Keep per-page text and, if available, line/word coordinates.
- Show staged progress: *Reading pages → Extracting facts → Checking procedure → Building graph*.

### 7.2 Extraction

The model returns JSON validated against a schema (§8). For each **Event**: type, start/end datetime, actors, legal basis invoked, references to other PVs, and one or more **anchors** `{page, quote}`.

**Anchoring guard (model-agnostic):** each `quote` is fuzzy-matched against the page text (normalised whitespace/accents, threshold ~0.9). Matched → highlight span stored. Not matched → fact kept but marked *Unverified* and excluded from rule evaluation unless the lawyer confirms it.

### 7.3 Rule engine (deterministic, no LLM)

Each rule declares inputs, logic, legal reference, and produces an **Alert** with the computed values.

| ID | Rule | Logic (simplified) | Ref. |
|---|---|---|---|
| R1 | Search before consent / authorisation (enquête préliminaire) | `search.start < consent.signed_at` (and no JLD order before `search.start`) | art. 76 CPP |
| R2 | Custody extended without timely prosecutor authorisation | duration > 24h and (no authorisation, or `authorisation.at > custody.start + 24h`) | art. 63 II CPP |
| R3 | Late notification of rights | `rights_notified.at − custody.start > threshold` with no stated justification | art. 63-1 CPP |
| R4 | Interception without judicial authorisation | `interception.start` not covered by a JLD / juge d'instruction order | arts. 100, 706-95 CPP |

- Also emit **Missing document** alerts when an act references an authorisation that is not found in the dossier.
- Each alert shows: severity, rule text, the input facts with anchors, and the step-by-step calculation.
- Alerts never state "the act is void". Wording: *"Potential irregularity — requires lawyer review."*
- Note for the argument stage: grief (art. 802 CPP) and the client's standing to invoke the nullity must be addressed by the lawyer.

### 7.4 Dependency graph

- Nodes: procedural acts and evidence items (audition, search, seizure, phone extraction, messages, interception, etc.).
- Edges with type and justification:
  - **explicit** — document cites the other act ("vu le PV n°…") — rule/regex-detected.
  - **produced** — item seized/created by the act.
  - **derived** — analysis performed on a produced item.
  - **possible** — model-inferred link; always labelled *AI-inferred*.
- Every edge links to its anchor(s).

### 7.5 Impact analysis

- Select a flagged act → traverse downstream edges → mark nodes **At risk**.
- For each at-risk node, search for **independent support** (another act/evidence with its own anchors that could sustain it). Found → node marked **Independently supported**, with the source.
- Output: counts (at risk / independently supported), list with reasons.

### 7.6 Argument builder

- Input: one confirmed alert + its impact analysis.
- Output sections: Facts (with anchors) · Applicable rule · Irregularity · Downstream acts · Counter-evidence / independent sources · Points the lawyer must establish (grief, standing) · Draft outline.
- Case law may only be cited from a curated local list (`data/caselaw.json`); otherwise the model writes *[authority to add]*.
- Every sentence carrying a fact has a citation chip; uncited factual sentences are underlined amber.
- Editable; export as Markdown (DOCX if time allows).

## 8. Data model (sketch)

```ts
type Anchor = { page: number; quote: string; span?: { start: number; end: number }; verified: boolean };

type Event = {
  id: string;
  type: 'custody_start' | 'rights_notified' | 'prosecutor_notified' | 'custody_extension'
      | 'audition' | 'consent' | 'jld_order' | 'search' | 'seizure'
      | 'phone_extraction' | 'interception' | 'witness_statement' | 'other';
  start?: string; end?: string;            // ISO datetime, Europe/Paris
  actors: string[];
  pvRef?: string;                           // e.g. "PV n°2024/0457"
  references: string[];                     // pvRefs cited by this act
  anchors: Anchor[];
};

type Edge = { from: string; to: string; kind: 'explicit' | 'produced' | 'derived' | 'possible';
              reason: string; anchors: Anchor[] };

type Alert = { id: string; ruleId: string; severity: 'high' | 'medium' | 'low';
               title: string; eventIds: string[]; calculation: string[];
               status: 'open' | 'confirmed' | 'dismissed'; note?: string };
```

## 9. Architecture

```
PDF ─▶ Text layer / OCR ─▶ Structured extraction (LLM, JSON schema)
                                   │
                                   ▼
                       Anchoring guard (fuzzy quote match)
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       Rule engine (TS/Py)   Graph builder        Independent-source
       deterministic          explicit+produced    search (LLM, anchored)
                              +derived (rules)
                              +possible (LLM)
              └────────────────────┼────────────────────┘
                                   ▼
                     Web UI (timeline · graph · source · argument)
```

Suggested stack (team may change): React + TypeScript + Vite, `pdf.js` for the viewer, React Flow for the graph, Tailwind + a headless component kit; a thin API (Node or Python FastAPI) that calls the model provider and serves cached results.

### 9.1 Model layer — Mistral first, provider-agnostic

- One interface, e.g. `ocr(pdf)`, `extract(text, schema)`, `complete(messages, schema?)`.
- Default provider: **Mistral** (Mistral OCR for scans; a Mistral chat model with JSON/structured output for extraction, edges and drafting).
- Alternative providers selectable by env var (`PROCGUARD_PROVIDER=mistral|openai|anthropic|local`). Any OpenAI-compatible endpoint (incl. self-hosted open-weight models) should work.
- Rule engine, anchoring guard and graph traversal never depend on the provider.
- All model outputs are schema-validated; on failure → retry once → fall back to cached results.
- Pitch line: open weights allow on-premise deployment to protect *secret professionnel*.

## 10. UI/UX requirements

UI/UX is a first-class deliverable. The product must feel like a **precise legal instrument**, not a chatbot.

### 10.1 Design principles

1. **Evidence first.** No claim without a visible source. One click from any fact to the highlighted passage.
2. **Show your work.** Every alert exposes rule, inputs, and calculation.
3. **AI is visibly labelled.** Model-inferred content (possible edges, draft prose) carries a consistent *AI-inferred* marker; deterministic results do not.
4. **The lawyer decides.** Alerts are "potential"; the lawyer confirms or dismisses.
5. **Calm density.** Information-rich but quiet: neutral palette, one accent per meaning, no gratuitous animation.

### 10.2 Layout (desktop, target 1440×900)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ProcGuard · Dossier "Affaire X"   [Review | Impact | Argument]  142 facts · 4 unverified │
├───────────────┬─────────────────────────────────┬─────────────────────────┤
│ Timeline      │ Main panel                      │ Source viewer           │
│ (by day/hour) │ Review: alert list + detail     │ PDF page, highlighted   │
│ alert badges  │ Impact: dependency graph        │ passage, page nav,      │
│               │ Argument: editor                │ PV index                │
└───────────────┴─────────────────────────────────┴─────────────────────────┘
```

- Panels are resizable; the source viewer can collapse.
- The mode switcher is the primary navigation and matches the demo story (Review → Impact → Argument).

### 10.3 Screens and key interactions

**Start screen**
- Large drop zone + prominent **"Load sample dossier"** button (demo path).
- Staged progress with live counters (pages read, facts extracted, alerts found). No spinner without words.

**Review mode**
- Alert list sorted by severity; each card shows title, rule ref, involved PVs, status.
- Alert detail:
  - **Time ruler**: the two conflicting timestamps on a mini axis, gap highlighted (e.g. *search 09:45 ◀ 15 min ▶ consent 10:00*).
  - **Calculation** block, step by step, monospace.
  - **Source chips** (`PV 12 · p. 7`) — click to highlight in the viewer.
  - Actions: **Confirm**, **Dismiss** (requires a short note), **Analyze impact**.
- Timeline: vertical, grouped by day, icon per event type; selecting an alert highlights its events.

**Impact mode**
- Graph centred on the selected act; downstream propagation animates in sequence (~150 ms per hop).
- Node states: *Flagged* (red outline), *At risk* (red fill, light), *Independently supported* (green), *Neutral* (grey).
- Edge styles: explicit = solid, produced = solid with arrow-dot, derived = dashed, possible = dotted + *AI-inferred* tag.
- Click edge → popover with reason + anchors. Click node → event details + sources.
- Summary bar: *"5 acts at risk · 1 independently supported"*.
- Legend always visible.

**Argument mode**
- Structured document with the sections of §7.6; citation chips inline.
- Amber underline on factual sentences without a citation; tooltip "No source — verify or remove".
- Buttons: **Regenerate section**, **Copy**, **Export**.

### 10.4 Visual language

- Colours: neutral greys/ink; **red** = irregularity / at risk; **green** = independently supported; **amber** = unverified / needs attention; **violet** (or one distinct hue) = AI-inferred. Colour is never the only signal (icons + line styles + labels).
- Typography: sans-serif for UI; serif for document excerpts and the argument draft; monospace for timestamps and calculations.
- Legal terms stay in French in the UI (*procès-verbal, garde à vue, JLD*), with English UI chrome. Dossier content is French.

### 10.5 States

- **Empty**: guidance + sample dossier button.
- **Loading**: staged progress and skeletons that match the final layout.
- **Unverified fact**: amber badge, excluded from rules until confirmed.
- **Model error / timeout**: non-blocking toast, automatic fallback to cache, label *"Showing cached analysis"*.
- **No alerts**: explicit "No irregularity detected by the 4 enabled rules" (never imply the file is clean).

### 10.6 Accessibility and quality bar

- Keyboard: `J/K` move between alerts, `Enter` open, `1/2/3` switch modes, `Esc` close popovers.
- WCAG AA contrast; focus rings visible.
- No layout shift when switching modes; interactions respond in < 100 ms (model calls excluded).

### 10.7 Demo polish

- Precomputed results for the sample dossier; deterministic layout of the graph (fixed seed/positions).
- **Presenter mode** (larger font, hides dev controls).
- The 2-minute script in §12 must be executable with ≤ 8 clicks.

## 11. Synthetic dossier

- ~30 pages, French, styled like real PVs (headers, PV numbers, signatures, times), with some pages degraded (skew, noise) to show OCR.
- Planted facts:
  - R1: search starts 09:45, written consent signed 10:00.
  - R2 or R3: one custody-timing issue.
  - Chain: audition → search → phone seizure → message extraction → interception.
  - One independent witness statement that supports a downstream act.
  - One referenced authorisation that is missing (Missing document alert).
  - One distractor that looks suspicious but is lawful (shows the rules are precise).
- All names and places fictitious.

## 12. Demo script (2 minutes)

1. Load the sample dossier → staged progress → timeline appears.
2. Top alert: *Search before consent* → time ruler, calculation, click source chip → passage highlighted.
3. **Analyze impact** → chain lights up; summary "5 at risk · 1 independently supported".
4. Click the green node → the independent witness statement.
5. **Build argument** → structured draft with citation chips.
6. Close on the principle: *AI finds the facts. Rules test the procedure. Lawyers decide the law.*

## 13. Success criteria

- 100% of displayed facts anchored or marked *Unverified*.
- All planted irregularities detected; zero false alerts on the distractor.
- Demo runs end-to-end in < 2 minutes, online or from cache.
- A lawyer on the jury can verify any alert from the UI alone.

## 14. One-day plan

| Time | Legal | AI / backend | Frontend / UX |
|---|---|---|---|
| H0–1 | Draft dossier facts + rule specs | Provider interface, schema | Layout shell, design tokens |
| H1–4 | Write dossier PDF | OCR + extraction + anchoring guard | Timeline, source viewer, alert detail |
| H4–6 | Review rules & wording | Rule engine, graph builder, independent-source search | Graph + Impact mode |
| H6–7 | Curated case-law list, argument review | Argument generation, cache | Argument mode |
| H7–8 | Pitch | Hardening, fallback | Polish, presenter mode, rehearsal |

## 15. Risks and open questions

- **OCR coordinates**: does the chosen OCR return text-level positions? If not, highlight via page + fuzzy quote match on the `pdf.js` text layer.
- **Extraction quality on degraded scans** → keep a born-digital fallback of the dossier.
- **Legal accuracy** of rule wording and article numbers → lawyer review before demo.
- **Over-claiming** → never say "void" or "zero hallucination"; say "source-anchored or flagged".
- **Time** → R4, DOCX export and live upload are first to cut.
