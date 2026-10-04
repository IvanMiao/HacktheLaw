# Domino — Find the domino that knocks out the claim

## Problem

In French civil procedure, admissibility comes before the merits. A single procedural slip can end a case — and the decisive issues are **chains**, not isolated checks:

> Writ (*assignation*) not filed with the registry in time → **caducité** → the writ's interruption of the limitation period is lost → the period kept running → **fin de non-recevoir** (art. 122 CPC) → claim inadmissible.

Each procedural sanction has its own regime: when it must be raised, whether prejudice must be shown, whether it can be cured, and what it does to the limitation period. They are easy to confuse — e.g. an **annulled** writ keeps its interruptive effect (art. 2241 al. 2 C. civ.), a **lapsed** one does not. The facts that trigger these chains are scattered across contracts, emails, writs and registry stamps.

Generic LLMs give fluent conclusions without showing which fact and which rule they rest on. Lawyers cannot rely on that.

## Solution

A web app that turns a case file into verifiable procedural consequence chains.

1. **Extract** — dated facts from contracts, invoices, emails, writs and court records. Each is linked to its exact passage; anything we cannot anchor is flagged *Unverified*.
2. **Qualify** — the AI answers the legal questions in the text: *lapsed or annulled? acknowledgment of debt or not? mandatory conciliation clause?* Ambiguous answers are labelled *AI-inferred* and require lawyer confirmation.
3. **Run the chains** — a deterministic engine evaluates a small chain library (writ lapse → limitation; mandatory prior conciliation; insolvency…) and computes every deadline, showing each step.
4. **Stress-test** — counterfactual toggles show which link each defence hinges on: *"If the 2022 email counts as an acknowledgment, this ground falls."*
5. **Memo** — a source-cited defence memo, with the arguments in the correct procedural order.

The same engine works for claimants, preventively: *"Place this writ by 12 Feb, or it lapses and your claim becomes time-barred."*

## Core principle

**AI finds and qualifies the facts. Rules run the chain. Lawyers decide.**

## Why Mistral (preferred, not required)

Strong French-language legal reasoning for qualifying documents, OCR for scanned stamps and court orders, structured outputs, and open weights deployable on-premise to protect *secret professionnel*. The model layer is provider-agnostic, so other models can be swapped in.

## 2-minute demo

1. Load a sample case: we defend a company sued for an unpaid invoice.
2. Chain C1 builds left to right: *writ placed 4 days late → caducité → interruption void → limitation expired → second writ out of time → fin de non-recevoir.* Click any node to see its source.
3. Toggle *"treat the 2022 email as an acknowledgment"* → the dominoes stand back up: this is where the claimant will attack.
4. Chain C2: an unimplemented mandatory conciliation clause → a second, independent ground.
5. Generate the defence memo.

## One-day scope

Web app; one synthetic case file (9 items); 2 chains + limitation engine; counterfactual toggles; source-anchored memo.

See [PRD.md](PRD.md) for the full product requirements.
