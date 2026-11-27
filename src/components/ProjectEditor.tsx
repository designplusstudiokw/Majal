"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LocationPicker, { type LatLng } from "./LocationPicker";
import {
  FIX_KEYS,
  PROBLEM_KEYS,
  STATUSES,
  THEME_KEYS,
  photoUrl,
  type FixKey,
  type ProblemKey,
  type Project,
  type ProjectStatus,
  type ThemeKey,
} from "@/lib/domain";
import type { Dictionary } from "@/i18n/get-dictionary";

type Props = {
  lang: string;
  project: Project;
  t: Pick<Dictionary, "problems" | "fixes" | "themes" | "statuses"> & { location: Dictionary["report"]["location"] };
};

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";
const STATUS_NOTE: Partial<Record<ProjectStatus, string>> = {
  pending_review: "Not public yet.",
  rejected: "Hidden: the public sees “not found”, it leaves the map and search engines.",
};

export default function ProjectEditor({ lang, project, t }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [problem, setProblem] = useState<ProblemKey>(project.problem);
  const [fix, setFix] = useState<FixKey | "">(project.fix ?? "");
  const [theme, setTheme] = useState<ThemeKey | "">(project.theme ?? "");
  const [area, setArea] = useState(project.area ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [pin, setPin] = useState<LatLng>({ lat: project.lat, lng: project.lng });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(body: unknown) {
    const res = await fetch(`/api/admin/projects/${project.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await post({
      action: "edit",
      edit: {
        title,
        description,
        problem,
        fix: fix || null,
        theme: theme || null,
        area: area.trim() || null,
        status,
        lat: Number(pin.lat.toFixed(6)),
        lng: Number(pin.lng.toFixed(6)),
      },
    });
    setBusy(false);
    if (!r.ok) {
      const fields = Object.keys((r.data.fields as object) ?? {});
      return setMsg({ ok: false, text: fields.length ? `Check: ${fields.join(", ")}` : `Could not save (${String(r.data.error)}).` });
    }
    setMsg({ ok: true, text: r.data.unchanged ? "Nothing changed." : "Saved." });
    router.refresh();
  }

  async function removePhoto(id: string) {
    if (!confirm("Remove this photo for good? This cannot be undone.")) return;
    setBusy(true);
    const r = await post({ action: "remove_photo", photoId: id });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Photo removed." } : { ok: false, text: "Could not remove the photo." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
      <div className="grid content-start gap-4">
        <label className="grid gap-1">
          <span className="font-semibold">Stage</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={field}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "rejected" ? "Hidden / rejected" : t.statuses[s]}
              </option>
            ))}
          </select>
          {STATUS_NOTE[status] && <span className="text-sm text-muted">{STATUS_NOTE[status]}</span>}
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Title</span>
          <input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} className={field} required minLength={5} maxLength={120} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Description</span>
          <textarea dir="auto" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className={field} required minLength={10} maxLength={2000} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="font-semibold">Problem</span>
            <select value={problem} onChange={(e) => setProblem(e.target.value as ProblemKey)} className={field}>
              {PROBLEM_KEYS.map((k) => (
                <option key={k} value={k}>{t.problems[k].label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Fix idea</span>
            <select value={fix} onChange={(e) => setFix(e.target.value as FixKey | "")} className={field}>
              <option value="">None</option>
              {FIX_KEYS.map((k) => (
                <option key={k} value={k}>{t.fixes[k]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Collection</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey | "")} className={field}>
              <option value="">None</option>
              {THEME_KEYS.map((k) => (
                <option key={k} value={k}>{t.themes[k].label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Area</span>
            <input dir="auto" value={area} onChange={(e) => setArea(e.target.value)} className={field} maxLength={60} />
          </label>
        </div>

        {project.photos.length > 0 && (
          <div className="grid gap-2">
            <span className="font-semibold">Photos</span>
            <div className="flex flex-wrap gap-3">
              {project.photos.map((id) => (
                <div key={id} className="grid gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(id)} alt="" className="size-28 rounded-xl border border-line object-cover" />
                  <button type="button" disabled={busy} onClick={() => removePhoto(id)} className="text-sm text-danger underline">
                    Remove photo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button disabled={busy} className="min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-50">
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-muted" : "text-danger"}>
            {msg.text}
          </p>
        )}
      </div>
      <div className="h-[55dvh] md:h-auto md:min-h-[520px]">
        <LocationPicker lang={lang} value={pin} onChange={setPin} t={t.location} />
      </div>
    </form>
  );
}
