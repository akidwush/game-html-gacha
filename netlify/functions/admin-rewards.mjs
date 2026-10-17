import crypto from "node:crypto";
import { requireAdmin } from "../lib/auth.mjs";
import { listRewards, saveRewards } from "../lib/store.mjs";

export default async (req) => {
  if (!requireAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const items = await listRewards();

  if (req.method === "GET") {
    return Response.json({ items, stats: {
      total: items.length,
      available: items.filter(x => !x.claimed && x.enabled !== false).length,
      claimed: items.filter(x => x.claimed).length,
      disabled: items.filter(x => x.enabled === false).length
    }});
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (!body.title || !body.username || !body.password) return Response.json({ error: "Judul, username, dan password wajib." }, { status: 400 });
    const item = {
      id: crypto.randomUUID(), title: String(body.title).trim(), username: String(body.username).trim(),
      password: String(body.password), note: String(body.note || "").trim(), enabled: true,
      claimed: false, claimedAt: null, claimedBy: null, createdAt: new Date().toISOString()
    };
    await saveRewards([item, ...items]);
    return Response.json({ ok: true, item }, { status: 201 });
  }

  if (req.method === "PUT") {
    if (!id) return Response.json({ error: "id wajib" }, { status: 400 });
    const body = await req.json();
    let found = false;
    const next = items.map(item => {
      if (item.id !== id) return item;
      found = true;
      const updated = { ...item };
      for (const key of ["title", "username", "password", "note", "enabled"]) if (body[key] !== undefined) updated[key] = body[key];
      if (body.resetClaim === true) Object.assign(updated, { claimed: false, claimedAt: null, claimedBy: null });
      return updated;
    });
    if (!found) return Response.json({ error: "Reward tidak ditemukan" }, { status: 404 });
    await saveRewards(next);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!id) return Response.json({ error: "id wajib" }, { status: 400 });
    await saveRewards(items.filter(x => x.id !== id));
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
export const config = { path: "/api/admin/rewards" };
