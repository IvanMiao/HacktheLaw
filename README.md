# HacktheLaw — Domino

Find the procedural domino that knocks out the claim — verifiable AI for French civil procedure. Mistral x Law hackathon.

- [Idea](docs/IDEA.md)
- [Product Requirements (PRD)](docs/PRD.md)
- [Law-firm integration development outline](docs/LAW_FIRM_INTEGRATION_PLAN.md)
- [Connections demo, API setup and boundaries](docs/LAW_FIRM_INTEGRATION.md)
- [Law-firm OpenAPI 3.1 contract](docs/law-firm-openapi.json)

## Run locally

Requires Node.js 24+ and Bun (for voice).

```bash
cd web
npm ci
cp .env.example .env.local
# Add your MISTRAL_API_KEY to .env.local.
npm run dev
```

Open [localhost:5173](http://localhost:5173). For voice, run `npm run voice:server` in a second terminal inside `web/`.

## Live demo

Hosted on Cloudflare Pages: [hackthelaw-domino.pages.dev](https://hackthelaw-domino.pages.dev).

See [web/README.md](web/README.md) for deployment details.
