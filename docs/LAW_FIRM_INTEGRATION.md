# Law-firm connections: local demonstrator

[Development outline](LAW_FIRM_INTEGRATION_PLAN.md) · [OpenAPI 3.1 contract](law-firm-openapi.json)

## What is connected now

```
Synthetic firm SQLite file (actual read-only SQL queries)
  → normalized profile + document text + source annotations
  → CaseBundle with exact-source anchors and proposed qualifications
  → existing analyse / initialState / buildMemo / toMd
  → optional selected firm text-AI JSON review via existing LlmClient
  → existing Facts / Chains / Memo / source viewer
  → authenticated export response, download or clipboard
```

The fixture contains one complete synthetic C1/C2 matter (`demo-c1-c2`): nine documents, nine factual annotations and five proposed qualifications. Its evidence is read from a reproducibly generated SQLite database, not substituted by a frontend constant. The generator copies the existing synthetic sample text and hand-authored annotations; it does not manufacture AI extraction output.

The generic push interface lets a firm's own ETL, DMS or database connector submit normalized text and optional annotations. Postgres, SQL Server, iManage, SharePoint and arbitrary remote databases are **not** directly implemented or tested. A production connector can map its records into the documented push contract without exposing SQL credentials or granting arbitrary query access to Domino.

## Start without manual demo configuration

From `web/`, use `npm ci`, then `npm run dev:integrations`. Requirements: Node 22.13+ with built-in SQLite (24 LTS recommended), Bun for the isolated existing voice server, and the existing ignored `.env.local` containing an authorized Mistral API key if live AI review is desired. No API key is required for deterministic analysis.

The launcher:

- checks Git ignore rules before writing local credentials/artifacts;
- refuses occupied ports rather than stopping any service;
- creates `.verification/firm-demo.sqlite` from tracked `data/firm-demo/schema.sql` and sample evidence, unless an operator supplied a SQLite path;
- generates a local REST bearer token if none is configured, retained only in mode-0600 `.verification/integration-key.local`;
- enables the explicitly local same-origin UI bridge;
- starts frontend/integration REST at `http://127.0.0.1:5175`, voice HTTP at 8797 and realtime WS at 8798;
- does not change or stop sibling services at 5173/8787/8788;
- handles SIGINT/SIGTERM by stopping only its own child voice process and Vite server.

Imported cases and analysis results are in memory, capped at 20 cases, and cleared on server restart. The synthetic SQLite fixture stays read-only during import/analysis/export. No firm database or remote system is written. `npm run fixture:firm` reproduces the demo database separately (it replaces only the default ignored fixture).

`npm run integration:smoke` exercises actual local HTTP authentication denial, accepted normalized push, SQLite matter import if needed, engine/memo analysis, export readback equality, unchanged SQLite hash and OpenAPI retrieval. It performs **zero** AI provider calls and saves redacted evidence under `.verification/`. Run after the launcher is ready; the browser can then select an already imported case, or restart before demonstrating the Import action itself.

## Mentor walkthrough

1. Open the local app and click **Connections**, including from its original bilingual intro.
2. Show **Synthetic SQLite demo bridge / configured / read-only** and the separate **Text AI API** profile. Configuration is not a claim that a connection has been tested.
3. **Test AI connection** makes one bounded, genuine selected-profile JSON API request. No key appears in browser metadata or the response.
4. **Import matter** reads `demo-c1-c2` from SQLite. The panel reports 9 documents, 9 source-anchored annotations and 5 proposed qualifications.
5. **Run deterministic analysis** uses the existing engine. C1 and C2 are contested with these proposed annotations; they are not confirmed legal findings.
6. Optionally **Add live AI review**. This makes one selected-provider request and adds at most three commentary notes referring to existing document IDs. It never changes evidence, proposed values or lawyer decisions.
7. **View imported case** opens the existing Facts/Chains/Memo workspace. The email quote and all other evidence remain accessible in the source viewer. Unsupported imported cases retain disabled voice commands; C3/C4/C5 retain their existing demo behavior.
8. Return to Connections, select the imported case, then **Export result** or **Copy export**. The saved server baseline and live review receipt are restored without another provider call. Export is a response only, not an unsolicited external write.
9. Show Developer API/OpenAPI. A connector without the configured bearer token receives 401; an unset server token returns 503, fail-closed.

