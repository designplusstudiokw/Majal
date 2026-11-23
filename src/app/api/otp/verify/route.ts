import { cookies } from "next/headers";
import { normalizeKuwaitPhone } from "@/lib/domain";
import { verifyCode } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_TTL,
  clientIp,
  isHttps,
  makeSession,
  readJson,
} from "@/lib/security";

// POST /api/otp/verify  { phone, code }  ->  sets the session cookie
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });

  const phone = normalizeKuwaitPhone(String(body.phone ?? ""));
  const code = String(body.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "invalid" }, { status: 422 });
  }
  if (!rateLimit(`verify-ip:${clientIp(request)}`, 60, 60 * 60_000)) {
    return Response.json({ error: "limit" }, { status: 429 });
  }

  const result = await verifyCode(phone, code);
  if (!result.ok) return Response.json({ error: result.error }, { status: 401 });

  (await cookies()).set(SESSION_COOKIE, makeSession(result.phoneHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: "/",
    maxAge: SESSION_TTL,
  });
  return Response.json({ ok: true });
}
