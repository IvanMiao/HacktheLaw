# Law-firm Integration Implementation Plan

> **For Hermes:** Execute task-by-task with test-driven-development; parent performs independent review. No push, PR, main merge or deployment.

**Goal:** Demonstrate a firm-owned database → anchored CaseBundle → existing deterministic legal engine → optional firm-owned AI review → response export, with Connections UI and an authenticated versioned push API.

**Architecture:** Extend, do not replace, the current CaseBundle/provider/ingestion architecture. A local, single-tenant integration service stores imported cases in memory, reads one server-configured SQLite database read-only, and shares its results with the existing Facts/Chains/Memo views. All imported qualifications start proposed. Optional bounded AI review is commentary, not legal confirmation and invokes the selected existing server-side LlmClient. Full agent/OCR/embedding profile propagation is deferred; the existing full extraction pipeline remains intact without changing realtime transcription.

**Technology:** React 19, TypeScript, Vite middleware, Node HTTP, Node built-in SQLite (Node 22.13+), existing LlmClient and deterministic engine/memo, Vitest, browser DOM/CDP. No new broad runtime dependency. SQLite is a synthetic demo bridge, not universal direct database access.

## 0. Discovered assets and baseline

- `web/server/api.ts`: Vite middleware `/api/cases` NDJSON extraction and `/api/health`; not a versioned authenticated firm interface.
- `config.ts`, `providers.ts`: OpenAI **Responses API** and Mistral chat/tool/JSON adapters, embeddings, retries and cancellation. There is no configurable self-hosted base URL today. Reuse chat protocol for API-compatible/self-hosted text models; do not claim arbitrary Claude or ChatGPT consumer subscription support.
- `ingest.ts`: TXT/MD/EML/DOCX extraction; PDF/image OCR provider restrictions; sample manifest with stable document IDs.
- `pipeline.ts`: ingest → library → retrieval → extraction agent → qualification agent → deterministic engine → ignored bundle cache.
- `retrieval.ts`, `library.ts`, `anchor.ts`: lexical/vector retrieval, reference sources and source quote verification.
- `src/data/bundle.ts`: CaseBundle, factual anchors, qualifications and profile; `initialState` already defaults all decisions to proposed.
- `App.tsx`: bilingual intro, active CaseBundle, Facts/Chains/Memo, source viewer and isolated C3/C4/C5 voice state. Preserve these.
- `voice-api.ts`, realtime bridge/server: Mistral transcription and intent are separate from case-analysis configuration.
- Branch: `feature/law-firm-integrations`, base `2126ecf`; upstream removed to prevent accidental main push.
- Actual baseline: npm ci (0 vulnerabilities), 24 test files / 141 tests pass; build, server typecheck, lint pass. npm reports Node 25 is outside Vitest's declared even-LTS engine range, although execution passes. Bun 1.3.13 available. No changes to existing voice services.

## Milestones, functions, files, dependencies and parallelism

### M1 — Contracts, normalization and safety (serial foundation)

**Function:** Accept normalized matter profile, document text and optional factual annotations/proposed qualifications. Never accept a browser/server path, SQL, URL, credentials, preset, decisions or claimed confirmation. Verify every factual quote against the submitted document; reject malformed dates/IDs/references/unknown fields. A text-only matter can import with no facts; no legal result is invented.

**Files:** Create `web/server/integrations/contracts.ts`, tests; create integration OpenAPI document and tracked synthetic fixture generator/schema. Optional annotations use existing Fact/Qualification shapes but strip incoming verified/source/model claims and recompute source verification.

**Technology:** Explicit bounded runtime validation, CaseBundle types, quote location utility, JSON/OpenAPI 3.1.

**Steps:** Write normalization/security tests → demonstrate RED → implement minimal normalization → GREEN. Reject duplicate document/fact/qualification IDs, path-like IDs, invalid types, invalid references, excessive content, unsupported keys.

**Dependencies:** Existing CaseBundle, anchor verifier and initialState. No network/key needed. Documentation/schema lane can run parallel once the normalized contract is fixed.

**Functional gate:** Stable IDs, exact anchors, all decisions proposed, no mutation of source sample or local firm database.
**Quality gate:** Tests, typecheck and no secrets in fixtures/docs; source English.

### M2 — Real read-only SQLite and generic push (depends M1)

**Function:** One explicit server-side firm adapter uses a configured SQLite file and parameterized matter ID selection. List synthetic matters, import one into in-memory workspace. Generic authenticated push permits independent firm ETL/connectors to send normalized text and annotations.

**Files:** Create `web/server/integrations/sqlite.ts`, `web/scripts/create-firm-fixture.ts`, `data/firm-demo/schema.sql`; fixture rows reuse synthetic sample evidence/annotations. Database output under ignored `.verification/`.

