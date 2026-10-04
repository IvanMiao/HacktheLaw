# Embedded case integration — verification and handoff

## Delivered scope

Four selectable datasets: original combined C1/C2, C3 insolvency, C4 order of objections and C5 ordinary appeal lapse. The source DOCX is unchanged. Additional exhibits are embedded authored **SYNTHETIC** fixtures, not retrieved court records or official statutory excerpts. Rule documents are explicitly synthetic summaries with lawyer-review flags.

- `web/src/data/catalog.ts`: server-known datasets, facts, qualifications and independent source IDs.
- `web/src/data/CaseContext.tsx`: active browser dataset, original PDF asset enrichment.
- `web/src/data/caseSession.ts`: synchronous case identity plus monotonically increasing generation; rejects stale A→B→A callbacks.
- `web/src/engine/additionalChains.ts`: pure C3/C4/C5 analysis; explicit dataset arguments retain original engine compatibility.
- `web/src/engine/proceduralDates.ts`: CPC 641 month-end computation and CPC 642 next-working-day extension using metropolitan France national holidays.
- `web/src/voice/contract.ts`: selected-case schema, strict target/citation validation and server-owned context recomputation. Compatibility `SOURCE_IDS`, `LINK_IDS`, `INTENT_SCHEMA` describe **only the original case**, never a permissive all-case union.
- `web/src/i18n/casesFr.ts`: additive EN/FR translations; original dictionary and source-document French remain intact.
- Facts, chips, source viewer, chains and memo consume the active dataset. A keyed CaseApp resets decisions, hypotheses, selection, source, transcript and drawers on switching. VoicePanel is explicitly keyed by case ID for streaming-worker integration/unmount cancellation.

Original case-law Markdown is embedded in a pure TypeScript text module for native Node server parity; a regression test verifies equality to the original team Markdown (ignoring trailing newline). Original PDFs remain attached only in the browser provider. No dependencies or secrets were added.

## Legal corrections and boundaries

1. **C3 countdown:** 20 May 2026 is 137 days before 4 October 2026, not “in seven months”. Derived output computes the expired deadline; the DOCX remains immutable.
2. **C3 independent effects:** a timely regular declaration breaks only the non-declaration/forclusion chain. The separate L622-21/L631-14 payment-action stay still holds. Omission or knowledge evidence does not automatically grant relief; an application, statutory timing/proof and a court order are required.
3. **C3 knowledge exception:** inability to know the debtor's obligation/the existence of the debt is not mere ignorance of insolvency proceedings. The source sketch conflates them; the qualification and review note correct that distinction.
4. **C3 debtor list:** L622-24 deemed declaration is a material review issue. The synthetic register explicitly states no regular direct or deemed declaration, rather than deriving this from a missing document. The list fixture explicitly limits what its inclusion proves. Real use must review the debtor's transmission and any presumed declaration.
5. **C4:** merits-first sequencing can bar the party-raised objection independently of clause validity. Timely, reasoned objection naming the court removes the timing bar only; no guaranteed transfer. Consumer-clause own-motion review is a separate review point, not an AI-adjudicated transfer. R631-3 does not automatically transfer this defendant case.
6. **C5:** raw three-month deadline 1 November 2025 is Saturday/All Saints; adjusted deadline is Monday 3 November. Filing on 20 November is 17 days after the adjusted deadline, not the source's unqualified 19 days. Adjustment is independent of the original substantive-limitation toggle. Calendar covers national metropolitan France holidays, not local holidays/court closure orders.
7. **C5:** timely-filing and force-majeure changes are expressly hypothetical **pre-order** scenarios. They cannot withdraw or undo the existing 15 December lapse order. Potential finality requires no surviving incidental appeal, other valid appeal or remaining remedy; authored fixture assertions do not replace real checks.

## Source checks and limitations

Official-source indexed text was retrieved through web-search results; direct full-page extraction was unavailable in the configured backend, and the live Légifrance browser showed Cloudflare security verification. Thus these are **indexed official-text checks, not certification that every current full provision or cited judgment was independently retrieved**.

| Rule | Retrieved evidence / source |
|---|---|
| CPC 641 | Indexed official same-quantième month computation: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006411002/ |
| CPC 642 | Indexed official Saturday/Sunday/public-holiday extension text: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006411003 |
| CPC 74 | Indexed official simultaneous/before-merits timing rule, including public-order grounds: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006410179 |
| CPC 908 | Indexed official three-month ordinary-appeal deadline: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048869023 |
| CPC 911 | Indexed official non-imputable/insurmountable force majeure, and lapse order cannot be withdrawn: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048868931 |
| C. com. L622-21 | Indexed official payment-action stay, version since 1 October 2021: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044052603/2026-04-29 |
| C. com. L622-26 | Indexed official relief grounds, six-month period and debt-knowledge exception: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044052612 |
| C. com. R622-24 | Indexed official two-month BODACC period and geographic extension: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029175247 |
| C. com. L622-24 | Indexed official historical provision confirms debtor-presumption issue; current full provision still requires review: https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006133197/2021-01-28 |
| C. trav. L3133-1 | Indexed official national holiday list, including All Saints: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020901 |

