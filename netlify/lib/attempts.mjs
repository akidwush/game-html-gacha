import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE = "gacha-attempts";
export const GACHA_LIMIT = 5;

function attemptStore() {
  return getStore({ name: STORE, consistency: "strong" });
}

function ipKey(ip) {
  const secret = Netlify.env.get("IP_HASH_SECRET") || Netlify.env.get("ADMIN_SESSION_SECRET") || "gacha-claw-ip";
  return crypto.createHmac("sha256", secret).update(String(ip || "unknown")).digest("hex");
}

function prefixFor(ip) {
  return `v1/${ipKey(ip)}/`;
}

export async function getAttemptStatus(ip) {
  const store = attemptStore();
  const result = await store.list({ prefix: prefixFor(ip) });
  const used = Math.min(result.blobs.length, GACHA_LIMIT);
  return {
    used,
    remaining: Math.max(0, GACHA_LIMIT - used),
    limit: GACHA_LIMIT,
  };
}

export async function registerAttempt(ip) {
  // Casual per-IP limit: append one immutable attempt record per successful catch.
  // Intentionally simple; not VPN/fingerprint/anti-abuse protection.
  const current = await getAttemptStatus(ip);
  if (current.remaining <= 0) return current;

  const store = attemptStore();
  const key = `${prefixFor(ip)}${Date.now()}-${crypto.randomUUID()}`;
  await store.setJSON(key, { createdAt: new Date().toISOString() }, { onlyIfNew: true });
  return getAttemptStatus(ip);
}
