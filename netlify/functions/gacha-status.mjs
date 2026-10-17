import { getAttemptStatus } from "../lib/attempts.mjs";

export default async (req, context) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const status = await getAttemptStatus(context.ip);
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
};

export const config = { path: "/api/gacha/status" };