**Technology:** Node built-in `node:sqlite`, read-only DatabaseSync, fixed schema/query, bounded listing, configured allowed matter selectors. No request-supplied SQL, file path, connection string or URL.

**Steps:** Fixture creation → failing SQLite read/no-write/missing selector tests → adapter implementation → real SQLite tests. Clearly label every fixture matter synthetic.

**Dependencies:** M1 contract. Provider lane M3 can run independently. Production Postgres/SQL Server/DMS connectors are roadmap; their external adapters can push the same REST contract.

**Functional gate:** Actual SQLite file reads return exact sample document text; unknown IDs fail; read-only write attempt fails; export never writes back to firm system.
**Quality gate:** No DB file tracked; errors redact filesystem paths; fixture reproducible from tracked English source/schema.

### M3 — Firm-owned AI profiles (parallel with M2 after M1)

**Function:** Read profiles from server environment only: ID, label, adapter protocol, model, base URL, credential environment reference and explicit trusted origins. Browser selects profile ID and sees public metadata/configured capability, never credential value/reference. Default Mistral. Test connection with one bounded genuine JSON call. API-compatible chat/self-hosted uses existing chat adapter; OpenAI Responses remains its existing native adapter.

**Files:** Extend `web/server/providers.ts` optional construction configuration (tests first); create `web/server/integrations/providers.ts`, tests; optionally extend pipeline client injection for existing extraction reuse.

**Technology:** Existing LlmClient JSON/tools, URL validation and trusted exact origin check, environment credential lookup, AbortSignal timeout, bounded transport call budget/no retry for connection review.

**Dependencies:** M1 IDs/security policy. Authorized ignored Mistral key supplied by parent; no credential scraping. Self-hosted and alternate profiles contract-tested with explicitly fake local provider responses unless an actual deployment is supplied.

**Functional gate:** Selected profile changes actual outbound adapter/model/base URL; secrets absent from status/errors; unsupported profile/base origin fails closed. Transcription labels remain Mistral Voxtral and do not change with text AI choice.
**Quality gate:** Bound timeout/call count, redirects rejected to avoid credential forwarding, provider failures redacted. Consumer ChatGPT/Claude/Le Chat subscriptions do not imply API access: an API-enabled plan/key and compatible protocol are required.

### M4 — Versioned authenticated API and engine/export (depends M1–M3)

**Function:** `/api/v1` endpoints for capabilities, profiles, test connection, SQLite matter list/import, case push/read, analysis and export. Bearer auth from server environment fails closed if absent; exact-origin policy for local frontend; no wildcard CORS. Separate same-origin local UI bridge routes use a loopback-host/origin check and never expose the server bearer key. This is a local demo trust boundary, not production multi-tenant auth.

**Files:** Create `web/server/integrations/api.ts`, tests; mount through existing `web/server/api.ts`; add OpenAPI specification matching real routes/payloads.

**Technology:** Node HTTP/Vite middleware, timing-safe token comparison, body/time/rate/workspace bounds, in-memory Map. Existing `analyse`, `initialState`, `buildMemo`, `toMd`, loadLibrary. Deterministic analysis runs without any AI; optional `ai-review` adds bounded selected-provider commentary with evidence IDs, never changes facts/qualifications/confirmation. Preserve full ingestion/agent/retrieval path; client injection enables explicit selected profile reuse where applicable but is not falsely presented as bounded review doing extraction.

**Steps:** Failing real HTTP auth/origin/validation/method/roundtrip/error tests → middleware implementation → real HTTP GREEN. Failure must not overwrite last valid case or memo. Export response includes bundle, proposed state, deterministic analysis, Markdown memo and optional explicitly labeled AI review.

**Dependencies:** M2 actual database and M3 profile/client. OpenAPI/docs lane may run parallel with UI after routes are fixed.

**Functional gate:** SQLite → import → source-verified annotations → proposed state → real deterministic engine/memo → export over actual HTTP; rejected auth never performs database/provider work; optional review uses selected profile.
**Quality gate:** Input max size/types, no arbitrary SQL/paths/URLs, request timeout, provider timeout, bounded requests/concurrency/cases; generic redacted 5xx; malformed bearer/origin/method/JSON denial tests.

### M5 — Connections UI (depends M4 contract; parallel with docs)

**Function:** Accessible calm Connections panel in the existing bilingual application, reachable from intro and workspace. Source status, synthetic SQLite list, test/import matter, provider selection/test, deterministic analysis and optional AI review, open imported case in existing Facts/Chains/Memo, copy/download response export, developer REST example and OpenAPI link.

