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
  `
/* Casual per-IP/browser gacha chance indicator */
.chance-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: fit-content;
  max-width: 100%;
  margin: -2px auto 0;
  padding: 5px 12px;
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  background: linear-gradient(180deg, #fff9db 0%, #ffe47b 100%);
  box-shadow: 0 3px 0 rgba(71, 36, 21, 0.18);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .25px;
}
.chance-strip.is-empty { background: #eadfd6; opacity: .88; }
.chance-strip.is-checking { opacity: .72; }
.chance-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  padding: 1px 7px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
}
</style>`
);

replaceOnce(
  "chance HTML",
  `  <div class="status-banner" role="status" aria-live="polite">
    <span class="status-dot" aria-hidden="true"></span>
    <span id="statusText">Move the claw &amp; catch a capsule!</span>
  </div>`,
  `  <div class="status-banner" role="status" aria-live="polite">
    <span class="status-dot" aria-hidden="true"></span>
    <span id="statusText">Move the claw &amp; catch a capsule!</span>
  </div>
  <div class="chance-strip is-checking" id="chanceStrip" aria-live="polite">
    <span aria-hidden="true">🎟️</span> CHANCES
    <strong class="chance-count" id="chances">…/5</strong>
    <span id="chanceReset">per 24 jam • IP/browser</span>
  </div>`
);

// Visible odds must match the server exactly: 44.9 + 40 + 15 + 0.1 = 100.
replaceOnce(
  "zonk odds label",
  `<span class="odd-name">💩 Zonk</span>
              <b class="odd-pct">40%</b>`,
  `<span class="odd-name">💩 Zonk</span>
              <b class="odd-pct">44.9%</b>`
);
replaceOnce(
  "account odds label",
  `<span class="odd-name">👑 Account <span class="odd-mini-badge">SSR</span></span>
              <b class="odd-pct">5%</b>`,
  `<span class="odd-name">👑 Account <span class="odd-mini-badge">ULTRA</span></span>
              <b class="odd-pct">0.1%</b>`
);
replaceOnce(
  "zonk odds bar",
  `.odd-zonk .odd-fill { width: 40%; background: #9c7a65; }`,
  `.odd-zonk .odd-fill { width: 44.9%; background: #9c7a65; }`
);
replaceOnce(
  "account odds bar",
  `.odd-account .odd-fill {
  width: 20%;`,
  `.odd-account .odd-fill {
  width: 3px;`
);
replaceOnce(
  "account fallback tier",
  `r.tier || "5%"`,
  `r.tier || "0.1%"`
);
replaceOnce(
  "account empty modal tier",
  '      badges = `<span class="tier badge-account">👑 JACKPOT • 5%</span>`;',
  '      badges = `<span class="tier badge-account">👑 ULTRA JACKPOT • 0.1%</span>`;'
);

replaceOnce(
  "chance JS refs",
  `const statusText = $("#statusText");`,
  `const statusText = $("#statusText");
const chancesEl = $("#chances"), chanceStrip = $("#chanceStrip"), resetEl = $("#chanceReset");`
);

replaceOnce(
  "chance state",
  `let toys = [], busy = false, x = 0.52, wins = 0;`,
  `let toys = [], busy = false, x = 0.52, wins = 0;
let gachaRemaining = 5, gachaLimit = 5, limitReached = false, gachaReady = false;
let gachaResetAt = null;
let cachedRemaining = null;
try {
  const cached = Number(localStorage.getItem("gachaRemainingV2"));
  const cachedLimit = Number(localStorage.getItem("gachaLimitV2"));
  if (Number.isFinite(cached) && cached >= 0 && cached <= 5) cachedRemaining = cached;
  if (Number.isFinite(cachedLimit) && cachedLimit > 0) gachaLimit = cachedLimit;
} catch {}
if (cachedRemaining !== null) {
  gachaRemaining = cachedRemaining;
  limitReached = cachedRemaining <= 0;
  if (chancesEl) chancesEl.textContent = gachaRemaining + "/" + gachaLimit;
  if (chanceStrip) chanceStrip.classList.toggle("is-empty", limitReached);
}
// Prevent refresh race: DROP stays locked until server status is verified.
drop.disabled = true;`
);

