# Domino — web demo

The original teammate demo remains intact: precomputed fact qualifications, deterministic C1/C2 chains, limitation calculations, source highlighting, manual lawyer review, counterfactual controls and the memo. The **command desk** adds real hosted Mistral speech transcription and structured command interpretation; it does not replace the synthetic case or legal engine.

## Run locally

Use Node **24.12+** or **26+** (supported by the existing Vitest dependency). This implementation was exercised on Node 25.8.0; `npm ci` emits the existing Vitest engine warning there, but all gates pass. Native Node TypeScript stripping is used for the small backend; no backend dependencies were added.

From `web/`:

1. `npm ci`
2. Create `.env.local` using `.env.example` as the template and set `MISTRAL_API_KEY` securely. Keep it server-only; never name a secret `VITE_*`. `.env`, `.env.*` and verification artifacts are ignored; `.env.example` has no secret.
3. Terminal A: `npm run voice:server` — loopback API at http://127.0.0.1:8787. The launcher reads `.env` and `.env.local`; exported environment values take precedence. Missing configuration is reported, not silently simulated.
4. Terminal B: `npm run dev` — http://localhost:5173. Keep port 5173 available; the backend only accepts browser origins `localhost:5173` and `127.0.0.1:5173`. Vite proxies `/api` to the local backend.
5. Load the bundled synthetic case, or open `http://localhost:5173/?mode=chains`.

No key is bundled or sent to the browser. This is a **local-development** server, not an authenticated public service: do not expose or deploy the key-backed endpoints without a separate security/deployment review. `vite preview` is only a static frontend preview and does not provide the API proxy.

## Voice / text workflow

- Click **Start recording** to request microphone permission. Click **Stop recording**, or let the 15-second bound stop it. **Cancel** aborts processing and invalidates late results. Tracks are released on stop/cancel/unmount. Maximum audio is 4 MB; supported negotiated formats include WebM/Opus and MP4.
- A bounded clip is sent to **Voxtral Mini Transcribe 2**, model `voxtral-mini-2602`, through `POST https://api.mistral.ai/v1/audio/transcriptions` using upstream multipart `model` + `file`. The browser-to-local-server upload is the raw audio blob with its MIME type. Transcript appears **after stopping**, not as streaming partial speech.
- Review/edit the transcript, or directly type in English, French or Chinese. Click **Apply command**. Text entry does not activate the teammate's global legal-review shortcuts.
- The local backend calls `POST https://api.mistral.ai/v1/chat/completions` with a strict **per-action JSON schema**. Default intent model is **`ministral-8b-latest`**, which was actually verified. Override only on the server with `MISTRAL_INTENT_MODEL`. The initially tried `mistral-small-latest` returned HTTP 429 with the supplied account; it is **not** claimed verified.
- Every returned action, target, boolean and source ID is validated on both server and client. No arbitrary tools, code execution or legal-fact confirmation are possible. Unsupported requests fail clearly without changing state. Provider limits/timeouts/errors have no fake offline/provider fallback; the original demo controls remain available.
- Explanations and challenge summaries are generated from **the existing deterministic engine**, not free-form model legal opinions. Sources retain the teammate's real/mock provenance labels. Previews are visibly **hypothetical**, idempotent and separate from lawyer decisions. Restore clears only `whatIf`, preserving decisions and the art. 642 setting.
- The command panel retains its own English/Chinese labels; the teammate's EN/FR interface and memo translations are preserved.

Supported actions: `show_evidence`, `explain_link`, `preview_scenario`, `reset_scenario`, `show_mode`, `challenge_defence` (read-only). `unsupported` is an explicit no-op result.

Examples:
- “What if the 2022 email acknowledges the debt?” → `q-email=true`; C1 breaks while C2 remains provisional.
- “Et si la conciliation avait été tentée avant l’assignation ?” → `q-concil=false`; **false** means an attempt occurred before filing, since this demo's true value means no attempt on file.
- “Show me the mandatory conciliation clause.” → actual contract and highlighted art. 14 passage.
- “Explain why C1 loses interruption.” / “Challenge the defence.”
- “Show the memo.” / “Reset the scenario.”

Privacy: audio, command text and the bundled demo context go to Mistral via your server. Do not use confidential client information. Human microphone permission and hardware quality still require an explicit, consented user test. No browser `SpeechRecognition` is used or presented as Mistral.

## Verification and reproducibility

- `npm test` — **68 tests / 14 files**, including all original 7 engine tests; strict target/source validation, polarity, idempotency, decision-preserving reset, missing key, audio limits/MIME, timeout, redacted rate-limit recovery, track cleanup, cancellation/stale-response guards and accessible panel rendering. Provider mocks are explicitly test-only.
- `npm run build` — TypeScript + production Vite bundle.
- `npm run typecheck:server` — strict backend/shared-contract TypeScript check.
- `npm run lint` — clean, with no outstanding lint warnings.

