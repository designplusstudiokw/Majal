import { cookies } from "next/headers";
import { repo } from "@/lib/repo";
import { ADMIN_COOKIE, isAdminToken, readJson } from "@/lib/security";
import { checkImport, toNewProject } from "@/lib/suggestions";

/**
 * POST /api/admin/suggestions/import
 *   { csv, commit: false }                       -> preview: rows with errors and duplicates
 *   { csv, commit: true, skipDuplicates: true }  -> imports valid rows, returns codes
 * The file is checked again on commit, so the preview cannot be bypassed.
 */
export async function POST(request: Request) {
  if (!isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await readJson(request);
  const csv = typeof body?.csv === "string" ? body.csv : null;
  if (!csv || csv.length > 1_000_000) return Response.json({ error: "bad_request" }, { status: 400 });

  const { rows, error } = checkImport(csv, await repo.listProjects());
  if (error) return Response.json({ error }, { status: 422 });
  if (!body?.commit) return Response.json({ rows });

  const skipDuplicates = body.skipDuplicates !== false;
  const chosen = rows.filter((r) => r.data && !(skipDuplicates && r.duplicateOf));
  const created = await repo.createProjects(chosen.map((r) => toNewProject(r.data!)));
  return Response.json({
    imported: created.map((p) => p.code),
    skipped: rows.length - created.length,
  });
}
