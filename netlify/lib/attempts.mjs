import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE = "gacha-attempts";
const DEVICE_COOKIE = "gacha_device";
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;
export const GACHA_LIMIT = 5;
export const GACHA_WINDOW_MS = 24 * 60 * 60 * 1000;

function attemptStore() {
  return getStore({ name: STORE, consistency: "strong" });
}

function secret() {
  return Netlify.env.get("IP_HASH_SECRET") || "gacha-claw-ip";
}

function digest(scope, value) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${scope}:${String(value || "unknown")}`)
    .digest("hex");
}

function prefixFor(scope, value) {
  return `v3/${scope}/${digest(scope, value)}/`;
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

// Each successful roll gets an immutable event. Read only UTC today and yesterday,
// then discard events older than 24 hours. Old v2 events are intentionally ignored:
// previous permanent limits no longer apply after deployment.
function datePrefix(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function recentAttempts(scope, value, now) {
  if (!value) return [];
  const base = prefixFor(scope, value);
  const days = [...new Set([datePrefix(now), datePrefix(now - GACHA_WINDOW_MS)])];
  const results = await Promise.all(days.map(day => attemptStore().list({ prefix: `${base}${day}/` })));
  return results.flatMap(result => result.blobs.map(blob => {
    const filename = String(blob.key).split("/").pop();
    return Number(filename.split("-")[0]);
  })).filter(ts => Number.isFinite(ts) && ts > now - GACHA_WINDOW_MS && ts <= now);
}

export async function getAttemptStatus(ip, deviceId) {
  const now = Date.now();
  const [ipEvents, deviceEvents] = await Promise.all([
    recentAttempts("ip", ip, now),
    recentAttempts("device", deviceId, now),
  ]);
  const ipUsed = Math.min(ipEvents.length, GACHA_LIMIT);
  const deviceUsed = Math.min(deviceEvents.length, GACHA_LIMIT);
  const used = Math.min(Math.max(ipUsed, deviceUsed), GACHA_LIMIT);

  // If both IP and device are exhausted, both must free a slot before play resumes.
  const resets = [];
  if (ipUsed >= GACHA_LIMIT) resets.push(Math.min(...ipEvents) + GACHA_WINDOW_MS);
  if (deviceUsed >= GACHA_LIMIT) resets.push(Math.min(...deviceEvents) + GACHA_WINDOW_MS);
  const resetAt = resets.length ? new Date(Math.max(...resets)).toISOString() : null;

  return {
    used,
    remaining: Math.max(0, GACHA_LIMIT - used),
    limit: GACHA_LIMIT,
    windowHours: 24,
    resetAt,
  };
}

export async function registerAttempt(ip, deviceId) {
  const current = await getAttemptStatus(ip, deviceId);
  if (current.remaining <= 0) return current;

  const now = Date.now();
  const attemptId = `${now}-${crypto.randomUUID()}`;
  const payload = { createdAt: new Date(now).toISOString() };
  const writes = [];
  if (ip) writes.push(attemptStore().setJSON(`${prefixFor("ip", ip)}${datePrefix(now)}/${attemptId}`, payload, { onlyIfNew: true }));
  if (deviceId) writes.push(attemptStore().setJSON(`${prefixFor("device", deviceId)}${datePrefix(now)}/${attemptId}`, payload, { onlyIfNew: true }));
  await Promise.all(writes);
  return getAttemptStatus(ip, deviceId);
}
