export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": "admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" }
  });
};
export const config = { path: "/api/admin/logout" };
