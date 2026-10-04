# Domino — web demo

The teammate's deterministic legal engine, Facts/Chains/Memo, source highlighting and manual review remain intact. The command desk now provides **continuous realtime Mistral voice interaction**, not talk–stop–review–apply. Current legal command IDs still describe the original C1/C2 sample; C3–C5 integration is a separate lane and must update the context/allowlists before claiming voice support for those cases.

## Run locally

Requirements: Node/npm for the existing Vite/Vitest toolchain, and **Bun** for its native authenticated WebSocket client/server. Verified on Node 25.8.0 and Bun 1.3.13. No new npm dependency was installed. Supported Vitest Node versions are 24.12+ or 26+; the pre-existing engine warning on Node 25 does not prevent the verified gates.

From `web/`:
1. `npm ci`
2. Create ignored `.env.local` from `.env.example`, setting `MISTRAL_API_KEY` securely. Never use `VITE_*` for a secret. Bun loads `.env`/`.env.local`; exported values take precedence.
3. Terminal A: `npm run voice:server` — HTTP API http://127.0.0.1:8787 and native WS bridge on loopback port 8788. Status endpoint: **http://127.0.0.1:8787/api/status**, not `/api/health`.
4. Terminal B: `npm run dev` — **http://localhost:5173**. Vite proxies `/api/realtime` with WebSocket upgrade to 8788 and other `/api` calls to 8787. Keep these ports available. Browser origins are strictly `localhost:5173` and `127.0.0.1:5173`.
5. Load the sample case; optionally select Chains before talking.

The long-lived key stays server-side, including during the upstream WS handshake. The local bridge permits only PCM audio frames, fixed provider/model/format, two active sockets, 6400-byte frame limits, handshake timeout, native ping/idle handling, and bounded backpressure. Do not expose these local-development endpoints publicly without a separate auth/security/deployment review. Static `vite preview` does not supply these proxies. No push/merge/deployment is part of this delivery.

## Continuous listening

- Turn **Continuous listening ON** using a user gesture and allow the microphone. It remains ON across utterances: no manual Stop or Apply. Browser AudioWorklet continuously captures mono samples and converts any actual AudioContext sample rate (tested at 16/44.1/48 kHz) into little-endian PCM16 at 16 kHz, in 20 ms frames. No MediaRecorder chunk uploads or browser SpeechRecognition are used in this path.
- The bridge authenticates `wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-2602`. Following the official SDK: wait for `session.created`, send `session.update` with `{audio_format:{encoding:"pcm_s16le",sample_rate:16000},target_streaming_delay_ms:480}`, wait for `session.updated`, then send `input_audio.append` containing base64 PCM. `transcription.text.delta` drives visible partial text. A continuous stream does **not** produce `transcription.done` after every spoken command; that is session termination, not endpointing.
- Pause after a complete command. Execution requires both 1.4 seconds of acoustic quiet and 1.1 seconds of stable transcript. Pure acoustic silence cannot trigger an action even if the provider emits text. These are conservative heuristics, not a claim of semantic sentence-boundary perfection; talk in short complete commands and pause between them.
- Each completed utterance automatically calls the existing `/api/intent` with fresh demo context and real **`ministral-8b-latest`** strict structured output. A serialized queue prevents concurrent actions. Repeating a preview remains idempotent rather than toggling it off. Unsupported, ungrounded or legal-confirmation commands fail closed. Navigation/read-only explanations/hypothetical previews/reset are the only automatic actions.
- **OFF / Cancel / unmount** closes the socket, stops tracks and AudioContext, clears endpoint/reconnect timers and the intent queue, aborts pending requests and discards late responses. Permission-pending acquisition is also invalidated; newly granted tracks are stopped without starting capture.
- Transient disconnection discards incomplete speech and tries at most two reconnects (600/1200 ms) over one ON session. Audio during reconnect is explicitly not sent. Auth/policy/invalid-audio errors do not retry. Terminal failure turns the microphone OFF; the switch or typed fallback can retry.
- The panel shows microphone ON/connecting/reconnecting/OFF/failed separately from Heard/Executing/Answered, partial transcript and last grounded result. **Typed fallback** exists only while listening is OFF; its form, submit and restore buttons are removed entirely while ON. No TTS is enabled, avoiding a feedback loop.

Previews are visibly hypothetical and never alter confirmed/rejected lawyer decisions. Engine-generated explanations retain real/mock source labels and cannot certify legal outcomes. Audio, transcripts and demo context are sent to Mistral; do not use confidential client information. Actual human microphone hardware/permission/audio quality remains **unverified** until a consented user test.

Examples: “What if the 2022 email acknowledges the debt?”; “Et si la conciliation avait été tentée avant l’assignation ?”; “Show the mandatory conciliation clause”; “Explain why C1 loses interruption”; “Reset the scenario”. `q-concil=false` means conciliation was attempted before filing, because the sample's true value means no attempt on file.

## Verification and evidence

