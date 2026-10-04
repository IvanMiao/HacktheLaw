# ProcGuard — Find the procedural flaw. Trace what falls with it.

## Problem

French criminal case files are hundreds of pages of procès-verbaux, often badly scanned. A defence lawyer's strongest lever is a **procedural nullity**: a search before consent or JLD authorisation, a late notice to the prosecutor, a custody extension without authorisation, a wiretap without a judge's order.

Two things are hard and slow:

1. **Spotting** the flaw buried in the timeline.
2. **Proving what depends on it.** Under art. 174 CPP, annulment extends only to acts for which the void act was the *support nécessaire*.

Generic LLMs summarise smoothly and hallucinate. In criminal defence, that is unacceptable.

## Solution

A web app that turns a case file into a verifiable procedural graph.

1. **Extract** — OCR + structured outputs pull events, timestamps, actors, authorisations, seized items and PV cross-references. Every fact links to its exact page and passage; anything we cannot anchor is flagged *Unverified*.
2. **Check** — a small deterministic rule engine (3–4 CPP rules) flags irregularities, showing the rule, the timestamps and the calculation.
3. **Trace impact** — a dependency graph (`Search → Phone → Messages → Wiretap`) shows the "blast radius" of a flawed act. Edges are typed *explicit / produced / derived / possible*; only *possible* edges come from LLM inference.
4. **Find independent sources** — the LLM searches for evidence that independently supports a downstream act, breaking the *support nécessaire* chain. This tells the lawyer which arguments actually hold.
5. **Build argument** — a source-backed draft: facts, pages, rule, affected acts, counter-evidence, editable outline. Case law is cited only from a curated set.

## Core principle

**AI finds the facts. Rules test the procedure. Lawyers decide the law.**

## Why Mistral (preferred, not required)

Strong OCR on messy French scans, structured outputs, and open weights deployable on-premise to protect *secret professionnel*. The model layer is provider-agnostic, so other models can be swapped in.

## 2-minute demo

1. Upload a synthetic 30-page dossier.
2. The timeline appears; one act is flagged: *search started 09:45, written consent signed 10:00.*
3. Click the alert → source passages, rule (art. 76 CPP), calculation.
4. **Analyze Impact** → the downstream chain lights up.
5. ProcGuard finds an independent witness statement → one branch survives.
6. **Build Argument** → draft ready.

## One-day scope

Web app (no desktop shell), one synthetic dossier, 3–4 hard-coded rules, 5–8 graph nodes, source highlighting via page + quote matching.

See [PRD.md](PRD.md) for the full product requirements.
