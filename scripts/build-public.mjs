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
  `\n/* Casual per-IP gacha chance indicator (server remains source of truth) */\n.chance-strip {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 7px;\n  width: fit-content;\n  max-width: 100%;\n  margin: -2px auto 0;\n  padding: 5px 12px;\n  border: 2.5px solid var(--ink);\n  border-radius: 999px;\n  background: linear-gradient(180deg, #fff9db 0%, #ffe47b 100%);\n  box-shadow: 0 3px 0 rgba(71, 36, 21, 0.18);\n  font-size: 11px;\n  font-weight: 900;\n  letter-spacing: .25px;\n}\n.chance-strip.is-empty {\n  background: #eadfd6;\n  opacity: .88;\n}\n.chance-strip.is-checking {\n  opacity: .72;\n}\n.chance-count {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 42px;\n  padding: 1px 7px;\n  border: 2px solid var(--ink);\n  border-radius: 999px;\n  background: #fff;\n  font-size: 12px;\n}\n</style>`
);

replaceOnce(
  "chance HTML",
  `  <div class="status-banner" role="status" aria-live="polite">\n    <span class="status-dot" aria-hidden="true"></span>\n    <span id="statusText">Move the claw &amp; catch a capsule!</span>\n  </div>`,
  `  <div class="status-banner" role="status" aria-live="polite">\n    <span class="status-dot" aria-hidden="true"></span>\n    <span id="statusText">Move the claw &amp; catch a capsule!</span>\n  </div>\n  <div class="chance-strip is-checking" id="chanceStrip" aria-live="polite">\n    <span aria-hidden="true">🎟️</span> CHANCES\n    <strong class="chance-count" id="chances">…/5</strong>\n    <span>per IP</span>\n  </div>`
);

replaceOnce(
  "chance JS refs",
  `const statusText = $("#statusText");`,
  `const statusText = $("#statusText");\nconst chancesEl = $("#chances"), chanceStrip = $("#chanceStrip");`
);

replaceOnce(
  "chance state",
  `let toys = [], busy = false, x = 0.52, wins = 0;`,
  `let toys = [], busy = false, x = 0.52, wins = 0;\nlet gachaRemaining = 5, gachaLimit = 5, limitReached = false, gachaReady = false;\nlet cachedRemaining = null;\ntry {\n  const cached = Number(localStorage.getItem("gachaRemainingV2"));\n  const cachedLimit = Number(localStorage.getItem("gachaLimitV2"));\n  if (Number.isFinite(cached) && cached >= 0 && cached <= 5) cachedRemaining = cached;\n  if (Number.isFinite(cachedLimit) && cachedLimit > 0) gachaLimit = cachedLimit;\n} catch {}\nif (cachedRemaining !== null) {\n  gachaRemaining = cachedRemaining;\n  limitReached = cachedRemaining <= 0;\n  if (chancesEl) chancesEl.textContent = gachaRemaining + "/" + gachaLimit;\n  if (chanceStrip) chanceStrip.classList.toggle("is-empty", limitReached);\n}\n// Prevent the refresh race: DROP is locked until server status has been checked.\ndrop.disabled = true;`
);

replaceOnce(
  "chance helpers",
  `function setStatus(msg) {\n  if (statusText) statusText.textContent = msg;\n}`,
  `function setStatus(msg) {\n  if (statusText) statusText.textContent = msg;\n}\n\nfunction updateChanceUI(status = {}) {\n  if (Number.isFinite(Number(status.limit))) gachaLimit = Number(status.limit);\n  if (Number.isFinite(Number(status.remaining))) gachaRemaining = Math.max(0, Number(status.remaining));\n  limitReached = gachaRemaining <= 0;\n  gachaReady = true;\n  try {\n    localStorage.setItem("gachaRemainingV2", String(gachaRemaining));\n    localStorage.setItem("gachaLimitV2", String(gachaLimit));\n  } catch {}\n  if (chancesEl) chancesEl.textContent = gachaRemaining + "/" + gachaLimit;\n  if (chanceStrip) {\n    chanceStrip.classList.remove("is-checking");\n    chanceStrip.classList.toggle("is-empty", limitReached);\n  }\n  if (drop) drop.disabled = busy || limitReached || !gachaReady;\n  if (limitReached) setStatus("Limit reached — 5 kesempatan gacha untuk IP/browser ini sudah habis.");\n}\n\nasync function loadGachaStatus() {\n  if (chanceStrip) chanceStrip.classList.add("is-checking");\n  drop.disabled = true;\n  if (!limitReached) setStatus("Checking gacha chances...");\n\n  for (let attempt = 0; attempt < 3; attempt++) {\n    try {\n      const res = await fetch("/api/gacha/status", { headers: { accept: "application/json" }, cache: "no-store" });\n      if (!res.ok) throw new Error("status " + res.status);\n      updateChanceUI(await res.json());\n      if (!limitReached) setStatus("Move the claw & catch a capsule!");\n      return;\n    } catch (_) {\n      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 + attempt * 300));\n    }\n  }\n\n  // If status is temporarily unavailable, a cached zero remains blocked after refresh.\n  if (cachedRemaining !== null) {\n    updateChanceUI({ remaining: cachedRemaining, limit: gachaLimit });\n    if (!limitReached) setStatus("Using cached chances — server status belum tersedia.");\n  } else {\n    gachaReady = false;\n    drop.disabled = true;\n    if (chanceStrip) chanceStrip.classList.add("is-checking");\n    setStatus("Tidak bisa verifikasi chances. Refresh sebentar lagi.");\n  }\n}`
);