- `npm test`: **65 tests / 10 files**, preserving the original 41-test baseline. New coverage: silence/stabilization/debounce, repeated utterances, serialized ordering, failure recovery, OFF/late-response cancellation, permission denial/pending permission, worklet initialization cleanup, bounded reconnect, persistent two-command sessions, actual worklet resampling/PCM encoding, native server origin/frame policy and official provider handshake. Provider/resource mocks are explicitly unit-only.
- `npm run build`, `npm run typecheck:server`, `npm run lint`: required clean gates.
- Real provider protocol probe: `node --env-file=.env.local scripts/realtime-provider-smoke.mjs --live`. This separate opt-in probe uses official short-lived session tokens and native Node WebSocket, not browser/bridge acceptance. It reads the generated audio files below and makes one realtime STT session + two real intent calls; the token-mint request is additional but not generation. It never writes/prints tokens or keys.
- Actual browser acceptance used generated speech through a synthetic MediaStream, **real AudioWorklet/PCM**, a single same-origin **Bun WS bridge**, real Mistral delta events and real intents, the original engine and rendered DOM. In one ON session without any intervening click, email changed C1 to fails/C2 contested and reset restored both to contested. Partial speech was visible. Lawyer decisions remained equal. A third real intent response was deliberately held by the test fixture, OFF was clicked, then the response released: no late action; socket/tracks/contexts were closed. This is synthetic browser audio, **not human microphone acceptance**.
- This revision used **10 short generation calls**: three realtime sessions (protocol probe, initial browser and final revised-UI browser), two probe intents and five browser intents. Three final calls were necessary to re-verify the explicit revised requirement after hiding the typed controls and repairing queued-context synchronization. The separate official token mint is not counted as generation. Provider request-ID headers were absent; receipts retain null, not invented IDs.

Ignored local evidence under `web/.verification/`:
- `realtime-provider-evidence.json`: actual provider session/deltas, two intents, engine statuses and decision invariants.
- `realtime-browser-final-evidence.json`: final real-provider run after UI/context fixes; **ON once, two commands with zero intervening/typed-submit clicks, OFF once**, one socket, visible partials, C1/reset DOM and closed resources; typed form absent while ON and returned OFF.
- `realtime-browser-evidence.json`: initial actual bridge/deltas/intent receipts, partial and result DOM timeline, OFF race and closed resources. Initial untrusted `.click()` suspended the synthetic AudioContext; a trusted CDP mouse gesture retried before playback, recorded as preflight rather than hidden.
- `realtime-status-red.log`, `realtime-final-gates.log`, `realtime-security.json`, `realtime-tdd-evidence.json`: regression/RED/GREEN/security evidence.
- `realtime-email.wav`, `realtime-reset.wav`: non-sensitive macOS-generated speech, mono PCM16/16 kHz.

To regenerate the audio on macOS, use `say -v Samantha -r 155 -o .verification/realtime-email.aiff 'What if the 2022 email acknowledges the debt?'` then `afconvert -f WAVE -d LEI16@16000 -c 1 .verification/realtime-email.aiff .verification/realtime-email.wav`. Repeat with “Reset the scenario.” and `realtime-reset` filenames. `.verification` must exist first.

Browser reproduction fixture: `scripts/browser-realtime-probe.js` installs **synthetic microphone only**, observing otherwise-real production requests/socket/DOM. Load the sample, evaluate this file in the browser, activate the switch with a **trusted mouse gesture**, wait for “continuously listening”, then invoke `playSyntheticSequence()` once. It schedules both WAVs six seconds apart on the same MediaStream; no per-command click. Inspect `voiceEvidence.receipts`, `voiceEvidence.events` and `voiceEvidence.dom`. Switch OFF and verify `voiceEvidence.contexts.every(c=>c.state==='closed')`. Reload to remove the synthetic fixture before testing a real microphone. No transcript/provider/intent response is fabricated.

Legacy bounded `/api/transcribe` and its opt-in `voice:smoke` remain for compatibility, but are not used or presented as the realtime UX. Historical bounded acceptance files have distinct names and are not proof of this revised requirement.

Official references: [Mistral realtime transcription](https://docs.mistral.ai/studio/audio/speech_to_text/realtime_transcription), [official Python connection/protocol](https://github.com/mistralai/client-python/tree/main/src/mistralai/extra/realtime), [official client-session auth](https://docs.mistral.ai/studio/audio/speech_to_text/realtime_transcription/client_auth), [Bun native WS API](https://bun.sh/docs/runtime/http/websockets), [structured output](https://docs.mistral.ai/studio/conversations/structured-output/custom).

## Local human acceptance (after automated gates)

From `/Users/fqn/Documents/HermesAnywhere/HacktheLaw-voice/web`, run `npm run voice:server` in Terminal A and `npm run dev` in Terminal B; use the Bun/Node prerequisites and ignored `.env.local` above. If handed running services, open the URL without starting duplicate listeners.

1. Open http://localhost:5173, load the sample and choose Chains. Do not evaluate synthetic verification fixtures for this human test.
2. Turn Continuous listening ON with a mouse click, grant permission and wait for “continuously listening”. Speak “What if the 2022 email acknowledges the debt?”, then pause. Expect partial transcript, Heard → Executing → Answered, hypothetical C1 fails / C2 contested.
3. **Without clicking anything**, speak “Reset the scenario.” and pause. Expect both chains restored, same switch still ON and lawyer decisions unchanged.
4. Optionally say “Show the mandatory conciliation clause.”; expect actual highlighted art. 14. Ask to confirm all facts; it must refuse without changing decisions.
5. Turn OFF while another utterance is processing. Expect microphone OFF, no late action, recording indicator gone. Re-enable once to test recovery; OFF again when finished. Typed fallback remains available while OFF.

This checklist is a user handoff, not a claim that a real human microphone has already passed.

## Original sources and shortcuts

The two Cour de cassation PDFs in `../data/caselaw/` are real. The sample case, statutory excerpts and C1 Cass. 2e civ. authority are mocks, labelled in the UI. These still require lawyer review. Shortcuts: `1`/`2`/`3` modes · `J`/`K` facts · `C`/`R` confirm/reject · `P` presenter mode · `Esc` close drawer. Text input remains protected from app review shortcuts.

Voice-specific plan: [VOICE_DEVELOPMENT_PLAN.md](../docs/VOICE_DEVELOPMENT_PLAN.md).