**Files:** Create `web/src/components/Connections.tsx` and UI tests; extend `App.tsx`, `index.css`, `i18n/fr.ts` as needed. Avoid changing existing intro/voice pipeline.

**Technology:** React state and existing CSS/i18n style; public metadata only; disabled/busy controls, translated user errors and empty state. Developer JSON example is intentionally a developer interface, not raw result dump.

**Functional gate:** Browser clicks complete import/analyse/export/open-case; original sample and C3/C4/C5 still selectable; imported AI/legal decisions never auto-confirm; voice remains disabled for unsupported imported cases.
**Quality gate:** English/French labels, semantic fields/buttons, no secret in DOM/network status, no browser errors, narrow-screen usable layout, no unrelated style redesign.

### M6 — Verification, docs and local handoff (serial release gate)

**Function:** Save reproducible startup/demo instructions, supported/roadmap matrix and evidence; locally commit only after real gates. Leave parent an isolated local demo at frontend 5175 (voice proxy targets configurable 8797/8798 only if voice server is started); never stop 5173/8787/8788.

**Files:** `docs/LAW_FIRM_INTEGRATION.md`, OpenAPI document, `.env.example` placeholders, package scripts, README link, ignored `.verification/` redacted evidence.

**Steps:** Full test suite/build/server typecheck/lint → start isolated frontend → health/readback → actual HTTP denial/accepted push/SQLite read → deterministic and tiny real selected-provider review → browser full workflow and bilingual/source view → inspect diff/security/ignore → local commit and clean status. Maximum approximately three genuine provider calls across connection test and review; no real client data. Unavailable provider must be a clear failure, never fake live output.

**Functional gate:** Real fixture roundtrip + browser proof + actual selected-provider call evidence; no unsolicited external export writes.
**Quality gate:** All local gates green (baseline warning identified), no secrets/DB/evidence staged, OpenAPI route parity, no push/PR/main changes, upstream unset. Parent independent review follows handoff.

## Dependency graph and parallel lanes

```
Discovery/baseline → M1 normalization
                     ├→ M2 SQLite ─────┐
                     └→ M3 profiles ───┤→ M4 HTTP/engine/export
                                       ├→ M5 UI ──────┐
                                       └→ docs/schema ┤→ M6 gates/commit
```

A single executor serializes dependent edits; SQLite/provider and UI/docs lanes are logically independent and can be reviewed in parallel. Never parallelize writes to shared App/provider/API files without coordination. Plan is saved before production implementation.

## Mentor demo script

1. Start isolated local demo using documented automated fixture/start commands.
2. Open Connections, read **Synthetic SQLite demo bridge / read-only** and separate **Text AI / Mistral transcription** capabilities.
3. Test configured Mistral text profile; actual bounded provider response, no key in browser.
4. Select stable synthetic matter `demo-c1-c2`, import; show source text/anchors and proposed decisions.
5. Run deterministic analysis, show actual C1/C2 chain outcomes and memo; optionally add bounded AI review (not confirmation, not full fresh extraction).
6. Open case in Facts/Chains/Memo, click source evidence and confirm nothing has been legally confirmed by import.
7. Return to Connections; export response/copy/download for firm-owned system. No automatic external write occurs.
8. Show API example: unauthenticated `/api/v1` denied, configured bearer normalized push accepted, analysis/export response returned. Any firm can build a connector to this contract.

## Security and scope boundaries

- Single-tenant, local demo. No production identity, RBAC, tenant isolation, vault lifecycle, audit retention, encryption-at-rest, DPA or medical/client-data compliance claim.
- SQLite adapter is tested; other direct database protocols are future work. Generic push API is the interoperability boundary today.
- Environment profiles are operator configuration, not arbitrary user-supplied destination URLs. Exact trusted origins plus no redirects; credentials remain server-side.
- Imported annotations are source claims, source quote verification is not proof of legal truth. Qualification decisions stay proposed until a lawyer explicitly confirms in the existing UI.
- Deterministic rules/reference texts remain existing demo limitations; memo is review-required, not legal advice. Real API review must be labeled distinct from synthetic source fixture and fake contract test responses.
- No external deployment/export writes, no push/PR/main merge; no modifications to sibling voice worktree/services.

## Delivery status

M1–M6 local demonstration is implemented and verified; see `LAW_FIRM_INTEGRATION_VERIFICATION.md` for actual gates and retained evidence. The outline was saved before production implementation. Parent independent acceptance is next. Optional full agent/client injection was not needed for the bounded review slice and remains deferred with OCR/embedding profile propagation. The browser/backend exchange demonstrably uses the selected profile during versioned AI review, while original full extraction and realtime voice remain intact. Production multi-tenant deployment and real non-SQLite connectors remain separate milestones, not completed claims.