CPC 48/75/77, consumer-code residual powers, L631-14 and the DOCX's individual case-law citations were not independently checked against complete current official texts in this lane. They remain explicit legal-review items; no synthetic summary is marked as retrieved official law.

## Executed gates

- Merge `origin/main` (32b967b) into the voice baseline ea60489: merge commit **338c29b**. Combined both App import blocks and README sections; retained main bilingual improvements and original voice additions. Baseline: 45 tests, build passed.
- Observed RED then GREEN: catalog/engines/procedural calendar; active-case SSR; case-scoped voice context/intent/schema; bilingual additional-case text; stale case-generation guard; chronological C5 timeline regression. New-module REDs reported missing implementation modules; UI/voice/date/i18n regressions also produced explicit assertion failures before implementation.
- Final `npm test`: **68 tests / 14 files passed** (all original tests retained).
- `npm run build`: TypeScript project build and Vite production bundle passed; both original PDFs included.
- `npm run typecheck:server`: passed.
- `npm run lint`: passed, no warnings.
- Native Node import of `server/api.ts`: passed.
- `git diff --check`: passed; DOCX diff against origin/main empty.
- Node 25.8.0 is outside the installed Vitest declared engine range; existing npm engine warning was observed during `npm ci`. No package upgrade was needed. Final test output has no runtime warning; Vitest may print its informational transform-caching suggestion.

## Browser acceptance

Isolated browser session `domino-cases`, local Vite port **5174**. Sanitized ignored evidence: `web/.verification/cases-browser.json`.

- All **4 cases / 32 fact rows** were enumerated and counted in code; every fact navigated to the corresponding document with its actual anchor highlighted.
- Case-specific memos and source catalogs rendered without foreign-case body content. C3/C4/C5 procedural timelines and date corrections verified.
- Explicit **TEST-ONLY browser fetch injection**, not real Mistral/STT or user microphone: original acknowledgment; C3 timely declaration (forclusion broken, stay intact); C4 objection-before-merits; C5 timely filing and force majeure pre-order previews; C5 lapse-order evidence navigation. Reviewed decisions survived preview/reset.
- Every dataset tested EN→FR→EN; translated facts/qualifications/chains/notices/memo and preservation of review/hypothesis were verified. Case switching reset decisions, hypotheses, transcript, source/fact selection and drawer; return to original restored baseline.
- Foreign original-case intent rejected in C3. Delayed C3 provider response after C3→C4→C3 was rejected without preview, transcript or result leakage. No runtime errors during that isolation test.
- Width measured 1280px with no document-level horizontal overflow. This is DOM acceptance, not a visual-design claim or live microphone certification.
- Separate HTTP tests inject fake providers into the actual handler for all four selected-case schemas and reject forged context before provider invocation and foreign provider citations after invocation.

## Parent integration and local startup

Do not replace the realtime worker's VoicePanel, client transport, streaming modules or server launch. Reconcile App/contract/API conflicts with its commit 55d58d1. Required shared contract changes: `VoiceContext.caseId` and `VoiceContext.whatIf`; `buildContext(state, dataset)`; `intentSchemaFor(context)`; server `validateCaseContext`; explicit keyed VoicePanel; case-session generation assertion before queued command application. Keep the realtime worker's dynamic context getter and cancellation cleanup.

After parent merges both lanes and reruns integrated gates, run from the merged `web/` directory:

1. `npm ci` if that checkout has no dependencies.
2. `npm run voice:server` using the already authorized local server-only environment/vault key. This case lane does not copy or require a real key.
3. `npm run dev -- --host localhost --port=5173 --strictPort`.
4. Open `http://localhost:5173/?mode=chains&case=c3&lang=en`; choose any case from the top selector. `case=c1-c2`, `case=c3`, `case=c4`, `case=c5` are supported.

Default manual server origin policy permits port 5173 only. The isolated 5174 browser acceptance therefore used labelled injection rather than loosening origin policy or claiming live provider testing. Parent owns integrated real streaming/microphone acceptance and the final local URL; no remote push or deployment is part of this lane.

Manual acceptance after the integrated build: select each case, inspect one highlighted source and its memo, switch EN/FR, turn realtime voice ON once and speak a case-specific hypothetical, then turn OFF once. Examples: C3 “What if the claim was declared in time?” (stay still active); C4 “What if jurisdiction was objected to before the merits?” (no guaranteed transfer); C5 “What if submissions were filed in time?” or qualifying force majeure (pre-order only). Switch case while voice is pending to check unmount/cancellation, then return to original and verify no leaked hypothesis. These are product checks on a completed local build, not instructions for the user to debug unfinished code.