replaceOnce(
  "chance helpers",
  `function setStatus(msg) {
  if (statusText) statusText.textContent = msg;
}`,
  `function setStatus(msg) {
  if (statusText) statusText.textContent = msg;
}

function renderResetCountdown() {
  if (!resetEl) return;
  if (!limitReached || !gachaResetAt) {
    resetEl.textContent = "per 24 jam • IP/browser";
    return;
  }
  const ms = Date.parse(gachaResetAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) {
    resetEl.textContent = "Memeriksa reset...";
    return;
  }
  const minutesLeft = Math.ceil(ms / 60000);
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  resetEl.textContent = "Reset dalam " + hours + "j " + minutes + "m";
}
function updateChanceUI(status = {}) {
  if (Number.isFinite(Number(status.limit))) gachaLimit = Number(status.limit);
  if (Number.isFinite(Number(status.remaining))) gachaRemaining = Math.max(0, Number(status.remaining));
  limitReached = gachaRemaining <= 0;
  if (Object.prototype.hasOwnProperty.call(status, "resetAt")) gachaResetAt = status.resetAt;
  renderResetCountdown();
  gachaReady = true;
  try {
    localStorage.setItem("gachaRemainingV2", String(gachaRemaining));
    localStorage.setItem("gachaLimitV2", String(gachaLimit));
  } catch {}
  if (chancesEl) chancesEl.textContent = gachaRemaining + "/" + gachaLimit;
  if (chanceStrip) {
    chanceStrip.classList.remove("is-checking");
    chanceStrip.classList.toggle("is-empty", limitReached);
  }
  if (drop) drop.disabled = busy || limitReached || !gachaReady;
  if (limitReached) setStatus("Limit 5 gacha dalam 24 jam habis. Kesempatan akan kembali otomatis.");
}

setInterval(() => {
  if (!limitReached || !gachaResetAt) return;
  renderResetCountdown();
  if (Date.now() >= Date.parse(gachaResetAt)) loadGachaStatus();
}, 60 * 1000);

async function loadGachaStatus() {
  if (chanceStrip) chanceStrip.classList.add("is-checking");
  drop.disabled = true;
  if (!limitReached) setStatus("Checking gacha chances...");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/gacha/status", { headers: { accept: "application/json" }, cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      updateChanceUI(await res.json());
      if (!limitReached) setStatus("Move the claw & catch a capsule!");
      return;
    } catch (_) {
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 + attempt * 300));
    }
  }

  if (cachedRemaining !== null) {
    updateChanceUI({ remaining: cachedRemaining, limit: gachaLimit });
    if (!limitReached) setStatus("Using cached chances — server status belum tersedia.");
  } else {
    gachaReady = false;
    drop.disabled = true;
    if (chanceStrip) chanceStrip.classList.add("is-checking");
    setStatus("Tidak bisa verifikasi chances. Refresh sebentar lagi.");
  }
}`
);

replaceOnce(
  "disable respects limit",
  `function disable(v) {
  busy = v;
  left.disabled = v;
  right.disabled = v;
  drop.disabled = v;
}`,
  `function disable(v) {
  busy = v;
  left.disabled = v;
  right.disabled = v;
  drop.disabled = v || limitReached || !gachaReady;
}`
);

replaceOnce(
  "drop limit guard",
  `async function dropClaw() {
  if (busy) return;`,
  `async function dropClaw() {
  if (!gachaReady) {
    notify("Sedang cek sisa kesempatan...");
    return;
  }
  if (limitReached) {
    notify("5 kesempatan gacha untuk IP/browser ini sudah habis.");
    setStatus("Limit reached — 5 kesempatan gacha untuk IP/browser ini sudah habis.");
    return;
  }
  if (busy) return;`
);

replaceOnce(
  "post drop status",
  `  setStatus("Move the claw & catch a capsule!");
  disable(false);`,
  `  if (limitReached) setStatus("Limit reached — 5 kesempatan gacha untuk IP/browser ini sudah habis.");
  else setStatus("Move the claw & catch a capsule!");
  disable(false);`
);

