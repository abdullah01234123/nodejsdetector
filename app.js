const $ = (id) => document.getElementById(id);
const textEl = $("text"), countEl = $("count"), errEl = $("error"), resEl = $("result"), btn = $("check");
let MAX = 15000;

const SAMPLES = {
  ai: "Artificial intelligence is transforming the way businesses operate in today's fast-paced world. By leveraging advanced algorithms, organizations can streamline processes, enhance productivity, and unlock valuable insights. Furthermore, it is important to note that ethical considerations must be addressed. In conclusion, embracing AI responsibly will pave the way for a brighter and more efficient future.",
  human: "I missed the 7:40 bus again, so I walked. Honestly it was nicer than I expected: cold, a bit foggy, and the bakery on Orchard Street had just opened. I bought a roll I didn't need and ate it on the bridge. Work could wait ten minutes. It's strange how a small detour can reset a whole morning.",
};
SAMPLES.mixed = SAMPLES.human + " " + SAMPLES.ai;

function updateCount() {
  const n = textEl.value.length;
  countEl.textContent = n.toLocaleString() + " / " + MAX.toLocaleString() + " characters";
  countEl.style.color = n > MAX ? "var(--ai)" : "";
}
function showError(m) { errEl.textContent = m; errEl.hidden = !m; }
function tint(score) {
  const c = score < 0.3 ? "var(--human)" : score < 0.7 ? "var(--mix)" : "var(--ai)";
  const a = Math.round(10 + score * 40);
  return "color-mix(in srgb, " + c + " " + a + "%, transparent)";
}
function render(d) {
  resEl.hidden = false;
  $("verdict").textContent = d.label;
  $("marker").style.left = Math.min(98, Math.max(2, d.aiScore * 100)) + "%";
  $("score-note").textContent = "AI likelihood: " + Math.round(d.aiScore * 100) + "%" + (d.demo ? " (demo value, not a real detection)" : "");
  const box = $("sentences"); box.textContent = "";
  (d.sentences.length ? d.sentences : [{ text: "No sentence-level data returned.", score: 0 }]).forEach((s) => {
    const sp = document.createElement("span");
    sp.textContent = s.text + " ";
    sp.style.background = tint(s.score);
    sp.title = Math.round(s.score * 100) + "% AI-like";
    box.appendChild(sp);
  });
  resEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.querySelectorAll("[data-sample]").forEach((b) =>
  b.addEventListener("click", () => { textEl.value = SAMPLES[b.dataset.sample]; updateCount(); showError(""); }));
$("clear").addEventListener("click", () => { textEl.value = ""; resEl.hidden = true; showError(""); updateCount(); textEl.focus(); });
textEl.addEventListener("input", updateCount);

btn.addEventListener("click", async () => {
  showError("");
  const text = textEl.value.trim();
  if (text.length < 50) return showError("Enter at least 50 characters.");
  if (text.length > MAX) return showError("Text is over the " + MAX.toLocaleString() + " character limit.");
  btn.disabled = true; btn.textContent = "Checking...";
  try {
    const r = await fetch("/api/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Something went wrong.");
    render(d);
  } catch (e) { showError(e.message); }
  finally { btn.disabled = false; btn.textContent = "Check for AI"; }
});

fetch("/api/status").then((r) => r.json()).then((s) => { MAX = s.maxChars; $("demo-banner").hidden = !s.demo; updateCount(); }).catch(updateCount);
updateCount();

// File upload (.txt only; DOCX/PDF need server-side extraction)
$("file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 1024 * 1024) return showError("File is too large. Use a .txt file under 1 MB.");
  const rd = new FileReader();
  rd.onload = () => { textEl.value = String(rd.result); updateCount(); showError(textEl.value.length > MAX ? "File text is over the " + MAX.toLocaleString() + " character limit." : ""); };
  rd.onerror = () => showError("Could not read that file.");
  rd.readAsText(f);
  e.target.value = "";
});

// Copy result summary
$("copy").addEventListener("click", async () => {
  const msg = $("verdict").textContent + ". " + $("score-note").textContent + " (checked with Chat Detector)";
  try { await navigator.clipboard.writeText(msg); $("copy").textContent = "Copied"; }
  catch { $("copy").textContent = "Copy failed"; }
  setTimeout(() => ($("copy").textContent = "Copy result"), 1500);
});
