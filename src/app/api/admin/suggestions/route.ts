import { cookies } from "next/headers";
import { suggestionSchema } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { ADMIN_COOKIE, isAdminToken, readJson } from "@/lib/security";
import { toNewProject } from "@/lib/suggestions";

// POST /api/admin/suggestions  { theme, area, title, description, lat, lng, fix? }
export async function POST(request: Request) {
  if (!isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await readJson(request);
  if (!body) return Response.json({ error: "bad_request" }, { status: 400 });
  const parsed = suggestionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const [project] = await repo.createProjects([toNewProject(parsed.data)]);
  return Response.json({ code: project.code }, { status: 201 });
}