replaceOnce(
  "browser waifu providers",
  `async function finishCatch(t) {`,
  `const WAIFU_RECENT_KEY = "gachaWaifuRecentV4";
const WAIFU_LAST_PROVIDER_KEY = "gachaWaifuLastProviderV1";
const WAIFU_RECENT_MAX = 64;

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function recentWaifuUrls() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WAIFU_RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-WAIFU_RECENT_MAX) : [];
  } catch { return []; }
}

function rememberWaifu(url, provider) {
  if (!url) return;
  try {
    const next = recentWaifuUrls().filter(x => x !== url);
    next.push(url);
    localStorage.setItem(WAIFU_RECENT_KEY, JSON.stringify(next.slice(-WAIFU_RECENT_MAX)));
    if (provider) localStorage.setItem(WAIFU_LAST_PROVIDER_KEY, provider);
  } catch {}
}

async function fetchJsonWithTimeout(url, timeout = 4200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waifuFromNekosia() {
  const categories = [
    "random", "maid", "vtuber", "catgirl", "foxgirl", "wolfgirl",
    "long-hair", "white-hair", "blue-hair", "blonde", "black-hair",
    "black-tights", "thigh-high-socks", "headphones"
  ];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const endpoint = "https://api.nekosia.cat/api/v1/images/" + encodeURIComponent(category)
    + "?rating=suggestive"
    + "&blacklistedTags=young-girl%2Cschoolgirl"
    + "&session=id&id=" + encodeURIComponent(playerId);
  const d = await fetchJsonWithTimeout(endpoint);
  const image = d?.image?.compressed?.url || d?.image?.original?.url;
  if (!image) throw new Error("Nekosia image missing");
  return {
    image,
    title: "Anime Girl • " + category.replaceAll("-", " "),
    artist: d?.attribution?.artist?.username || "Nekosia",
    source: d?.source?.url || null,
    provider: "Nekosia",
    rating: d?.rating || "suggestive"
  };
}

async function waifuFromNekosBest() {
  const categories = ["waifu", "neko", "kitsune"];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const d = await fetchJsonWithTimeout("https://nekos.best/api/v2/" + category);
  const item = Array.isArray(d?.results) ? d.results[0] : null;
  if (!item?.url) throw new Error("NekosBest image missing");
  return {
    image: item.url,
    title: "Anime Girl • " + category,
    artist: item.artist_name || "Nekos.best",
    source: item.source_url || null,
    provider: "Nekos.best",
    rating: "safe"
  };
}

async function waifuFromWaifuPics() {
  const category = Math.random() < 0.5 ? "waifu" : "neko";
  const d = await fetchJsonWithTimeout("https://api.waifu.pics/sfw/" + category);
  if (!d?.url) throw new Error("Waifu.pics image missing");
  return {
    image: d.url,
    title: "Anime Girl • " + category,
    artist: "Waifu.pics",
    source: null,
    provider: "Waifu.pics",
    rating: "safe"
  };
}

async function waifuFromNekosApi() {
  const endpoint = "https://api.nekosapi.com/v4/images/random?limit=1&rating=safe&without_tags=young-girl%2Cschoolgirl";
  const d = await fetchJsonWithTimeout(endpoint);
  const item = Array.isArray(d) ? d[0]
    : Array.isArray(d?.data) ? d.data[0]
    : Array.isArray(d?.items) ? d.items[0]
    : d?.data || d;
  const attrs = item?.attributes || item || {};
  const image = attrs.file || attrs.url || attrs.original || attrs.image_url || attrs.imageUrl;
  if (!image) throw new Error("Nekos API image missing");
  return {
    image,
    title: "Anime Girl • Nekos API",
    artist: attrs.artist || attrs.artist_name || "Nekos API",
    source: attrs.source || attrs.source_url || null,
    provider: "Nekos API",
    rating: attrs.rating || "safe"
  };
}

async function waifuFromNekosMoe() {
  const d = await fetchJsonWithTimeout("https://nekos.moe/api/v1/random/image?nsfw=false");
  const item = Array.isArray(d?.images) ? d.images[0] : null;
  if (!item?.id || item?.nsfw === true) throw new Error("Nekos.moe image missing");
  return {
    image: "https://nekos.moe/image/" + encodeURIComponent(item.id) + ".jpg",
    title: "Anime Girl • nekos.moe",
    artist: item.artist || "nekos.moe",
    source: "https://nekos.moe/post/" + encodeURIComponent(item.id),
    provider: "Nekos.moe",
    rating: "safe"
  };
}

async function waifuFromNekosLife() {
  const categories = ["neko", "fox_girl"];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const d = await fetchJsonWithTimeout("https://nekos.life/api/v2/img/" + category);
  if (!d?.url) throw new Error("Nekos.life image missing");
  return {
    image: d.url,
    title: "Anime Girl • " + category.replaceAll("_", " "),
    artist: "Nekos.life",
    source: null,
    provider: "Nekos.life",
    rating: "safe"
  };
}

function waifuFallbackDataUri() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd7ec"/><stop offset="1" stop-color="#d8c7ff"/></linearGradient></defs><rect width="720" height="900" fill="url(#g)"/><text x="360" y="390" text-anchor="middle" font-size="150">💖</text><text x="360" y="545" text-anchor="middle" fill="#472415" font-family="Arial" font-size="42" font-weight="900">WAIFU PROVIDERS OFFLINE</text><text x="360" y="605" text-anchor="middle" fill="#6e422d" font-family="Arial" font-size="25">6 provider sudah dicoba</text></svg>';
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

async function attachRandomWaifu(data) {
  const entries = [
    { name: "Nekosia", fn: waifuFromNekosia },
    { name: "Nekos.best", fn: waifuFromNekosBest },
    { name: "Waifu.pics", fn: waifuFromWaifuPics },
    { name: "Nekos API", fn: waifuFromNekosApi },
    { name: "Nekos.moe", fn: waifuFromNekosMoe },
    { name: "Nekos.life", fn: waifuFromNekosLife }
  ];
  const recent = new Set(recentWaifuUrls());
  let lastProvider = "";
  try { lastProvider = localStorage.getItem(WAIFU_LAST_PROVIDER_KEY) || ""; } catch {}

  // Randomize providers, but push the last successful provider to the back.
  const providers = shuffled(entries).sort((a, b) => Number(a.name === lastProvider) - Number(b.name === lastProvider));

  // Up to two rounds. Duplicate URLs are rejected when the provider exposes a stable URL.
  for (let round = 0; round < 2; round++) {
    for (const provider of providers) {
      try {
        const result = await provider.fn();
        if (!result?.image || recent.has(result.image)) continue;
        Object.assign(data, result);
        rememberWaifu(result.image, result.provider || provider.name);
        return data;
      } catch (_) {
        // Browser handles provider failure/CORS/rate-limit by trying the next one.
      }
    }
  }

  data.image = waifuFallbackDataUri();
  data.title = "Anime Girl — provider offline";
  data.artist = "Browser fallback";
  data.provider = "fallback";
  return data;
}

async function finishCatch(t) {`
);

