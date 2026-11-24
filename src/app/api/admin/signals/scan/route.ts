import { isAdmin } from "@/lib/admin-auth";
import { runScanStep } from "@/lib/signals/scan";

export const maxDuration = 300;

// POST /api/admin/signals/scan  -> runs the next step of the rotation now
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await runScanStep());
}
