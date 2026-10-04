# Domino — integrated local demo

The demo combines the original C1/C2 case, selectable C3/C4/C5 synthetic cases, AI analysis of uploaded documents, the English/French interface, intro film and continuous realtime Mistral voice commands. Facts, Chains, Memo, source highlighting, sample/upload flow and manual lawyer review are preserved. Legal rules and synthetic scenarios require lawyer review.

The default welcome screen retains the intro film, cached sample and document-upload flow. The case bundle carries analysis through the browser engine; uploaded documents are analyzed through Domino's local API. Source documents stay in their original French, while the interface, analysis and copied memo support English and French. Language changes preserve review state; changing cases clears the temporary scenario and loads only reviews saved for that case version.

Original shortcuts: `1`/`2`/`3` modes, `J`/`K` facts, `C` use the interpretation / `R` open its editor, `P` presenter mode, and `Esc` to close the drawer. Example URLs: `?mode=chains&link=c1-cons`, `?mode=chains&confirmed&whatif=q-email`, and `?lang=fr` or `?lang=en`.

The two Cour de cassation decisions in `../data/caselaw/` are real. Case files, statutory excerpts and the Cass. 2e civ. authority for chain C1 are mock sources labelled as such in the UI.

## Local startup

Requirements: Node/npm for Vite/Vitest and **Bun** for the authenticated native WebSocket bridge. Verified locally with Node 25.8.0 and Bun 1.3.13; use a supported Node 24/26 version for a fresh install (Vitest's Node 25 engine warning is documented).

From `web/`:
1. Run `npm ci` for a fresh checkout.
2. Store `MISTRAL_API_KEY` in ignored `.env.local` using `.env.example`. Never put a secret in `VITE_*` variables. Existing local credentials are already configured. Bun loads `.env` and `.env.local`; exported values take precedence.
3. Terminal A: `npm run voice:server` starts REST on http://127.0.0.1:8787 and native WS bridge on loopback:8788.
4. Terminal B: `npm run dev` starts http://localhost:5173. Vite proxies only voice routes: `/api/realtime` as WebSocket and `/api/intent`, `/api/transcribe`, `/api/status` as HTTP. Main `/api/health` and `/api/cases` stay on Domino's Vite middleware.
5. Open http://localhost:5173/?mode=chains. If services were handed over running, do not start duplicate listeners.

Status: http://127.0.0.1:8787/api/status; Domino provider health is http://localhost:5173/api/health. Keep ports 5173/8787/8788 free. Allowed browser origins default to `http://localhost:5173` and `http://127.0.0.1:5173`; add comma-separated origins with server-only `VOICE_ALLOWED_ORIGINS`. Static Vite preview does not provide backend proxies. These endpoints are local-development only; public exposure needs separate authentication/security review.

## Continuous voice interaction

- Click **Continuous listening ON** and grant microphone access. The microphone remains active across commands until OFF; no per-command Stop, Apply or Send is required.
- AudioWorklet sends mono PCM16 at16kHz in20ms frames. Actual AudioContext sample rates16/44.1/48kHz are resampled. This is realtime streaming, not bounded clip uploads or browser SpeechRecognition.
- The server authenticates the upstream `voxtral-mini-transcribe-realtime-2602` WebSocket. It waits for `session.created`, sends `session.update` with PCM format and480ms streaming delay, waits for `session.updated`, then streams `input_audio.append`. Partial transcription deltas appear onscreen.
- Keep quiet for the first0.6seconds while ambient noise calibrates (normally during the WS handshake); wait for **continuously listening** before speaking. Speech detection uses `max(0.015, 2.5 × ambient lower-quintile RMS)`, frozen for this ON session so sustained speech cannot become the noise floor. Pause after a complete short command: automatic endpointing still requires1.4seconds without detected speech and1.1seconds of transcript stability. Continuous room noise no longer continually restarts the speech clock. This RMS/contrast heuristic is not semantic or neural VAD; very quiet speech, changing noise or speaking throughout startup can require OFF/ON recalibration. Silence or calibrated stationary noise alone cannot authorize a transcript hallucination.
- **Pipeline diagnostics** shows local PCM frame/delta/utterance/queue/request/applied-response/error counts and RMS/noise-floor/threshold/quiet/stability measurements. If a transcript is stable for8seconds but continuous above-noise audio blocks its endpoint, it is discarded with an explicit error, not forcibly executed. No credential or audio logging is added.
- Each completed utterance automatically calls real `ministral-8b-latest` through `/api/intent` with the current selected-case context and strict per-action JSON schema. A serialized queue uses fresh context between actions.
- ON hides the typed-submit form entirely. OFF restores typed fallback and manual scenario reset. No TTS is enabled, avoiding speaker-to-microphone feedback.
- OFF/cancel/unmount stops tracks and AudioContext, closes WS, cancels requests/queued commands/reconnect timers and rejects late results. Changing cases unmounts the old session, turns listening off and resets case state; enable voice again for the new case.
- Transient connection loss discards incomplete speech and allows at most two reconnects600/1200ms. Audio during reconnect is not sent. Auth/policy/invalid-audio errors do not retry.
- Navigation, grounded explanation, challenge summaries, hypothetical previews and reset are allowlisted. Voice cannot confirm/reject legal facts. Unknown or foreign-case IDs are rejected. Repeating a preview is idempotent.
- Voice commands are enabled only for the C1/C2 and C3/C4/C5 demo bundles; AI/uploaded cases show a demo-only note and are never checked against the fixture catalog.
- Audio, transcript and demo context are sent to Mistral. Do not use confidential client data. Key remains server-side. No fake/cached provider fallback is silently substituted on error.

## Cases

Use the top-bar Case selector or `?mode=chains&case=c3&lang=fr`. Supported IDs: `c1-c2`, `c3`, `c4`, `c5`. Case switching resets reviews, hypothetical overrides, selection and pending voice work; language switching preserves the current review.

- C1/C2: original writ lapse/limitation and mandatory prior-conciliation sample.
- C3: insolvency with independent payment-action stay and declaration consequences. A timely declaration does not lift the stay; relief is not automatically granted.
- C4: objection timing. A timely objection removes the timing barrier but does not guarantee transfer or validate an ineffective clause.
- C5: ordinary appeal lapse. The raw1November2025 deadline adjusts under CPC641/642 to3November; filing20November is17days late. Hypothetical timely filing/force majeure scenarios apply before the order, not as a way to undo the existing order.

New documents are clearly SYNTHETIC fixtures, not retrieved court records. The original C3–C5 DOCX is unchanged. Source corrections and remaining legal-review questions are in `docs/CASE_INTEGRATION_VERIFICATION.md`.

Voice examples:
- Original: "What if the2022 email acknowledges the debt?"; "Reset the scenario"; "Show the mandatory conciliation clause".
- C3: "What if a regular claim declaration was filed in time?"
- C4: "What if jurisdiction was objected to before the merits?"
- C5: "What if appellant submissions were filed in time?"

Source language stays French. EN/FR interface choice is remembered and shareable through `lang=en|fr`; command panel has its own EN/Chinese labels.

## Verification

Run `npm test`, `npm run build`, `npm run typecheck:server`, `npm run lint`. Exact final integrated counts/results are recorded in ignored `web/.verification/`; separate case-only and realtime-only results are not substitutes for integrated gates.

Realtime acceptance before integration: one real WS session, one ON click, two automatic commands, zero typed/intermediate clicks, one OFF click. Actual synthetic microphone -> AudioWorklet -> Mistral deltas -> real intents -> engine/DOM, plus OFF late-response cancellation. This verifies generated speech, NOT human microphone hardware or audio quality.

Case acceptance before integration: all four case views,32 exact fact anchor highlights, sources/memos/timelines/hypotheses, EN/FR and stale-session isolation. Earlier new-case provider tests were explicitly injected mocks. Parent integrated acceptance now includes real Mistral intents for C3/C4/C5 and an actual realtime C5 session: automatically preview timely submissions then reset, without typed submission or intervening clicks; resources close on OFF. Generated audio is not human microphone acceptance. Evidence: `integrated-real-case-intents.json`, `integrated-realtime-c5.json`; failed attempts remain separately recorded. The parent repaired per-qualification citation enums and citation-free reset schemas after real provider rejection rather than weakening validation.

Ignored evidence: `realtime-browser-final-evidence.json`, `realtime-browser-evidence.json`, `realtime-provider-evidence.json`, and realtime gate/security logs. Case evidence lives in the isolated case worktree's ignored `.verification/cases-browser.json`; integrated evidence is retained in this worktree.

Optional realtime provider smoke: `node --env-file=.env.local scripts/realtime-provider-smoke.mjs --live`. It requires generated audio files under `.verification/`, creates a real streaming session and real intent calls, and is explicitly opt-in. On macOS generate speech with `say`, convert to mono PCM16/16kHz WAV with `afconvert`. `scripts/browser-realtime-probe.js` injects SYNTHETIC microphone audio only, not fake provider outputs; reload afterward to restore real microphone access. Historical bounded `/api/transcribe`/`voice:smoke` remain compatibility tools, not the realtime UX.

## Human local acceptance

1. Open the demo in Chrome, select Chains and the original case.
2. Turn ON, grant permission and wait for continuously listening.
3. Say "What if the2022 email acknowledges the debt?", pause, and observe partial -> Heard -> Executing -> Answered and C1 break.
4. Without clicking, say "Reset the scenario"; verify restoration with the same switch ON.
5. Turn OFF during processing; verify no late action and microphone indicator clears.
6. Select C3/C4/C5, enable voice for each and use the examples above. Verify case-specific sources/results and unchanged lawyer decisions.
7. Switch case while listening/processing; old session must stop and no old-case command may execute in the new case.
8. Switch EN/FR, inspect Facts/Sources/Memo, and test OFF-only typed fallback.

Human microphone acceptance is pending the user's test. No external push, merge into main or deployment is included.

Plans: `docs/VOICE_DEVELOPMENT_PLAN.md`, `docs/CASE_INTEGRATION_PLAN.md`; case verification: `docs/CASE_INTEGRATION_VERIFICATION.md`.

Original shortcuts:1/2/3 modes, J/K facts, C use / R edit interpretation, P presenter, Esc drawer. Inputs do not trigger legal-review shortcuts. Real Cassation PDFs remain labeled real; synthetic case/statutory/C1 authority excerpts remain mocks requiring review.


Qualification controls offer **Use this interpretation**, **Modify interpretation**, and **To verify**. Modifications explicitly select an answer and record a reason before recalculation. Pending reviews retain the candidate interpretation without treating it as established. Notes and evidence-request drafts appear in the memo; requests are not sent. Reviews are stored for the current version of a CaseBundle, while what-if scenarios remain temporary. The “Reset reviews” control in the banner clears saved reviews for the current case.
