const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PROVIDER = (process.env.DETECTOR_PROVIDER || "demo").toLowerCase();
const MAX_CHARS = Number(process.env.MAX_CHARS) || 15000;
const MIN_CHARS = 50;
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR) || 20;
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
// Set this only when the app is deployed behind a trusted reverse proxy.
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checks from your network. Please try again later." },
});

// Cache result data by a one-way hash; submitted text is not stored in the cache.
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function cacheSet(key, data) {
  if (cache.size >= 500) cache.delete(cache.keys().next().value);
  cache.set(key, { createdAt: Date.now(), data });
}

const splitSentences = (text) => (text.match(/[^.!?\n]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
const label = (score) => score < 0.3 ? "Likely human" : score < 0.7 ? "Mixed" : "Likely AI";

// Demo values are deterministic placeholders, not actual AI detection.
function demoDetect(text) {
  const sentences = splitSentences(text).map((sentence) => {
    const value = crypto.createHash("md5").update(sentence).digest()[0] / 255;
    return { text: sentence, score: Math.round(value * 100) / 100 };
  });
  const aiScore = sentences.reduce((sum, sentence) => sum + sentence.score, 0) / (sentences.length || 1);
  return { aiScore, sentences, demo: true };
}

// Verify provider request/response fields against its current API documentation before production use.
async function saplingDetect(text) {
  const key = process.env.SAPLING_API_KEY;
  if (!key) throw new Error("SAPLING_API_KEY is not set.");
  const response = await fetch("https://api.sapling.ai/api/v1/aidetect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, text, sent_scores: true }),
  });
  if (!response.ok) throw new Error(`Detection provider returned status ${response.status}`);
  const result = await response.json();
  const sentences = (result.sentence_scores || []).map((item) => ({ text: item.sentence, score: item.score }));
  return { aiScore: result.score, sentences, demo: false };
}

const providers = { demo: demoDetect, sapling: saplingDetect };

app.get("/api/status", (_req, res) => {
  res.json({ provider: PROVIDER, maxChars: MAX_CHARS, demo: PROVIDER === "demo" });
});

app.post("/api/detect", limiter, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (text.length < MIN_CHARS) return res.status(400).json({ error: `Enter at least ${MIN_CHARS} characters.` });
  if (text.length > MAX_CHARS) return res.status(400).json({ error: `Text is over the ${MAX_CHARS.toLocaleString()} character limit.` });
  const detect = providers[PROVIDER];
  if (!detect) return res.status(500).json({ error: "Detector is not configured." });

  const key = `${PROVIDER}:${crypto.createHash("sha256").update(text).digest("hex")}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const result = await detect(text);
    if (!Number.isFinite(result.aiScore) || result.aiScore < 0 || result.aiScore > 1) {
      throw new Error("Detection provider returned an invalid score.");
    }
    const data = {
      provider: PROVIDER,
      demo: result.demo,
      aiScore: result.aiScore,
      label: label(result.aiScore),
      sentences: result.sentences,
    };
    cacheSet(key, data);
    return res.json(data);
  } catch (error) {
    console.error(error.message);
    return res.status(502).json({ error: "The detector could not process this text. Please try again." });
  }
});

app.use((_req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html")));

app.listen(PORT, () => console.log(`Chat Detector running on http://localhost:${PORT} (provider: ${PROVIDER})`));
