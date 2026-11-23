import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import {
  ADMIN_COOKIE,
  ADMIN_TTL,
  adminPassword,
  clientIp,
  isHttps,
  makeAdminToken,
  readJson,
  safeEqual,
} from "@/lib/security";

export async function POST(request: Request) {
  const expected = adminPassword();
  if (!expected) return Response.json({ error: "disabled" }, { status: 503 });

  const body = await readJson(request);
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!rateLimit(`admin-ip:${clientIp(request)}`, 10, 15 * 60_000)) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  if (!safeEqual(String(body.password ?? ""), expected)) {
    return Response.json({ error: "wrong_password" }, { status: 401 });
  }

  (await cookies()).set(ADMIN_COOKIE, makeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: "/",
    maxAge: ADMIN_TTL,
  });
  return Response.json({ ok: true });
}
