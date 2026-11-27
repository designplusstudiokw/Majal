import { isAdmin } from "@/lib/admin-auth";
import { projectEditSchema, type Project } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { readJson } from "@/lib/security";

/**
 * POST /api/admin/projects/P-0001
 *   { action: "approve" | "reject" }          pending reports only
 *   { action: "edit", edit: { ...fields } }   any project; status included
 *   { action: "remove_photo", photoId }
 * Every change is written to the moderation log with before/after values.
 */
const ACTOR = "admin"; // shared admin password for now; personal accounts next

export async function POST(request: Request, ctx: RouteContext<"/api/admin/projects/[code]">) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const action = body?.action;
  const { code } = await ctx.params;

  const current = await repo.getProjectByCode(code);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });

  if (action === "approve" || action === "reject") {
    // Only reports waiting for review can be approved or rejected here.
    if (current.status !== "pending_review") {
      return Response.json({ error: "not_pending" }, { status: 409 });
    }
    const status = action === "approve" ? "open_for_signatures" : "rejected";
    const project = await repo.setProjectStatus(code, status);
    await repo.logModeration({ actor: ACTOR, action, projectCode: current.code, details: { from: current.status, to: status } });
    return Response.json({ ok: true, status: project?.status });
  }

  if (action === "edit") {
    const parsed = projectEditSchema.safeParse(body?.edit);
    if (!parsed.success) {
      return Response.json({ error: "validation", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
    }
    const changes = changed(current, parsed.data);
    if (!Object.keys(changes).length) return Response.json({ ok: true, unchanged: true });
    const project = await repo.updateProject(code, parsed.data);
    await repo.logModeration({ actor: ACTOR, action: "edit", projectCode: current.code, details: changes });
    return Response.json({ ok: true, status: project?.status });
  }

  if (action === "remove_photo") {
    const photoId = typeof body?.photoId === "string" ? body.photoId : "";
    const project = await repo.removePhoto(code, photoId);
    if (!project) return Response.json({ error: "photo_not_found" }, { status: 404 });
    await repo.logModeration({ actor: ACTOR, action: "remove_photo", projectCode: current.code, details: { photoId } });
    return Response.json({ ok: true, photos: project.photos.length });
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}

/** Fields whose value actually changes, as { field: { from, to } }. */
function changed(current: Project, edit: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(edit)) {
    const before = current[k as keyof Project];
    if (v !== undefined && v !== before) out[k] = { from: before, to: v };
  }
  return out;
}
