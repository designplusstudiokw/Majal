import { cookies } from "next/headers";
import { repo } from "@/lib/repo";
import { ADMIN_COOKIE, isAdminToken, readJson } from "@/lib/security";

// POST /api/admin/projects/P-0001  { action: "approve" | "reject" }
export async function POST(request: Request, ctx: RouteContext<"/api/admin/projects/[code]">) {
  if (!isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await readJson(request);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { code } = await ctx.params;
  const current = await repo.getProjectByCode(code);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  // Only reports waiting for review can be approved or rejected here.
  if (current.status !== "pending_review") {
    return Response.json({ error: "not_pending" }, { status: 409 });
  }
  const project = await repo.setProjectStatus(
    code,
    action === "approve" ? "open_for_signatures" : "rejected",
  );
  return Response.json({ ok: true, status: project?.status });
}
