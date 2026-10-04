# Realtime transcript → intent boundary diagnosis

## Observed failure

On the integrated C5 demo, a real browser AudioContext/AudioWorklet streamed generated English speech mixed with continuous 120 Hz hum and seeded broadband hiss to the real Mistral realtime model. The provider returned `What if appellant submissions were filed in time?`. More than 12 seconds after its final delta, the UI still showed it only as a partial transcript, `Heard: —`, and `Waiting for speech`; **zero `/api/intent` requests** occurred. The WS was ready and PCM streaming (656640 bytes in the captured observation). Backend service remained configured/running; it has no per-request trace logs.

The boundary is frontend `Endpoint.take`, not intent/backend validation: every noise frame at RMS approximately 0.022 exceeded the old fixed 0.015 speech threshold and reset `speechAt`. The required 1400 ms acoustic quiet could therefore never occur, despite stable recognized text. A deterministic regression reproduces the same failure. This is a reproduced cause matching the reported symptom, not a measurement of the user's actual microphone.

## Scoped repair

- Calibrate ambient lower-quintile RMS over the initial 600 ms / at least 30 frames, including frames captured during upstream handshake.
- Detect speech above `max(0.015, noiseFloor × 2.5)`. Freeze calibration within the ON session so long speech cannot raise the floor and cut itself off.
- Keep the existing 1400 ms no-speech + 1100 ms stable-text gates; require observed above-noise speech. Ignore provider text during silence, stationary noise or startup calibration.
- After 8000 ms stable text still blocked by continuing audio, explicitly discard with an error; never force a hallucinated/noisy command into execution.
- Expose safe local pipeline counters and acoustic/transcript metrics. Queue boundaries now report queued / executing / answered / error. Existing context validation, fresh queue context, legal safety, OFF cancellation and resource cleanup are unchanged.

RMS contrast remains a heuristic, not neural/spectral VAD. Start quietly; very low speech-to-noise ratio, startup speech or changing noise may still require recalibration. Diagnostics make the exact boundary visible without asking the user to press Send.

## Real acceptance

One actual browser/provider ON session with the same continuous noise:

1. EN presentation + generated English command automatically produced HTTP 200 `preview_scenario(q-late=true, c5-submissions)`, and the actual engine/DOM showed C5 failing in the hypothetical preview.
2. Switch presentation to FR without ending listening. Generated French `Réinitialise le scénario.` automatically produced HTTP 200 `reset_scenario`, restoring the actual baseline. Second request had fresh `whatIf: {q-late:true}` / `hypothetical:true`; both requests had identical lawyer decisions.
3. Zero typed submissions or per-command Apply/Send clicks. One WS; one ON and one OFF switch click. OFF stopped the track, closed the capture AudioContext and restored typed fallback.
4. Observed calibrated floor 0.0219, threshold 0.0547, background RMS 0.0223–0.0230; pipeline: two utterances, two queued requests, two applied responses, zero errors. Intermediate acoustic-pause metrics were observed before automatic dispatch.

This is synthetic noisy microphone-input verification through **real** streaming, real providers and actual browser UI/engine; **not human microphone hardware verification**. For the user's microphone, inspect Pipeline diagnostics (noise floor / threshold / acoustic quiet / text stable / utterances / requests / errors) with the actual command and selected case if the issue persists. No confidential audio is needed for diagnosis.

## Evidence and gates

Ignored local `web/.verification/` artifacts:
- `noisy-browser-red.json`: real pre-fix stable partial and zero requests.
- `noisy-endpoint-red.log`, `noisy-diagnostics-red.log`, `noisy-pipeline-red.log`: observed TDD failures.
- `noisy-browser-green.json`: actual provider receipts, selected-case contexts, DOM timeline and cleanup assertions.
- `noisy-browser-probe.js`: opt-in synthetic noise fixture; run only on C5 localhost and reload to restore native capture. It uses generated `realtime-c5.wav` and `realtime-reset.wav`; the French probe additionally generated `noisy-reset-fr.wav` with macOS Thomas voice. Use a trusted browser click for ON because AudioContext autoplay requires user activation.
- `noisy-final-gates.log`: integrated test/build/server-typecheck/lint output.

Integrated gates: **100 tests in 18 files pass** (previous 94 plus six new regression cases); build, server typecheck and lint pass. Exact-key scan found no leak in tracked/unignored files or built assets; ignored env remains mode0600. No backend restart, credential changes, push, main merge or deployment.
