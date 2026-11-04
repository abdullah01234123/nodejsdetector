# Chat Detector

Node.js and Express app with a static frontend for checking text. The interface works immediately in **demo mode**, which returns placeholder scores and is not real AI detection.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```sh
npm ci
npm start
```

Open <http://localhost:3000>. No `.env` file is required for demo mode. To use settings from `.env`, copy `.env.example` to `.env`; Node.js 20.6+ supports `node --env-file=.env server.js`. Alternatively export the values in your shell. The default `npm start` command intentionally does not load `.env` automatically.

For development with automatic server restarts, use `npm run dev`. Run basic syntax checks with `npm run check`.

## Configuration

- `DETECTOR_PROVIDER=demo` (default): deterministic placeholder values; **not actual detection**.
- `DETECTOR_PROVIDER=sapling` and `SAPLING_API_KEY=...`: uses the Sapling API. Confirm the endpoint, request fields, response shape, pricing, and privacy terms against Sapling's current documentation before relying on it.
- `PORT=3000`: listening port; hosting platforms can set this.
- `MAX_CHARS=15000`: maximum input size.
- `RATE_LIMIT_PER_HOUR=20`: requests allowed per IP per hour.
- `TRUST_PROXY=true`: enable only when deployed behind a trusted reverse proxy configured by your host.

## Project layout

```text
.
├── package.json
├── package-lock.json
├── server.js
├── .env.example
├── .gitignore
├── README.md
└── public/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── methodology.html
    ├── about.html
    ├── privacy.html
    ├── terms.html
    ├── contact.html
    ├── 404.html
    ├── robots.txt
    └── sitemap.xml
```

## Before production

1. Configure and test a real provider; demo scores are not detection results.
2. Review privacy, terms, and methodology against the provider and your jurisdiction. The included legal text is a template, not legal advice.
3. Replace the example domain and contact email in the public pages, `robots.txt`, and `sitemap.xml`.
4. Add abuse protection such as a CAPTCHA/Turnstile and configure proxy trust appropriately for your hosting provider.
5. Deploy on a Node.js host. The server serves assets and extensionless HTML routes from `public/`.
