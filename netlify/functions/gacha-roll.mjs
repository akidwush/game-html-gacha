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
  // 0..9999 gives us an exact 0.1% jackpot bucket (10 numbers out of 10,000).
  const roll = crypto.randomInt(0, 10000);

  // 44.9% zonk, 40% meme, 15% waifu, 0.1% account jackpot.
  if (roll < 4490) return { type: "zonk", tier: "44.9%", ...pick(zonks) };
  if (roll < 8490) {
    const seed = crypto.randomUUID();
    return { type: "random", tier: "40%", title: "Random Image", image: `https://picsum.photos/seed/${seed}/720/900` };
  }
  // Actual anime image fetching stays in the browser. The function only chooses the tier.
  if (roll < 9990) return { type: "waifu", tier: "15%", title: "Anime Girl", clientFetch: true };

  try {
    const account = await claimOneReward(playerId);
    if (!account) return {
      type: "account-empty",
      tier: "0.1%",
      title: "Ultra Jackpot Slot",
      message: "Kena 0,1%, tapi stok akun admin sedang kosong. Hubungi admin."
    };
    return {
      type: "account",
      tier: "0.1%",
      title: account.title,
      username: account.username,
      password: account.password,
      note: account.note || "",
      claimId: account.id
    };
  } catch {
    return {
      type: "account-empty",
      tier: "0.1%",
      title: "Ultra Jackpot Slot",
      message: "Kena 0,1%, tapi reward sedang sibuk. Coba lagi nanti."
    };
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
      message: "Browser/IP ini sudah memakai 5 kesempatan gacha dalam 24 jam.",
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
