# Case integration plan

## Scope and dependencies
- Work only in the isolated case worktree on feature/domino-c3-c5-integration. Preserve manual voice, original combined C1/C2 sample and main EN/FR improvements. No push, deployment, main mutation or realtime worktree edits.
- Merge verified origin/main locally before implementation. Read immutable source DOCX; its TypeScript sketches are specifications, not drop-in code.

## Steps and functions
1. Merge and map React/TypeScript data flow, pure engines, i18n and bounded voice contract. Resolve merge conflicts preserving both features. Gate: baseline tests/build.
2. Test-first catalog and active dataset interfaces: four selectable datasets, independent facts, legal qualifications, synthetic anchored evidence, chains, regimes and memo. Gate: observed RED/GREEN catalog and engine tests.
3. Test-first legal chronology: independent insolvency payment stay and declaration consequences; objection timing only; raw/adjusted appeal deadline using France weekends/holidays and potential pre-order hypotheses. Correct source countdown in derived output, not DOCX. Gate: date and uncertainty tests plus official source checks where available.
4. Test-first UI dataset context/props and case-switch isolation. Remount case-local state, hypotheses, source/fact selection and bind voice context to case identity. Gate: state isolation tests.
5. Test-first server-known case-scoped voice schema/context validation. Reject foreign IDs and stale case identity, with citations restricted to active evidence. No provider secrets required. Coordinate App/contract conflicts with parent realtime worker.
6. Run all tests, build, lint and typecheck. Browser acceptance on isolated port 5174/session: all four cases, facts/source/memo/timeline, meaningful what-if, return original, EN/FR. Keep sanitized evidence ignored.
7. Commit local feature changes only and report exact merge/commit IDs, gates, caveats and integration touchpoints to parent.

## Parallelism
Official legal source retrieval can run alongside repository reads. Catalog/engines precede UI and voice validation; full gates precede browser acceptance and commit. Realtime voice streaming, VoicePanel, client transport and server launch remain owned by sibling worker.

## Legal review gates
Fixtures are explicitly SYNTHETIC, not official legal text. Relief is potential, not adjudicated. Timely objection removes timing bar only. Force majeure cannot undo existing lapse order; finality requires checking surviving incidental appeal. Procedural CPC 641/642 extension is independent from substantive limitation configuration. Unknown missing evidence is not definitive absence unless fixture author explicitly states the event absent.

## Completion
Merge commit 338c29b preserves both baselines. Catalog, independent legal engines, procedural calendar, active UI dataset, case-generation boundary and case-scoped voice schema/context are implemented. Observed RED/GREEN tests and all final gates passed: 68 tests / 14 files, build, backend typecheck, lint and native server import. Browser acceptance verified four datasets and all 32 exact fact anchors, case-specific fake-provider hypotheses/evidence, EN/FR, decision-preserving reset, case-switch isolation and delayed A→B→A rejection. Full source-check limitations and reproducible parent startup are recorded in CASE_INTEGRATION_VERIFICATION.md. Realtime files were not modified; parent combines its completed realtime lane and reruns integrated live acceptance.
