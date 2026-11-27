import { normalizeKuwaitPhone } from "@/lib/domain";
import { requestCode } from "@/lib/otp";
import { allow } from "@/lib/rate-limit";
import { readJson } from "@/lib/security";

// POST /api/otp/request  { phone }
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });

  const phone = normalizeKuwaitPhone(String(body.phone ?? ""));
  if (!phone) return Response.json({ error: "phone" }, { status: 422 });

  // Every SMS costs money, so also cap what one network can ask for.
  if (!(await allow(request, "otp-request", 15, 60 * 60_000))) {
    return Response.json({ error: "limit" }, { status: 429 });
  }

  const result = await requestCode(phone);
  if (!result.ok) {
    const status = result.error === "sms_failed" ? 502 : 429;
    return Response.json({ error: result.error, retryAfter: result.retryAfter }, { status });
  }
  return Response.json({ ok: true, devCode: result.devCode });
}
