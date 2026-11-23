import { cookies } from "next/headers";
import { repo } from "@/lib/repo";
import { SESSION_COOKIE, readSession } from "@/lib/security";

// POST /api/projects/P-0001/sign  (needs the session cookie from /api/otp/verify)
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[code]/sign">) {
  // Same JSON-only rule as the other write endpoints (see readJson).
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { code } = await ctx.params;

  const phoneHash = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!phoneHash) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const project = await repo.getProjectByCode(code);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  if (project.status !== "open_for_signatures") {
    return Response.json({ error: "not_open" }, { status: 409 });
  }

  const { created } = await repo.addSignature(project.code, phoneHash);
  const count = await repo.countSignatures(project.code);
  return Response.json({ ok: true, alreadySigned: !created, count });
}
