const $ = (id) => document.getElementById(id);
const textEl = $("text"), countEl = $("count"), errEl = $("error"), resEl = $("result"), btn = $("check");
let MAX = 15000;
const SAMPLES = {
  ai: "Artificial intelligence is transforming the way businesses operate in today's fast-paced world. By leveraging advanced algorithms, organizations can streamline processes, enhance productivity, and make data-driven decisions. This technology offers numerous benefits across industries, from healthcare to finance. As AI continues to evolve, it is essential for businesses to adapt and embrace these innovations to remain competitive.",
  human: "I missed the 7:40 bus again, so I walked. Honestly it was nicer than I expected: cold, a bit foggy, and the bakery on Orchard Street had just opened. I bought a roll I didn't need and ate it before I got to the corner. Still arrived five minutes late, but at least I wasn't annoyed about it.",
};
SAMPLES.mixed = `${SAMPLES.human} ${SAMPLES.ai}`;

function updateCount() {
  const length = textEl.value.length;
  countEl.textContent = `${length.toLocaleString()} / ${MAX.toLocaleString()} characters`;
  countEl.style.color = length > MAX ? "var(--ai)" : "";
}
function showError(message) { errEl.textContent = message; errEl.hidden = !message; }
function tint(score) {
  const color = score < 0.3 ? "var(--human)" : score < 0.7 ? "var(--mix)" : "var(--ai)";
  return `color-mix(in srgb, ${color} ${Math.round(10 + score * 40)}%, transparent)`;
}
function render(data) {
  resEl.hidden = false;
  $("verdict").textContent = data.label;
  $("marker").style.left = `${Math.min(98, Math.max(2, data.aiScore * 100))}%`;
  $("score-note").textContent = `AI likelihood: ${Math.round(data.aiScore * 100)}%${data.demo ? " (demo value, not a real detection)" : ""}`;
  const box = $("sentences");
  box.textContent = "";
  (data.sentences.length ? data.sentences : [{ text: "No sentence-level data returned.", score: 0 }]).forEach((sentence) => {
    const span = document.createElement("span");
    span.textContent = `${sentence.text} `;
    span.style.background = tint(sentence.score);
    span.title = `${Math.round(sentence.score * 100)}% AI-like`;
    box.appendChild(span);
  });
  resEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.querySelectorAll("[data-sample]").forEach((button) => button.addEventListener("click", () => {
  textEl.value = SAMPLES[button.dataset.sample]; updateCount(); showError("");
}));
$("clear").addEventListener("click", () => {
  textEl.value = ""; resEl.hidden = true; showError(""); updateCount(); textEl.focus();
});
textEl.addEventListener("input", updateCount);

btn.addEventListener("click", async () => {
  showError("");
  const text = textEl.value.trim();
  if (text.length < 50) return showError("Enter at least 50 characters.");
  if (text.length > MAX) return showError(`Text is over the ${MAX.toLocaleString()} character limit.`);
  btn.disabled = true; btn.textContent = "Checking...";
  try {
    const response = await fetch("/api/detect", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    render(data);
  } catch (error) { showError(error.message || "Could not reach the server."); }
  finally { btn.disabled = false; btn.textContent = "Check for AI"; }
});

fetch("/api/status").then((response) => response.json()).then((status) => {
  MAX = status.maxChars; textEl.maxLength = MAX; $("demo-banner").hidden = !status.demo; updateCount();
}).catch(updateCount);
updateCount();

$("file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { showError("File is too large. Use a .txt file under 1 MB."); event.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = () => { textEl.value = String(reader.result); updateCount(); showError(textEl.value.length > MAX ? `File text is over the ${MAX.toLocaleString()} character limit.` : ""); };
  reader.onerror = () => showError("Could not read that file.");
  reader.readAsText(file);
  event.target.value = "";
});

$("copy").addEventListener("click", async () => {
  const button = $("copy");
  const summary = `${$("verdict").textContent}. ${$("score-note").textContent} (checked with Chat Detector)`;
  try { await navigator.clipboard.writeText(summary); button.textContent = "Copied"; }
  catch { button.textContent = "Copy failed"; }
  setTimeout(() => { button.textContent = "Copy result"; }, 1500);
});