Clipboard requires a foreground browser and ordinary clipboard permission. Denial or a hanging permission prompt returns an actionable fallback after two seconds; download remains available. Browser evidence retains the initial permission/focus failure and subsequent successful foreground copy/readback. The Connections modal traps focus and isolates keyboard shortcuts so pressing `C` inside it cannot confirm an underlying legal qualification.

## REST interface

All versioned paths require `Authorization: Bearer <server DOMINO_INTEGRATION_KEY>`. Do not put this token in a `VITE_` variable, frontend state or source control. Non-browser connectors need no Origin header. Browser access is limited to exact configured origins; this demo is not a cross-origin OAuth API and does not support unauthenticated CORS preflight.

| Method | Endpoint | Actual behavior |
|---|---|---|
| GET | `/api/v1/connections` | Public source/profile capability metadata and imported case IDs |
| GET | `/api/v1/openapi` | The tracked OpenAPI document |
| GET | `/api/v1/matters` | Configured synthetic SQLite matter selectors |
| POST | `/api/v1/matters/{matterId}/import` | Read SQLite matter; `{}` body; create in-memory CaseBundle |
| POST | `/api/v1/providers/{profileId}/test` | `{}` body; one actual selected text-model call |
| POST | `/api/v1/cases` | Normalize pushed matter text/annotations; create CaseBundle |
| GET | `/api/v1/cases/{caseId}` | Exact stored CaseBundle readback |
| POST | `/api/v1/cases/{caseId}/analyse` | `{"mode":"deterministic"}` or `{"mode":"ai-review","profileId":"mistral"}` |
| GET | `/api/v1/cases/{caseId}/export` | Previously completed result; 409 before analysis |

The same operations are available at `/api/connections/*` **only** when `DOMINO_LOCAL_CONNECTIONS=true`, the peer is loopback, Host matches an exact local origin and browser Origin/Sec-Fetch-Site is same-origin. This bridge does not transmit the bearer key to the browser. It deliberately trusts an operator's local browser/process, not a production user identity. Default `npm run dev` does not enable it. Configure/secure/remove the local bridge before any deployment.

### Normalized push example

An example request body, with no confirmed decisions or invented legal facts:

```json
{
  "id": "firm-matter-001",
  "synthetic": true,
  "profile": {
    "title": "Synthetic invoice dispute",
    "court": "Court to be checked",
    "courtType": "other",
    "claimant": "Fictional supplier",
    "defendant": "Fictional customer",
    "side": "Defendant (Fictional customer)",
    "relationship": "commercial",
    "asOf": "2026-10-04"
  },
  "documents": [
    {"id": "invoice-001", "title": "Synthetic invoice", "short": "Invoice", "text": "Payment due on 2026-09-01.", "date": "2026-09-01", "docType": "invoice"}
  ],
  "facts": [],
  "qualifications": []
}
```

Save this as a local request file; POST it to `/api/v1/cases` with `Content-Type: application/json` and the server bearer key. Then POST deterministic analysis and GET export. The full fixture/export example is reproduced by `integration:smoke`. Empty annotations remain empty: importing text alone does **not** pretend to perform fresh AI extraction.

Optional `facts`/`qualifications` follow the OpenAPI schemas and existing CaseBundle terminology. The server rejects unknown fields, invalid IDs/dates/types, duplicate IDs, reserved built-in/library IDs, mismatched quotes, references to missing documents/facts/writs/qualifications and input limits. It recomputes quote verification and assigns imported legal proposals low-confidence `ai_inferred` provenance. A quote match is not proof that the source's claim is true. All decisions begin `proposed`. The existing engine's conservative `ai_inferred` category is reused internally, but imported source proposals are labeled **Imported proposal / Firm import · review required** in the workspace, not falsely described as actual AI extraction or hand-checked reference output.

The export contains `version`, `bundle`, `state`, deterministic `analysis`, `memoMarkdown`, `reviewRequired:true` and optional `aiReview`. This is the **server baseline**, not browser-only lawyer confirmations or what-if state; those are not transmitted to the integration API in this slice. No model produces or modifies the deterministic memo.

### AI invocation provenance

