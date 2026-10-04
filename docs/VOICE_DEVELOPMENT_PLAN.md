# Domino Mistral Voice Interaction Implementation Plan

> **For Hermes:** Implement task-by-task with test-driven-development and subagent-driven-development; require specification review and code-quality review before acceptance.

**Goal:** Add verifiable voice-driven evidence navigation and hypothetical procedural-chain evaluation to the teammate's existing Domino demo without changing confirmed legal facts or its deployed branch.

**Architecture:** Browser audio is recorded only after an explicit user gesture, sent to a server-side Mistral transcription adapter, and converted by a Mistral chat model into a constrained command. Validated commands drive existing React navigation and pure chain evaluation; hypothetical overrides remain separate from lawyer decisions. Source-linked explanations derive from the actual engine and supplied documents, not an unconstrained legal answer.

**Tech Stack:** Existing React 19, TypeScript 6, Vite 8, Vitest 5; browser MediaRecorder/getUserMedia; thin Node HTTP/fetch backend; hosted Mistral bounded-file Voxtral transcription and chat structured intent output. Optional speech output is not a release blocker.

## 1. Baseline and authorization boundaries

- Repository: IvanMiao/HacktheLaw.
- Source branch: devin/1791112433-domino-demo.
- Source commit: f8f24d210f8154d04395f03290701c332a7e57e1.
- Working branch: feature/mistral-voice-interaction.
- Local worktree: /Users/fqn/Documents/HermesAnywhere/HacktheLaw-voice.
- Preserve existing Facts, Chains, Memo, source highlighting, C1/C2 calculations, and manual review controls.
- Local code, tests, documentation, and small live API verification are authorized. Pushing, merging, deploying, and changing the teammate's live service are separate authorization gates.
- A key is available only through ignored server-side environment configuration. Never print, commit, embed, or send it to the browser. It was disclosed in chat; rotation remains advisable.
- User requested this outline after implementation began: existing work is provisional and must pass the gates below. This document does not retroactively claim plan-first development.

## 2. Functional scope

Required:
1. Explicit microphone start/stop, recording and processing indicators, cancellation and cleanup.
2. Visible editable transcript and text-command fallback.
3. Real Mistral transcription and real Mistral command interpretation.
4. Evidence navigation and engine-grounded explanation.
5. Preview scenarios for existing qualifications, including email acknowledgment and prior conciliation.
6. Idempotent scenario application and reset without mutating decisions.
7. Explicit hypothetical state, supported-scope warning, transparent provider errors.
8. English/French command understanding and English/Chinese command-panel labels where practical.
9. Reproducible sanitized acceptance evidence and regression gates.

Secondary: challenge-defence suggestions strictly tied to enabled chain links, not fabricated evidence or probabilities. If supported, test and document separately.

Not required for this release: continuous listening, realtime WebSockets, voice cloning, autonomous legal confirmation, new substantive rules, replacing the synthetic demo with real-case replay, or deploying to production.

## 3. Milestones and development tasks

Each code-producing task follows: write behavior test -> observe expected RED -> minimal implementation -> targeted GREEN -> regression checks. Preserve real outputs; do not mark a milestone complete based on writing files alone.

### M0: Establish baseline and contract

**Function:** Freeze source version, prove existing demo works, define permitted voice actions and error states.
**Files:** Existing web/package.json, web/src/App.tsx, web/src/engine/chains.ts, web/src/data/case.ts; create web/src/voice/contract.ts and contract tests (may be included in commands.test.ts).
**Technology:** Git worktree, existing Vitest, runtime TypeScript validators.
**Dependencies:** Access to teammate branch; no API key or microphone required.
**Steps:** Inspect branch/status -> npm ci -> baseline npm test/build/lint -> define action union and known ID validation -> test unauthorized/unknown fields -> implement validators.
**Acceptance:** Baseline preserved; only allowlisted actions can execute. Arbitrary action names, unknown IDs, nonboolean overrides, and confirmation requests fail closed.
**Parallelism:** Must precede shared integration. After command schema freezes, backend and frontend lanes can proceed in parallel.

### M1A: Deterministic command-to-engine adapter

