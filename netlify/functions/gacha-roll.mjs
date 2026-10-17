import crypto from "node:crypto";
import { claimOneReward } from "../lib/store.mjs";
import { getAttemptStatus, registerAttempt } from "../lib/attempts.mjs";

const zonks = [
  { name: "TAHI EMAS PALSU", emoji: "💩", message: "Legendary... bohong." },
  { name: "KANTONG SAMPAH", emoji: "🗑️", message: "Minimal kantongnya masih bisa dipakai." },
  { name: "BATU NPC", emoji: "🪨", message: "Batu. Ya, cuma batu." },
  { name: "KARDUS KOSONG", emoji: "📦", message: "Isinya angin premium." },
  { name: "SENDAL SEBELAH", emoji: "🩴", message: "Pasangannya hilang ke banner lain." }
];
const waifuCategories = ["vtuber", "catgirl", "foxgirl", "maid"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function getWaifu() {
  const category = pick(waifuCategories);
  const endpoint = `https://api.nekosia.cat/api/v1/images/${category}?rating=suggestive&blacklistedTags=young-girl,schoolgirl`;
  try {
    const r = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`Nekosia ${r.status}`);
    const d = await r.json();
    return {
      type: "waifu", tier: "15%", title: "Anime Girl", category,
      image: d?.image?.compressed?.url || d?.image?.original?.url,
      artist: d?.attribution?.artist?.username || "Unknown",
      source: d?.source?.url || null,
      rating: d?.rating || "suggestive"
    };
  } catch {
    return { type: "waifu", tier: "15%", title: "Anime Girl", category: "fallback", image: "https://picsum.photos/seed/anime-fallback/720/900", artist: "Fallback" };
  }
}

async function rollReward(playerId) {
  const roll = Math.random() * 100;

  if (roll < 40) return { type: "zonk", tier: "40%", ...pick(zonks) };
  if (roll < 80) {
    const seed = crypto.randomUUID();
    return { type: "random", tier: "40%", title: "Random Image", image: `https://picsum.photos/seed/${seed}/720/900` };
  }
  if (roll < 95) return getWaifu();

  try {
    const account = await claimOneReward(playerId);
    if (!account) return { type: "account-empty", tier: "5%", title: "Jackpot Slot", message: "Kena 5%, tapi stok akun admin sedang kosong. Hubungi admin." };
    return {
      type: "account", tier: "5%", title: account.title, username: account.username,
      password: account.password, note: account.note || "", claimId: account.id
    };
  } catch {
    return { type: "account-empty", tier: "5%", title: "Jackpot Slot", message: "Kena 5%, tapi reward sedang sibuk. Coba lagi nanti." };
  }
}

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const current = await getAttemptStatus(context.ip);
  if (current.remaining <= 0) {
    return Response.json({
      error: "GACHA_LIMIT_REACHED",
      message: "IP ini sudah memakai 5 kesempatan gacha.",
      ...current,
    }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const playerId = String(body.playerId || `guest-${crypto.randomUUID()}`).slice(0, 128);

  const reward = await rollReward(playerId);
  const status = await registerAttempt(context.ip);
  return Response.json({ ...reward, ...status }, { headers: { "Cache-Control": "no-store" } });
};

export const config = { path: "/api/gacha/roll" };
