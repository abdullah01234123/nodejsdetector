const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PROVIDER = (process.env.DETECTOR_PROVIDER || "demo").toLowerCase();
const MAX_CHARS = Number(process.env.MAX_CHARS || 15000);
const MIN_CHARS = 50;
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 20);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checks from your network. Please try again later." },
});

// Small in-memory cache: stores results keyed by a hash, never the text itself.
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
function cacheGet(k) {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > CACHE_TTL) { cache.delete(k); return null; }
  return v.data;
}
function cacheSet(k, data) {
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(k, { t: Date.now(), data });
}

const splitSentences = (t) => (t.match(/[^.!?\n]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
const label = (s) => (s < 0.3 ? "Likely human" : s < 0.7 ? "Mixed" : "Likely AI");

// DEMO provider: deterministic placeholder numbers so you can test the interface.
// These are NOT detection results.
function demoDetect(text) {
  const sentences = splitSentences(text).map((s) => {
    const h = crypto.createHash("md5").update(s).digest()[0] / 255;
    return { text: s, score: Math.round(h * 100) / 100 };
  });
  const avg = sentences.reduce((a, b) => a + b.score, 0) / (sentences.length || 1);
  return { aiScore: avg, sentences, demo: true };
}

// SAPLING provider (verify request/response fields against Sapling's current docs).
async function saplingDetect(text) {
  const key = process.env.SAPLING_API_KEY;
  if (!key) throw new Error("SAPLING_API_KEY is not set.");
  const r = await fetch("https://api.sapling.ai/api/v1/aidetect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, text, sent_scores: true }),
  });
  if (!r.ok) throw new Error("Detection provider returned status " + r.status);
  const d = await r.json();
  const sentences = (d.sentence_scores || []).map((s) => ({ text: s.sentence, score: s.score }));
  return { aiScore: d.score, sentences, demo: false };
}

const providers = { demo: demoDetect, sapling: saplingDetect };

app.get("/api/status", (req, res) => res.json({ provider: PROVIDER, maxChars: MAX_CHARS, demo: PROVIDER === "demo" }));

app.post("/api/detect", limiter, async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (text.length < MIN_CHARS) return res.status(400).json({ error: `Enter at least ${MIN_CHARS} characters.` });
  if (text.length > MAX_CHARS) return res.status(400).json({ error: `Text is over the ${MAX_CHARS.toLocaleString()} character limit.` });
  const fn = providers[PROVIDER];
  if (!fn) return res.status(500).json({ error: "Detector is not configured." });

  const key = PROVIDER + ":" + crypto.createHash("sha256").update(text).digest("hex");
  const hit = cacheGet(key);
  if (hit) return res.json(hit);
  try {
    const out = await fn(text);
    const data = { provider: PROVIDER, demo: out.demo, aiScore: out.aiScore, label: label(out.aiScore), sentences: out.sentences };
    cacheSet(key, data);
    res.json(data);
  } catch (e) {
    console.error(e.message);
    res.status(502).json({ error: "The detector could not process this text. Please try again." });
  }
});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "public", "404.html")));

app.listen(PORT, () => console.log(`Chat Detector running on http://localhost:${PORT} (provider: ${PROVIDER})`));