**Function:** Navigate evidence, preview a hypothesis, restore actual state, explain affected chain links.
**Files:** web/src/voice/commands.ts, web/src/voice/commands.test.ts; use existing engine/chains.ts without rewriting legal rules.
**Technology:** Pure state transformation and context builder based on existing qualifications, links and documents.
**Dependencies:** M0 schema and existing engine/data contracts.
**Steps:** Test repeated preview remains active -> test decisions unchanged -> test reset clears only whatIf -> test IDs/evidence mapping -> implement state adapter -> test C1/C2 independently -> implement engine-grounded summaries.
**Acceptance:** Repeated commands are idempotent; before/after decisions deep-equal; email preview changes C1 as expected and does not break C2; conciliation preview changes C2; reset restores baseline chain statuses. Explanations cite actual supplied source IDs and do not certify overall admissibility.
**Parallelism:** Independent of M1B and UI styling once M0 freezes; only this lane owns state adapter files.

### M1B: Server-side Mistral adapters

**Function:** Transcribe a bounded audio clip; interpret transcript into validated command; expose configured/error status.
**Files:** web/server/api.ts and web/server/api.test.ts; server launcher as needed; web/package.json scripts; web/vite.config.ts proxy; ignored .env.local and placeholder environment template.
**Technology:** Node HTTP/fetch, multipart upstream transcription, Mistral chat JSON/structured output, abort timeouts. Confirm official endpoint/model contract before coding; retain exact successfully tested model IDs in docs/evidence.
**Dependencies:** M0 command schema; key required only for live calls; local server runtime. Do not expose unprotected key-backed endpoints publicly.
**Steps:** Test missing-key error -> test MIME/body size validation -> test non-2xx/timeout/invalid model output -> implement provider adapter -> validate command against supplied known IDs -> validate supplied context server-side -> wire local proxy.
**Acceptance:** Real response is never replaced silently by cached or fake output. No secret in response/log/client build. Audio limits, timeouts and error messages are explicit. No arbitrary tools or remote URL execution.
**Parallelism:** Can run alongside M1A and M2A; avoid competing edits to package.json/vite config.

### M2A: Audio capture and client lifecycle

**Function:** Start/stop recording, release tracks, upload audio, edit transcript, recover from permissions/provider errors.
**Files:** web/src/voice/client.ts, web/src/voice/client.test.ts; capture module if separate.
**Technology:** getUserMedia + MediaRecorder, browser supported MIME negotiation, FormData or explicitly documented upload format, AbortController.
**Dependencies:** M0 error contract; M1B endpoint contract. UI can be built against an explicitly injected test adapter while backend is developed.
**Steps:** Test unsupported media and denial -> test stop/cancel cleanup -> test upload/error handling -> implement capture -> test stale requests cannot execute after cancellation.
**Acceptance:** Microphone requires explicit user interaction; tracks stop on cancellation/unmount; transcript remains inspectable; audio/provider errors do not change legal state; text fallback works without microphone.
**Parallelism:** Can run alongside M1A/M1B; owns client lifecycle files only.

### M2B: Compact command panel and application integration

**Function:** A calm accessible panel for microphone/text commands, status, transcript, explanation, evidence and scenario controls.
**Files:** web/src/components/VoicePanel.tsx and VoicePanel.test.tsx; web/src/App.tsx; web/src/index.css.
**Technology:** React callbacks wired to existing navigation/state; semantic buttons/status regions; restrained styling matching teammate UI.
**Dependencies:** M1A state adapter, M2A client lifecycle and M1B server endpoint. Panel structure/styles can proceed early; final wiring is serial.
**Steps:** Test rendering fallback -> implement panel -> test action dispatch and error recovery -> wire source navigation -> wire preview/reset -> test transcript input does not trigger global legal-confirmation shortcuts -> verify narrow and desktop layouts.
**Acceptance:** User can see transcript, intended action and resulting chain status; scenarios are visibly hypothetical; voice cannot confirm/reject facts. Existing keyboard, manual review, source viewer and memo remain operational. Entering text must not activate app-level review shortcuts.
**Parallelism:** Styles and panel shell can run in parallel; App.tsx has one integration owner.

### M3: Live provider and browser acceptance

**Function:** Prove the complete chain using actual provider calls and a running application.
**Files:** Sanitized evidence under an ignored project-local verification directory; reproducible smoke script if useful; acceptance checklist in web/README.md.
**Technology:** Actual local backend HTTP requests, generated non-sensitive spoken audio, Mistral STT/chat, browser DOM assertions. Synthetic browser microphone input is allowed for automation and must be labeled as synthetic.
**Dependencies:** M1 and M2 integrated; valid key; network; browser microphone API available on localhost/HTTPS.
**Steps:** Generate short audio (not real user recording) -> POST through actual backend -> retain provider status/request metadata and transcript -> interpret real transcript -> apply command to actual engine -> assert state invariants -> run browser evidence/preview/reset workflow -> verify error fallback and source highlighting.
**Acceptance:** Real generated-audio -> Voxtral transcript -> real Mistral intent -> actual engine status transition succeeds. Browser DOM reflects evidence navigation and scenario update/reset. Preserve sanitised before/after chain statuses, decisions equality, transcript and action. Mock tests are listed separately. Actual human microphone cannot be claimed verified unless the user exercises it or a consented real test occurs. Provider/network failures must be reported as blockers, not simulated successes.
**Parallelism:** Backend live probes and browser scripted tests can run in parallel after integration; share no mutable scenarios without isolated sessions.

