import { isAdmin } from "@/lib/admin-auth";
import { urlKey } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { readJson } from "@/lib/security";
import { readIntake } from "@/lib/signals/claude";

export const maxDuration = 120;

// POST /api/admin/signals/intake  { url?, text? }
export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 8000) : "";
  if (!url && !text) return Response.json({ error: "empty" }, { status: 400 });
  if (url && !urlKey(url)) return Response.json({ error: "bad_url" }, { status: 400 });

  try {
    const { signals } = await readIntake({ url: url || undefined, text: text || undefined });
    const added = await repo.addSignals(signals);
    return Response.json({ found: signals.length, added: added.length, duplicate: signals.length > added.length });
  } catch (e) {
    return Response.json({ error: "failed", detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
