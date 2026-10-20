import { ADMIN_EMAIL, createSessionToken, verifyPassword } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Body invalid" }, { status: 400 }); }
  const adminEmail = ADMIN_EMAIL;
  if (String(body.email || "").trim().toLowerCase() !== adminEmail.trim().toLowerCase() || !verifyPassword(body.password)) {
    return Response.json({ error: "Email atau password salah" }, { status: 401 });
  }
  const token = createSessionToken();
  return Response.json({ ok: true, email: adminEmail }, {
    headers: { "Set-Cookie": `admin_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400` }
  });
};

export const config = { path: "/api/admin/login" };
