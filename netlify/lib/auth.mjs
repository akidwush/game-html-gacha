import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (str) => Buffer.from(str, "base64url");

export function verifyPassword(password) {
  const saltRaw = Netlify.env.get("ADMIN_PASSWORD_SALT");
  const expectedRaw = Netlify.env.get("ADMIN_PASSWORD_HASH");
  if (!saltRaw || !expectedRaw) return false;
  const salt = fromB64u(saltRaw);
  const actual = crypto.scryptSync(String(password || ""), salt, 32, { N: 16384, r: 8, p: 1 });
  const expected = fromB64u(expectedRaw);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  const secret = Netlify.env.get("ADMIN_SESSION_SECRET");
  if (!secret) throw new Error("ADMIN_SESSION_SECRET belum dikonfigurasi");
  const payload = b64u(JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000, nonce: crypto.randomUUID() }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  try {
    if (!token) return false;
    const secret = Netlify.env.get("ADMIN_SESSION_SECRET");
    if (!secret) return false;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest();
    const actual = fromB64u(sig);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;
    const parsed = JSON.parse(fromB64u(payload).toString("utf8"));
    return Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

export function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  const match = raw.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function requireAdmin(req) {
  return verifySessionToken(readCookie(req, "admin_session"));
}
