import { requireAdmin } from "../lib/auth.mjs";
export default async (req) => {
  if (!requireAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ok: true, email: Netlify.env.get("ADMIN_EMAIL") || "admin" });
};
export const config = { path: "/api/admin/me" };
