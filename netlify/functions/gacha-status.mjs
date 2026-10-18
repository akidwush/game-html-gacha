import {
  deviceCookieHeader,
  getAttemptStatus,
  getOrCreateDeviceId,
} from "../lib/attempts.mjs";

export default async (req, context) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const deviceId = getOrCreateDeviceId(req);
  const status = await getAttemptStatus(context.ip, deviceId);
  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": deviceCookieHeader(deviceId),
    },
  });
};

export const config = { path: "/api/gacha/status" };
