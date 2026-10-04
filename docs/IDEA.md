# ClaimClock — Is this claim still alive?

## Problem

Before filing a civil or commercial claim in France, a lawyer must know whether it is time-barred. Missing a deadline means a *fin de non-recevoir*: dismissal without the merits ever being heard — and one of the most common sources of professional liability claims against lawyers.

The limitation date is rarely "due date + 5 years". It depends on events buried in emails and letters:

- an **acknowledgment of the debt** restarts the clock (art. 2240 C. civ.);
- **mediation** pauses it (art. 2238);
- a plain **formal notice does not interrupt it** — a common mistake.

Meanwhile, the defendant may have entered insolvency proceedings. Suing is then barred (art. L622-21 C. com.), and the claim must be declared within 2 months of the BODACC publication.

Generic LLMs give confident dates without showing their reasoning. Lawyers cannot rely on that.

## Solution

A web app that turns a client file into a verifiable deadline analysis.

1. **Extract** — dated events from contracts, invoices, emails and letters. Each is linked to its exact passage; anything we cannot anchor is flagged *Unverified*.
2. **Qualify** — the AI proposes each event's legal effect: *starts / interrupts / suspends / no effect / bars action*. Ambiguous ones (e.g. *"we'll settle the balance next month"*) are labelled *AI-inferred* and require lawyer confirmation.
3. **Compute** — a deterministic engine calculates the limitation date and the status (*alive, N days left* / *time-barred since…*), showing every step.
4. **Stress-test** — sensitivity analysis shows what the conclusion hinges on: *"Without this email, the claim is time-barred."*
5. **Check the defendant** — company registry/BODACC lookup for insolvency proceedings and the claim-declaration deadline.
6. **Memo** — a source-cited pre-filing memo, editable.

The same engine works for the defence: find the *fin de non-recevoir* in the opposing claim.

## Core principle

**AI finds and qualifies the facts. Rules compute the deadline. Lawyers decide.**

## Why Mistral (preferred, not required)

Strong French-language legal reasoning for qualifying ambiguous correspondence, OCR for scanned letters, structured outputs, and open weights deployable on-premise to protect *secret professionnel*. The model layer is provider-agnostic, so other models can be swapped in.

## 2-minute demo

1. Load a sample unpaid-invoice file. The *mise en demeure* is flagged **"Does not interrupt"**; the mediation shows as a pause. Status: **TIME-BARRED**.
2. ClaimClock flags a 2022 email as a possible acknowledgment of debt → **Confirm** → the deadline slides to 2027. Status: **ALIVE**. *This claim lives or dies on one email.*
3. Twist: the defendant is in *redressement judiciaire* → **Don't sue — declare the claim within 37 days.**
4. Generate the pre-filing memo.

## One-day scope

Web app; one synthetic client file (8 documents); 5 deterministic rules; live recomputation; mocked registry lookup if needed.

See [PRD.md](PRD.md) for the full product requirements.
