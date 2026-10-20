import { ADMIN_EMAIL, requireAdmin } from "../lib/auth.mjs";
export default async (req) => {
  if (!requireAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ok: true, email: ADMIN_EMAIL });
};
export const config = { path: "/api/admin/me" };