A successful optional review includes `aiReview.live:true`, `providerUsed` (configured adapter protocol), `profileId`, `model` and `requestCount:1`. This receipt is assigned only after the selected client's API call succeeds and its document references pass validation. `live` describes the invocation at analysis time, not legal truth. Subsequent exports preserve the receipt without new calls. Deterministic analysis has no AI receipt and makes no provider request. Connection tests separately return top-level `live:true`.

Early browser instrumentation defaulted an absent **top-level** `live` field to false on all analyse/export responses. That flag did not mean no upstream review occurred. Its original evidence is retained with this caveat; final receipt evidence verifies the explicit nested review receipt. The bounded verification budget is three genuine Mistral requests total: one connection test and two review calls (the second verifies receipt hardening). No other live provider calls are needed by the smoke suite.

## Firm-owned AI API profiles

Use server-only `DOMINO_AI_PROFILES`, a JSON array of at most 10 profiles. Every profile explicitly specifies:

```json
[
  {
    "id": "firm-ai",
    "label": "Firm private text API",
    "protocol": "openai-compatible-chat",
    "model": "firm-model",
    "baseUrl": "http://127.0.0.1:9911/v1",
    "credentialEnv": "FIRM_AI_API_KEY",
    "trustedOrigins": ["http://127.0.0.1:9911"]
  }
]
```

Set the referenced credential in the server environment, not the UI. A default Mistral profile uses `MISTRAL_API_KEY`, `https://api.mistral.ai/v1`, and `ministral-8b-latest`. Supported protocols reuse the existing adapter:

- `mistral-chat`: Mistral chat/JSON schema protocol.
- `openai-compatible-chat`: compatible chat-completions plus JSON-schema output (not every server supports it; test your model).
- `openai-responses`: existing native OpenAI Responses API protocol, **not** a generic chat-completions claim.

The configured URL must have an exact origin in `trustedOrigins`, no embedded credentials/query/fragment and HTTPS except explicit local loopback HTTP. HTTP redirects are rejected to prevent credential forwarding. No request/browser can supply a URL, model override or credential. Metadata excludes keys, credential references and private base URLs. Self-hosted/alternative profiles are contract-tested with explicitly fake transports; only default Mistral is genuinely exercised in this handoff. Neither embeddings nor OCR is advertised by these text-review profiles.

A consumer ChatGPT, Claude or Le Chat subscription is not assumed to include API access. A firm needs an API-enabled account/key or a compatible self-hosted endpoint; Claude's native Messages API is not implemented here. No browser-auth bypass, session scraping or conversion of consumer subscriptions occurs.

Text AI configuration does not modify Mistral Voxtral STT/realtime transcription. The original `/api/cases` upload/sample workflow and ingest → retrieval → extraction/qualification agents remain intact. This new versioned `ai-review` operation is **bounded commentary over normalized evidence plus deterministic output**, not the existing multi-agent full fresh extraction workflow. Firm-profile selection is wired into the actual versioned analysis request, not merely a settings card; full agent/OCR/embedding profile propagation is future work.

## Limits and production prerequisites

Current hard bounds: 1 MB HTTP body, 10-second body wait, 30-second AI timeout, one outbound request/no retry per test or review, 120 authorized requests/minute per local handler, at most two active requests, 20 in-memory matters, 30 documents/matter, 200000 characters/document and 500000 total document characters, 100 facts/proposals, three anchors per annotation. AI review receives all accepted document text and the memo without silent truncation. Provider context limits may cause an explicit review failure; the last successful analysis/export is preserved. Commentary remains non-exhaustive and requires lawyer review. Failed analysis preserves the previous completed export. Duplicate imports return 409, not silent overwrite.

This is **local, single-tenant and synthetic**, not production multi-tenant security. Existing unversioned demo endpoints are preserved and are not retroactively converted into firm-authenticated routes. Production requires an authenticated gateway across every route, RBAC/tenant isolation, explicit client-data permissions, audit/retention policy, encryption/secrets lifecycle, request/global rate enforcement across replicas and reviewed legal source coverage. The existing C1 case-law placeholder and typed statutory demo excerpts remain review-required.

No push, PR, merge, deployment or unsolicited firm-system write is part of this delivery. Commit and verification remain local on `feature/law-firm-integrations`.
