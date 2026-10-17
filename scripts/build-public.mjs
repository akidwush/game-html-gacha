import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../game.html", import.meta.url);
const outputPath = new URL("../public/game.html", import.meta.url);
let html = await readFile(sourcePath, "utf8");

function replaceOnce(label, search, replacement) {
  if (!html.includes(search)) throw new Error(`Build injection failed: ${label}`);
  html = html.replace(search, replacement);
}

replaceOnce(
  "chance CSS",
  "</style>",
  `\n/* Casual per-IP gacha chance indicator (server is source of truth) */\n.chance-strip {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 7px;\n  width: fit-content;\n  max-width: 100%;\n  margin: -2px auto 0;\n  padding: 5px 12px;\n  border: 2.5px solid var(--ink);\n  border-radius: 999px;\n  background: linear-gradient(180deg, #fff9db 0%, #ffe47b 100%);\n  box-shadow: 0 3px 0 rgba(71, 36, 21, 0.18);\n  font-size: 11px;\n  font-weight: 900;\n  letter-spacing: .25px;\n}\n.chance-strip.is-empty {\n  background: #eadfd6;\n  opacity: .88;\n}\n.chance-count {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 38px;\n  padding: 1px 7px;\n  border: 2px solid var(--ink);\n  border-radius: 999px;\n  background: #fff;\n  font-size: 12px;\n}\n</style>`
);

replaceOnce(
  "chance HTML",
  `  <div class="status-banner" role="status" aria-live="polite">\n    <span class="status-dot" aria-hidden="true"></span>\n    <span id="statusText">Move the claw &amp; catch a capsule!</span>\n  </div>`,
  `  <div class="status-banner" role="status" aria-live="polite">\n    <span class="status-dot" aria-hidden="true"></span>\n    <span id="statusText">Move the claw &amp; catch a capsule!</span>\n  </div>\n  <div class="chance-strip" id="chanceStrip" aria-live="polite">\n    <span aria-hidden="true">🎟️</span> CHANCES\n    <strong class="chance-count" id="chances">5/5</strong>\n    <span>per IP</span>\n  </div>`
);

replaceOnce(
  "chance JS refs",
  `const statusText = $("#statusText");`,
  `const statusText = $("#statusText");\nconst chancesEl = $("#chances"), chanceStrip = $("#chanceStrip");`
);

replaceOnce(
  "chance state",
  `let toys = [], busy = false, x = 0.52, wins = 0;`,
  `let toys = [], busy = false, x = 0.52, wins = 0;\nlet gachaRemaining = 5, gachaLimit = 5, limitReached = false;`
);

replaceOnce(
  "chance helpers",
  `function setStatus(msg) {\n  if (statusText) statusText.textContent = msg;\n}`,
  `function setStatus(msg) {\n  if (statusText) statusText.textContent = msg;\n}\n\nfunction updateChanceUI(status = {}) {\n  if (Number.isFinite(Number(status.limit))) gachaLimit = Number(status.limit);\n  if (Number.isFinite(Number(status.remaining))) gachaRemaining = Math.max(0, Number(status.remaining));\n  limitReached = gachaRemaining <= 0;\n  if (chancesEl) chancesEl.textContent = \`\${gachaRemaining}/\${gachaLimit}\`;\n  if (chanceStrip) chanceStrip.classList.toggle("is-empty", limitReached);\n  if (drop) drop.disabled = busy || limitReached;\n  if (limitReached) setStatus("Limit reached — 5 kesempatan gacha untuk IP ini sudah habis.");\n}\n\nasync function loadGachaStatus() {\n  try {\n    const res = await fetch("/api/gacha/status", { headers: { accept: "application/json" }, cache: "no-store" });\n    if (!res.ok) return;\n    updateChanceUI(await res.json());\n  } catch (_) {\n    // Casual limit: game tetap bisa dibuka jika status endpoint sementara gagal.\n  }\n}`
);

replaceOnce(
  "disable respects limit",
  `function disable(v) {\n  busy = v;\n  left.disabled = v;\n  right.disabled = v;\n  drop.disabled = v;\n}`,
  `function disable(v) {\n  busy = v;\n  left.disabled = v;\n  right.disabled = v;\n  drop.disabled = v || limitReached;\n}`
);

replaceOnce(
  "drop limit guard",
  `async function dropClaw() {\n  if (busy) return;`,
  `async function dropClaw() {\n  if (limitReached) {\n    notify("5 kesempatan gacha untuk IP ini sudah habis.");\n    setStatus("Limit reached — 5 kesempatan gacha untuk IP ini sudah habis.");\n    return;\n  }\n  if (busy) return;`
);

replaceOnce(
  "roll response limit handling",
  `    const data = await res.json();\n    if (!res.ok) throw new Error(data.error || "Roll gagal");\n    if (data.type === "random") await attachRandomMeme(data);`,
  `    const data = await res.json();\n    if (!res.ok) {\n      if (res.status === 429 && data.error === "GACHA_LIMIT_REACHED") {\n        updateChanceUI(data);\n        showReward({\n          type: "limit", tier: "0 LEFT", title: "LIMIT REACHED",\n          message: "Kamu sudah memakai 5 kesempatan gacha untuk IP ini."\n        });\n        return;\n      }\n      throw new Error(data.error || data.message || "Roll gagal");\n    }\n    updateChanceUI(data);\n    if (data.type === "random") await attachRandomMeme(data);`
);

replaceOnce(
  "initial status load",
  `setX(x);\nsetTimeout(initToys, 80);`,
  `setX(x);\nsetTimeout(initToys, 80);\nloadGachaStatus();`
);

await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log("Built public/game.html with casual 5-roll-per-IP UI.");