### M4: Review, regression, documentation and local delivery

**Function:** Deliver a reproducible, clean feature branch ready for acceptance.
**Files:** web/README.md, environment template, this plan, feature source/tests; no secrets or raw provider dumps.
**Technology:** npm test, npm run build, npm run lint, git diff/status and secret checks; independent specification/code-quality review.
**Dependencies:** All required M0-M3 gates.
**Steps:** Run complete gates -> inspect changed files/build for secrets -> review supported scope and legal labels -> document startup/environment/limitations -> commit on feature branch -> parent verifies commit, gates, provider/browser evidence and actual backend health.
**Acceptance:** Regression tests pass; type/build/lint pass; no committed key/audio personal data; exact startup steps work; feature commit and branch reported. Outstanding real human mic or remote deployment checks explicitly listed. No remote mutation without authorization.
**Parallelism:** Docs and security review can run during M3; final acceptance and commit are serial gates.

## 4. Dependency graph and ownership

M0 -> [M1A || M1B || M2A || panel shell/styles] -> M2B integration -> M3 live acceptance -> M4 final gate.

Safe parallel workstreams:
- Engine/command contract tests and state adapter.
- Server provider adapters and request validation.
- Browser recording lifecycle and panel shell.
- Documentation/acceptance script design once contracts settle.

Serial boundaries:
- Do not wire UI before known-ID/action contracts are fixed.
- Do not start final live acceptance before real provider path and application integration exist.
- Do not treat frontend-only success as provider verification.
- One owner edits App.tsx; one owner edits package/config at a time.
- Final commit follows verification, and parent readback follows any externally published artifact.

## 5. Acceptance checklist

### Functional Acceptance
- [x] Baseline synthetic demo is preserved.
- [x] Actual Mistral STT returns intelligible transcript from generated spoken audio.
- [x] Actual Mistral intent request returns a supported validated action.
- [x] End-to-end action uses existing engine rather than model-provided calculations.
- [x] Email hypothesis changes C1 while C2 is unaffected.
- [x] Prior-conciliation hypothesis changes C2.
- [x] Repeat preview is idempotent.
- [x] Scenario reset restores baseline and preserves lawyer decisions.
- [x] Evidence command opens actual source and highlighted passage in DOM.
- [x] Unsupported requests and provider failure do not mutate legal state.
- [x] Mic permissions/cancel/error recovery and text fallback are covered.
- [x] Synthetic audio/mic tests are distinguished from human-microphone verification.

### Code Quality and Cleanliness Acceptance
- [x] Expected RED and GREEN outputs exist for newly implemented behavior.
- [x] Full Vitest regression passes.
- [x] TypeScript/Vite build passes.
- [x] Lint passes; runtime warnings are documented and fixed where feasible.
- [x] Server validates inbound context/action IDs and provider output.
- [x] No exposed credentials, server key in frontend bundle, or committed local .env.
- [x] Recording resources and stale requests are cleaned up.
- [x] README startup instructions and placeholders match actual implementation.
- [ ] Local feature commit and evidence verified independently by parent.

## 6. Demo acceptance script

1. Load existing sample case and open Chains.
2. Speak or type: "Show me the mandatory conciliation clause." Verify source navigation and original passage.
3. Speak: "Suppose conciliation was attempted before filing." Inspect transcript, hypothetical label and C2 transition.
4. Speak: "Treat the 2022 email as an acknowledgment of debt." Verify C1 transition and independent C2 state.
5. Repeat the same command. Scenario must not toggle off.
6. Speak: "Reset the scenario." Verify original statuses and unchanged decisions.
7. Request an unsupported legal conclusion. App should clarify its scope rather than certify an outcome.
8. Disable provider/microphone access. Show explicit error and usable text/manual controls; no hidden fabricated fallback.

## 7. Completion report requirements

Report exact commit/branch, test count, build/lint outcomes, real provider and browser evidence paths, startup URLs and commands, supported actions, and all remaining blockers. Do not claim deployment, production readiness, human microphone acceptance or legal correctness beyond evidence actually obtained.