replaceOnce(
  "disable respects limit",
  `function disable(v) {\n  busy = v;\n  left.disabled = v;\n  right.disabled = v;\n  drop.disabled = v;\n}`,
  `function disable(v) {\n  busy = v;\n  left.disabled = v;\n  right.disabled = v;\n  drop.disabled = v || limitReached || !gachaReady;\n}`
);

replaceOnce(
  "drop limit guard",
  `async function dropClaw() {\n  if (busy) return;`,
  `async function dropClaw() {\n  if (!gachaReady) {\n    notify("Sedang cek sisa kesempatan...");\n    return;\n  }\n  if (limitReached) {\n    notify("5 kesempatan gacha untuk IP/browser ini sudah habis.");\n    setStatus("Limit reached — 5 kesempatan gacha untuk IP/browser ini sudah habis.");\n    return;\n  }\n  if (busy) return;`
);

replaceOnce(
  "post drop status",
  `  setStatus("Move the claw & catch a capsule!");\n  disable(false);`,
  `  if (limitReached) setStatus("Limit reached — 5 kesempatan gacha untuk IP/browser ini sudah habis.");\n  else setStatus("Move the claw & catch a capsule!");\n  disable(false);`
);

replaceOnce(
  "browser waifu providers",
  `async function finishCatch(t) {`,
  `const WAIFU_RECENT_KEY = "gachaWaifuRecentV3";\nconst WAIFU_RECENT_MAX = 36;\n\nfunction shuffled(list) {\n  return [...list].sort(() => Math.random() - 0.5);\n}\n\nfunction recentWaifuUrls() {\n  try {\n    const parsed = JSON.parse(localStorage.getItem(WAIFU_RECENT_KEY) || "[]");\n    return Array.isArray(parsed) ? parsed.slice(-WAIFU_RECENT_MAX) : [];\n  } catch { return []; }\n}\n\nfunction rememberWaifu(url) {\n  if (!url) return;\n  try {\n    const next = recentWaifuUrls().filter(x => x !== url);\n    next.push(url);\n    localStorage.setItem(WAIFU_RECENT_KEY, JSON.stringify(next.slice(-WAIFU_RECENT_MAX)));\n  } catch {}\n}\n\nasync function fetchJsonWithTimeout(url, timeout = 3800) {\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), timeout);\n  try {\n    const res = await fetch(url, {\n      headers: { accept: "application/json" },\n      signal: controller.signal,\n      cache: "no-store"\n    });\n    if (!res.ok) throw new Error("HTTP " + res.status);\n    return await res.json();\n  } finally {\n    clearTimeout(timer);\n  }\n}\n\nasync function waifuFromNekosia() {\n  const categories = [\n    "random", "girl", "maid", "vtuber", "catgirl", "foxgirl", "wolfgirl",\n    "long-hair", "white-hair", "blue-hair", "blonde", "black-tights",\n    "thigh-high-socks", "headphones"\n  ];\n  const category = categories[Math.floor(Math.random() * categories.length)];\n  const endpoint = "https://api.nekosia.cat/api/v1/images/" + encodeURIComponent(category)\n    + "?rating=suggestive"\n    + "&blacklistedTags=young-girl%2Cschoolgirl"\n    + "&session=id&id=" + encodeURIComponent(playerId);\n  const d = await fetchJsonWithTimeout(endpoint);\n  const image = d?.image?.compressed?.url || d?.image?.original?.url;\n  if (!image) throw new Error("Nekosia image missing");\n  return {\n    image,\n    title: "Anime Girl • " + category.replaceAll("-", " "),\n    artist: d?.attribution?.artist?.username || "Nekosia",\n    source: d?.source?.url || null,\n    provider: "Nekosia",\n    rating: d?.rating || "suggestive"\n  };\n}\n\nasync function waifuFromNekosBest() {\n  const categories = ["waifu", "neko", "kitsune"];\n  const category = categories[Math.floor(Math.random() * categories.length)];\n  const d = await fetchJsonWithTimeout("https://nekos.best/api/v2/" + category);\n  const item = Array.isArray(d?.results) ? d.results[0] : null;\n  if (!item?.url) throw new Error("NekosBest image missing");\n  return {\n    image: item.url,\n    title: "Anime Girl • " + category,\n    artist: item.artist_name || "Nekos.best",\n    source: item.source_url || null,\n    provider: "Nekos.best",\n    rating: "safe"\n  };\n}\n\nasync function waifuFromWaifuPics() {\n  const category = Math.random() < 0.5 ? "waifu" : "neko";\n  const d = await fetchJsonWithTimeout("https://api.waifu.pics/sfw/" + category);\n  if (!d?.url) throw new Error("Waifu.pics image missing");\n  return {\n    image: d.url,\n    title: "Anime Girl • " + category,\n    artist: "Waifu.pics",\n    source: null,\n    provider: "Waifu.pics",\n    rating: "safe"\n  };\n}\n\nfunction waifuFallbackDataUri() {\n  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd7ec"/><stop offset="1" stop-color="#d8c7ff"/></linearGradient></defs><rect width="720" height="900" fill="url(#g)"/><text x="360" y="390" text-anchor="middle" font-size="150">💖</text><text x="360" y="545" text-anchor="middle" fill="#472415" font-family="Arial" font-size="42" font-weight="900">WAIFU API OFFLINE</text><text x="360" y="605" text-anchor="middle" fill="#6e422d" font-family="Arial" font-size="26">3 provider gagal dimuat</text></svg>';\n  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);\n}\n\nasync function attachRandomWaifu(data) {\n  const providers = [waifuFromNekosia, waifuFromNekosBest, waifuFromWaifuPics];\n  const recent = new Set(recentWaifuUrls());\n\n  // Two shuffled rounds = provider benar-benar berganti-ganti, with duplicate retry.\n  for (let round = 0; round < 2; round++) {\n    for (const provider of shuffled(providers)) {\n      try {\n        const result = await provider();\n        if (!result?.image || recent.has(result.image)) continue;\n        Object.assign(data, result);\n        rememberWaifu(result.image);\n        return data;\n      } catch (_) {\n        // Browser handles provider failover; try another provider.\n      }\n    }\n  }\n\n  data.image = waifuFallbackDataUri();\n  data.title = "Anime Girl — provider offline";\n  data.artist = "Browser fallback";\n  data.provider = "fallback";\n  return data;\n}\n\nasync function finishCatch(t) {`
);

