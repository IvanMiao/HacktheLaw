# Domino — web demo

Front-end demo of the Domino PRD (`../docs/PRD.md`). AI outputs are precomputed; the chain engine, limitation sub-engine and counterfactuals run live in the browser.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # chain, review, persistence, memo and translation tests
```

Sources: the two Cour de cassation decisions in `../data/caselaw/` are real. The case file, statutory excerpts and the Cass. 2e civ. authority for chain C1 are mocks, labelled as such in the UI.

Shortcuts: `1`/`2`/`3` modes · `J`/`K` facts · `S`/`U`/`I` supported/unsupported/insufficient · `P` presenter mode · `Esc` close drawer. Review shortcuts are disabled while editing notes or previewing a hypothetical.
Screenshot URLs: `?mode=chains&link=c1-cons`, `?mode=chains&whatif=q-email`. URL parameters never approve saved reviews.

## Evidence review and follow-up

Each suggested assessment can be **Supported**, **Unsupported**, or **Insufficient**. Unsupported does not invert the assessment; insufficient evidence does not establish an event's absence. Dependent arguments remain blocked or provisional until their required assessments are supported. The conciliation assessment starts insufficient because an exhibit list alone cannot establish that conciliation was omitted.

The review workspace provides source inspection, a correction note, an editable evidence-request draft, next steps, and links to affected arguments and the memo. Notes document a proposed correction; they do not silently replace source facts. Review statuses, notes and next steps are saved in this browser when storage is available and included in copied Markdown. If storage is unavailable, the UI reports that reviews last only for the session.

Alternative interpretations are explicitly hypothetical. They cannot edit saved reviews and are never restored as adopted positions. Only supported chains count in the banner and appear as potential grounds in the memo. Existing demo rules and precomputed source material retain their original scope.

Language: use the EN / FR switch on the welcome screen or in the top bar. The choice is remembered in this browser. Share `?lang=fr` or `?lang=en` links (combinable with the screenshot parameters). Switching keeps the current review decisions and what-if scenario. The interface, analysis and copied Markdown memo are translated; source documents, citation quotes and PDFs retain their original French text.