replaceOnce(
  "wins count only after accepted roll",
  `  wins++;
  winsEl.textContent = wins;
  showLoading();`,
  `  showLoading();`
);

replaceOnce(
  "roll response limit and client providers",
  `    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Roll gagal");
    if (data.type === "random") await attachRandomMeme(data);
    showReward(data);
    addHistory(data);`,
  `    const data = await res.json();
    if (!res.ok) {
      if (res.status === 429 && data.error === "GACHA_LIMIT_REACHED") {
        updateChanceUI(data);
        showReward({
          type: "limit", tier: "0 LEFT", title: "LIMIT REACHED",
          message: "Kamu sudah memakai 5 kesempatan gacha dalam 24 jam. Cek hitung mundur reset."
        });
        return;
      }
      throw new Error(data.error || data.message || "Roll gagal");
    }
    updateChanceUI(data);
    if (data.type === "random") await attachRandomMeme(data);
    if (data.type === "waifu") await attachRandomWaifu(data);
    wins++;
    winsEl.textContent = wins;
    showReward(data);
    addHistory(data);`
);

replaceOnce(
  "initial status load",
  `setX(x);
setTimeout(initToys, 80);`,
  `setX(x);
setTimeout(initToys, 80);
loadGachaStatus();`
);

await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log("Built public/game.html with 0.1% jackpot + 6 browser-side anime providers.");
