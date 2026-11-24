import { safeEqual } from "@/lib/security";
import { runScanStep } from "@/lib/signals/scan";

// Called by a scheduler (e.g. Vercel Cron, GitHub Actions) with
//   Authorization: Bearer <CRON_SECRET>
// Each call scans the next languages in the rotation.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "disabled" }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runScanStep());
}
