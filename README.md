# Chat Detector

Express server plus a static frontend for an AI/ChatGPT text detector.

## Run locally
```
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm start                # http://localhost:3000
```
Node 18+ required. The server reads environment variables (set them in your shell or hosting dashboard; `.env` is not auto-loaded, so for local use run `node --env-file=.env server.js` on Node 20+).

## Modes
- `DETECTOR_PROVIDER=demo` (default): placeholder numbers so you can test the UI. **Not real detection.**
- `DETECTOR_PROVIDER=sapling` with `SAPLING_API_KEY`: real scores via Sapling. Verify the request fields in `server.js` against Sapling's current docs. To use another provider, add a function to `providers` returning `{ aiScore (0-1), sentences: [{text, score}], demo:false }`.

## Built in
Character cap, minimum length, per-IP rate limit, result cache (hashes only, text is never stored), safe DOM rendering, SEO meta, canonical, WebApplication JSON-LD, robots.txt, sitemap.xml.

## Pages
Home (tool, sample buttons, .txt upload, copy result), methodology, about, privacy, terms, contact, 404. Privacy and terms are templates: have them reviewed. The contact email is a placeholder.

## Before going live
1. Test your chosen API on known human and AI samples.
2. Add Cloudflare Turnstile before opening it to the public.
3. Add privacy policy, terms, and a methodology page; confirm the privacy wording matches your provider.
4. Replace `chatdetector.com` in `index.html`, `robots.txt`, `sitemap.xml` if your domain differs.
5. Deploy to a Node host (Render, Railway, Fly.io) and connect the domain.
