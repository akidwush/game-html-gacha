import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE = "gacha-attempts";
const DEVICE_COOKIE = "gacha_device";
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;
export const GACHA_LIMIT = 5;

function attemptStore() {
  return getStore({ name: STORE, consistency: "strong" });
}

function secret() {
  return Netlify.env.get("IP_HASH_SECRET") || Netlify.env.get("ADMIN_SESSION_SECRET") || "gacha-claw-ip";
}

function digest(scope, value) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${scope}:${String(value || "unknown")}`)
    .digest("hex");
}

function prefixFor(scope, value) {
  return `v2/${scope}/${digest(scope, value)}/`;
}

function signDeviceId(id) {
  return crypto.createHmac("sha256", secret()).update(`device-cookie:${id}`).digest("base64url");
}

function validDeviceCookie(value) {
  if (!value) return null;
  const [id, signature] = String(value).split(".");
  if (!id || !signature || !/^[a-f0-9-]{20,80}$/i.test(id)) return null;
  const expected = signDeviceId(id);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return part.slice(index + 1).trim(); }
    }
  }
  return null;
}

export function getOrCreateDeviceId(req) {
  return validDeviceCookie(readCookie(req, DEVICE_COOKIE)) || crypto.randomUUID();
}

export function deviceCookieHeader(deviceId) {
  const value = `${deviceId}.${signDeviceId(deviceId)}`;
  return `${DEVICE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${DEVICE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

async function countUsed(scope, value) {
  if (!value) return 0;
  const result = await attemptStore().list({ prefix: prefixFor(scope, value) });
  return Math.min(result.blobs.length, GACHA_LIMIT);
}

export async function getAttemptStatus(ip, deviceId) {
  const [ipUsed, deviceUsed] = await Promise.all([
    countUsed("ip", ip),
    countUsed("device", deviceId),
  ]);
  // Casual guard: whichever identity has used more chances wins. This prevents
  // a simple refresh / rotating mobile IP from visually resetting the limit.
  const used = Math.min(Math.max(ipUsed, deviceUsed), GACHA_LIMIT);
  return {
    used,
    remaining: Math.max(0, GACHA_LIMIT - used),
    limit: GACHA_LIMIT,
  };
}

export async function registerAttempt(ip, deviceId) {
  const current = await getAttemptStatus(ip, deviceId);
  if (current.remaining <= 0) return current;

  const attemptId = `${Date.now()}-${crypto.randomUUID()}`;
  const payload = { createdAt: new Date().toISOString() };
  const writes = [];
  if (ip) writes.push(attemptStore().setJSON(`${prefixFor("ip", ip)}${attemptId}`, payload, { onlyIfNew: true }));
  if (deviceId) writes.push(attemptStore().setJSON(`${prefixFor("device", deviceId)}${attemptId}`, payload, { onlyIfNew: true }));
  await Promise.all(writes);
  return getAttemptStatus(ip, deviceId);
}
