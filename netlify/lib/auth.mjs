import crypto from "node:crypto";

// WARNING: Simple/demo admin credentials. They're also embedded in public/admin.html.
// Anyone can read these from the browser; DO NOT store valuable account rewards here.
export const ADMIN_EMAIL = "admin@gacha.local";
export const ADMIN_PASSWORD = "GachaClaw2026!";
const SESSION_KEY = crypto.createHash("sha256").update(`gacha-session:${ADMIN_PASSWORD}`).digest();
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (str) => Buffer.from(str, "base64url");

export function verifyPassword(password) {
  const a = Buffer.from(String(password || ""), "utf8");
  const b = Buffer.from(ADMIN_PASSWORD, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSessionToken() {
  const payload = b64u(JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000, nonce: crypto.randomUUID() }));
  const sig = crypto.createHmac("sha256", SESSION_KEY).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  try {
    if (!token) return false;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expected = crypto.createHmac("sha256", SESSION_KEY).update(payload).digest();
    const actual = fromB64u(sig);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;
    return Number(JSON.parse(fromB64u(payload).toString("utf8")).exp) > Date.now();
  } catch { return false; }
}

export function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  const match = raw.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function requireAdmin(req) {
  return verifySessionToken(readCookie(req, "admin_session"));
}
