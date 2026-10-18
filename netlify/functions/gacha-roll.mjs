import crypto from "node:crypto";
import { claimOneReward } from "../lib/store.mjs";
import {
  deviceCookieHeader,
  getAttemptStatus,
  getOrCreateDeviceId,
  registerAttempt,
} from "../lib/attempts.mjs";

const zonks = [
  { name: "TAHI EMAS PALSU", emoji: "💩", message: "Legendary... bohong." },
  { name: "KANTONG SAMPAH", emoji: "🗑️", message: "Minimal kantongnya masih bisa dipakai." },
  { name: "BATU NPC", emoji: "🪨", message: "Batu. Ya, cuma batu." },
  { name: "KARDUS KOSONG", emoji: "📦", message: "Isinya angin premium." },
  { name: "SENDAL SEBELAH", emoji: "🩴", message: "Pasangannya hilang ke banner lain." }
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function rollReward(playerId) {
  const roll = Math.random() * 100;

  if (roll < 40) return { type: "zonk", tier: "40%", ...pick(zonks) };
  if (roll < 80) {
    const seed = crypto.randomUUID();
    return { type: "random", tier: "40%", title: "Random Image", image: `https://picsum.photos/seed/${seed}/720/900` };
  }
  // The 15% tier is decided here, but the actual image provider request is
  // intentionally delegated to the browser. This keeps provider traffic and
  // failover off the Netlify Function and allows a much wider client-side pool.
  if (roll < 95) return { type: "waifu", tier: "15%", title: "Anime Girl", clientFetch: true };

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

  const deviceId = getOrCreateDeviceId(req);
  const cookie = deviceCookieHeader(deviceId);
  const current = await getAttemptStatus(context.ip, deviceId);
  if (current.remaining <= 0) {
    return Response.json({
      error: "GACHA_LIMIT_REACHED",
      message: "Browser/IP ini sudah memakai 5 kesempatan gacha.",
      ...current,
    }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Set-Cookie": cookie },
    });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const playerId = String(body.playerId || `guest-${crypto.randomUUID()}`).slice(0, 128);

  const reward = await rollReward(playerId);
  const status = await registerAttempt(context.ip, deviceId);
  return Response.json({ ...reward, ...status }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": cookie },
  });
};

export const config = { path: "/api/gacha/roll" };