Actual acceptance on this worktree included macOS-generated non-sensitive spoken audio → **real browser MediaRecorder** on a synthetic audio stream → **real Voxtral HTTP 200 transcript** → **real Ministral HTTP 200 intent** → the existing engine and actual DOM. English email and French conciliation commands preserved decisions; source navigation highlighted the actual contract; local reset restored baseline. The original transcript was explicitly reused for the repaired intent probe after a schema issue; this is recorded, not disguised as a fresh STT call.

Live investigation exposed two issues: the original Small model was rate-limited, and a loosely nullable target schema permitted an invalid null preview target. Those responses were safely rejected; the final per-action schema requires known, non-null qualification IDs for previews. Three subsequent real intent probes passed. In total, 8 short generation calls were used (1 STT, 4 initial intent probes, 3 successful repaired probes), with the additional probes authorized. Upstream request-ID headers were absent, so evidence records null rather than invented IDs.

Ignored local evidence (not portable in Git):
- `.verification/live-browser-evidence.json` — real response statuses, transcript, validated actions, engine/DOM before/after and decision invariants, including initial failures.
- `.verification/provider-receipts.jsonl` — redacted upstream diagnostic receipts.
- `.verification/mock-browser-evidence.json` — separately labelled mock-only DOM/error/cancel/mode checks and actual 780/1280px panel geometry.
- `.verification/replay-engine-evidence.json` — explicit offline replay, not a new provider claim.
- `.verification/generated-command.wav` — synthetic speech only, not user microphone audio.

Recheck the retained real receipts through the actual engine without another provider call: `npm run voice:smoke -- --replay .verification/live-browser-evidence.json`.

For a **new authorized live** probe, generate a short WAV saying “What if the 2022 email acknowledges the debt?”, start the local backend, then run `npm run voice:smoke -- --live /absolute/path/to/command.wav`. This opt-in script makes exactly 3 generation calls: STT, email intent, conciliation intent. It fails on unavailable/invalid provider results and writes `.verification/live-cli-evidence.json`; it does not silently switch to replay. `--help` makes no provider calls. Browser DOM acceptance is separate from CLI replay.

Official contracts used: [offline transcription](https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription), [Voxtral Mini Transcribe 2](https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02), [structured output](https://docs.mistral.ai/studio/conversations/structured-output/custom), [chat endpoint](https://docs.mistral.ai/api/endpoint/chat).

## Selectable case samples

The top-bar **Case** selector keeps the original combined C1/C2 sample and adds standalone C3 insolvency, C4 objection timing and C5 ordinary appeal lapse. Share `?mode=chains&case=c3&lang=fr` (also `c1-c2`, `c4`, `c5`). Switching case resets reviews, hypotheses, source/fact selection and pending voice work; switching language preserves the current case review.

Additional documents are embedded **SYNTHETIC** fixtures with exact source highlights, not retrieved court records or official law. Each sample has its own deterministic chains, timeline, legal-review caveats, what-if controls and memo. C3 declaration does not lift the separate payment stay; C4 timely objection does not guarantee transfer; C5 previews are pre-order only and cannot undo the actual lapse order. C5 uses CPC 641/642 to adjust 1 November 2025 to 3 November (17 days late), independently of the original substantive-limitation flag.

Voice/text examples for the active sample:
- C3: “What if a regular claim declaration was filed in time?” (`q-declared=true`).
- C4: “What if jurisdiction was objected to before the merits?” (`q-merits-first=false`).
- C5: “What if appellant submissions were filed in time?” (`q-late=true`), or a qualifying pre-order force majeure (`q-force-majeure=true`).

Schemas and evidence validation are selected-case-only. Unknown/foreign case targets are rejected on server and client. New-case provider coverage here is explicitly fake/injected; no real new-case Mistral or human microphone test is claimed. Final integrated realtime acceptance is owned by the parent lane.

Implementation plan, source corrections, executed gates, browser evidence and local startup handoff: [CASE_INTEGRATION_PLAN.md](../docs/CASE_INTEGRATION_PLAN.md), [CASE_INTEGRATION_VERIFICATION.md](../docs/CASE_INTEGRATION_VERIFICATION.md).

## Original demo sources and shortcuts

Sources: the two Cour de cassation decisions in `../data/caselaw/` are real. The case file, statutory excerpts and the Cass. 2e civ. authority for chain C1 are mocks, labelled as such in the UI. These legal references still require lawyer review; the command layer does not certify legal outcomes.

Shortcuts: `1`/`2`/`3` modes · `J`/`K` facts · `C`/`R` confirm/reject · `P` presenter mode · `Esc` close drawer.

Screenshot URLs: `?mode=chains&link=c1-cons`, `?mode=chains&confirmed&whatif=q-email`.

Implementation outline, dependency/parallelism map and acceptance checklist: [VOICE_DEVELOPMENT_PLAN.md](../docs/VOICE_DEVELOPMENT_PLAN.md).

Language: use the EN / FR switch on the welcome screen or in the top bar. The choice is remembered in this browser. Share `?lang=fr` or `?lang=en` links (combinable with the screenshot parameters). Switching keeps the current review decisions and what-if scenario. The interface, analysis and copied Markdown memo are translated; source documents, citation quotes and PDFs retain their original French text.
