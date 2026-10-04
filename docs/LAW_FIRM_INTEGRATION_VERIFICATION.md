# Law-firm integration verification handoff

Branch: `feature/law-firm-integrations`, based on `2126ecf`. Local-only delivery; upstream unset. No push/PR/main merge/deployment. Parent independent acceptance passed: full regression, real HTTP smoke and browser SQLite import/analysis/export/readback. Parent also fixed silent AI-context truncation with an observed failing regression followed by GREEN; all accepted source text is forwarded.

## Results actually exercised

| Gate | Result |
|---|---|
| Baseline install | `npm ci`: 0 vulnerabilities; Node 25 warning outside Vitest's declared even-LTS engine range |
| Baseline suite | 24 files / 141 tests passed |
| Final suite | 32 files / 175 tests passed after parent no-truncation regression |
| Production build | `npm run build` passed |
| Server/scripts/integration test typecheck | `npm run typecheck:server` passed |
| Lint | `npm run lint` passed, no warnings |
| Diff whitespace | `git diff --check` passed |
| Actual HTTP auth | Missing token 401; foreign origin 403; accepted normalized push 201 |
| Actual SQLite | Read-only real file; 9 documents / 9 anchored annotations / 5 proposed qualifications |
| Existing engine/memo | Actual C1/C2 chains contested; deterministic Markdown memo generated |
| Export | Exact analysis/export readback equality; SQLite SHA-256 unchanged; actual browser download saved |
| OpenAPI | 9 documented public operations; actual pushed Matter and downloaded Export validated with JSON Schema Draft 2020-12 |
| Actual provider | Three genuine Mistral requests total: one connection test, initial review, final receipt review; no retries/extra smoke model calls |
| Provider receipt | Final `aiReview.live:true`, `providerUsed:mistral-chat`, `profileId:mistral`, `model:ministral-8b-latest`, `requestCount:1` |
| Browser workflow | Connection test → SQLite import → deterministic analysis → selected live review → download/copy → existing Facts/Chains/Memo/source view |
| Legal state | Every imported qualification remains `proposed`; import labels explicitly say source annotations / review required |
| Modal safety | Reproduced shortcut leak before fix; after fix pressing C inside Connections left all 5 underlying proposals pending; Escape closed modal |
| Clipboard | Initial permission/focus failure retained; foreground + ordinary browser clipboard permission produced copied response and exact readback; timeout/denial now bounded/actionable |
| Bilingual/responsive | English/French Connections labels; 390px panel had no horizontal overflow; no captured runtime errors during final interaction gate |
| Existing cases/voice | C3, C4, C5 and sample selected successfully in browser; their existing voice panels retained; microphone never enabled |
| Secrets/local artifacts | `.env.local`, token, SQLite and evidence ignored; token file mode 0600; no secrets or database artifacts staged |

The provider fixture/alternate-host contract tests use explicitly fake injected transport responses. They are not counted as genuine provider calls. Self-hosted or alternate OpenAI-compatible endpoints were not genuinely exercised because no firm deployment was supplied.

## Evidence retained locally (ignored)

All paths are under `web/.verification/`:

- `browser-connections.json`: original live connection test and import/review/export events. Earlier instrumentation read **top-level** `live` only and defaulted absent fields to false. This does not mean no review call occurred; see explicit final receipt evidence.
- `browser-final-receipt.json`: final deterministic request (`providerInvocation:false`) versus genuine selected review (`providerInvocation:true`) with nested actual receipt; verification call budget 3.
- `browser-final-gates.json`: foreground clipboard readback, modal isolation/Escape, French labels, narrow-panel size and captured runtime errors.
- `browser-case-views.json`: imported case ID, email quote, actual Chains/Memo excerpts.
- `browser-import-provenance.json`: imported-source labels (not misleading Hand-checked reference/AI extraction).
- `browser-final-proposals.json`: final banner explicitly reports imported proposals pending review, not an assertion that AI extracted them.
- `browser-presets.json`: original sample and C3/C4/C5 browser selection.
- `http-integration-smoke.json`: real local accepted/denied HTTP, SQLite counts/hash invariance and export equality (0 provider calls).
- `downloads/demo-c1-c2-export.json`: actual browser-downloaded response with final live receipt.
- `schema-verification.json`: validation of actual downloaded response against final OpenAPI.
- `sqlite-export.json`, `push-matter.json`: reproducible synthetic smoke artifacts, never client data.

## Running handoff

The isolated demo is running at `http://127.0.0.1:5175`. Voice HTTP/WS run at 8797/8798. It was started through `npm run dev:integrations`; the launch process owns only these services. Do not stop or modify sibling 5173/8787/8788 services. If restarting, the launcher refuses occupied ports, reproduces the fixture and resets in-memory imports. Select an existing imported case in Connections if the Import button is disabled because it was already imported.

Parent can run `npm run integration:smoke` without further provider calls. The local generated token is read internally from ignored `.verification/integration-key.local`; do not print it. Further real AI tests require a separate call budget decision: this handoff already used the three-call verification budget.

## Explicit limitations / next milestone

M1–M6 local demonstration is delivered. Next is independent parent review/acceptance, then production connector/auth design if requested. Remaining roadmap work: real non-SQLite database/DMS connectors, multi-tenant authentication and audit lifecycle, full firm-profile propagation across fresh extraction/OCR/embedding agents, and exporting browser lawyer-confirmation/what-if state. The new versioned AI operation is bounded commentary using the selected existing client; it is not advertised as full fresh extraction. Existing unversioned demo routes, statutory excerpts and case-law placeholder remain their original demo boundaries.

An optional transient formatter invocation did not run because its package metadata check required approval; no formatter/runtime dependency was added. Code gates above completed without it. The first schema re-read attempt hit the read tool's long-line truncation; validation was then performed against the actual on-disk JSON with the existing validator runtime and passed. These failures were not substituted by invented outputs.