replaceOnce(
  "wins count only after accepted roll",
  `  wins++;\n  winsEl.textContent = wins;\n  showLoading();`,
  `  showLoading();`
);

replaceOnce(
  "roll response limit and client providers",
  `    const data = await res.json();\n    if (!res.ok) throw new Error(data.error || "Roll gagal");\n    if (data.type === "random") await attachRandomMeme(data);\n    showReward(data);\n    addHistory(data);`,
  `    const data = await res.json();\n    if (!res.ok) {\n      if (res.status === 429 && data.error === "GACHA_LIMIT_REACHED") {\n        updateChanceUI(data);\n        showReward({\n          type: "limit", tier: "0 LEFT", title: "LIMIT REACHED",\n          message: "Kamu sudah memakai 5 kesempatan gacha untuk IP/browser ini."\n        });\n        return;\n      }\n      throw new Error(data.error || data.message || "Roll gagal");\n    }\n    updateChanceUI(data);\n    if (data.type === "random") await attachRandomMeme(data);\n    if (data.type === "waifu") await attachRandomWaifu(data);\n    wins++;\n    winsEl.textContent = wins;\n    showReward(data);\n    addHistory(data);`
);

replaceOnce(
  "initial status load",
  `setX(x);\nsetTimeout(initToys, 80);`,
  `setX(x);\nsetTimeout(initToys, 80);\nloadGachaStatus();`
);

await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log("Built public/game.html with refresh-safe limit + browser-side multi-provider waifu pool.");
