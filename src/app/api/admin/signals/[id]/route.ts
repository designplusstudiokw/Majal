import { isAdmin } from "@/lib/admin-auth";
import { repo } from "@/lib/repo";
import { readJson } from "@/lib/security";

// POST /api/admin/signals/<id>  { action: "dismiss" | "reopen" }
export async function POST(request: Request, ctx: RouteContext<"/api/admin/signals/[id]">) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const action = body?.action;
  if (action !== "dismiss" && action !== "reopen") return Response.json({ error: "bad_request" }, { status: 400 });
  const { id } = await ctx.params;
  const signal = await repo.setSignalStatus(id, action === "dismiss" ? "dismissed" : "new");
  if (!signal) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true, status: signal.status });
}
