# Domino — demo front-end

Static site, no build step.

- `index.html` — the whole app (HTML, CSS, JS inline)
- `film3d.js` — 3D intro film (three.js)
- `three.min.js` — three.js r160

Run locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000
(opening the file directly also works). Deep links: `#facts`, `#chains`, `#memo` skip the intro.

Deploy: upload the folder as-is to any static host (Cloudflare Pages, Netlify, Vercel, GitHub Pages).
