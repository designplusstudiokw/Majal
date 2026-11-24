import { searchPlaces } from "@/lib/geocode";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security";

// GET /api/geocode?q=salmiya&lang=ar
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const lang = params.get("lang") === "en" ? "en" : "ar";
  if (q.length < 2 || q.length > 100) {
    return Response.json({ error: "bad_query" }, { status: 400 });
  }
  if (!rateLimit(`geocode-ip:${clientIp(request)}`, 30, 60_000)) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  try {
    return Response.json({ results: await searchPlaces(q, lang) });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
