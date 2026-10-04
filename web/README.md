# Domino — web demo

Front-end demo of the Domino PRD (`../docs/PRD.md`). AI outputs are precomputed; the chain engine, limitation sub-engine and counterfactuals run live in the browser.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests against the expected results of PRD §11
```

Sources: the two Cour de cassation decisions in `../data/caselaw/` are real. The case file, statutory excerpts and the Cass. 2e civ. authority for chain C1 are mocks, labelled as such in the UI.

Shortcuts: `1`/`2`/`3` modes · `J`/`K` facts · `C`/`R` confirm/reject · `P` presenter mode · `Esc` close drawer.
Screenshot URLs: `?mode=chains&link=c1-cons`, `?mode=chains&confirmed&whatif=q-email`.
