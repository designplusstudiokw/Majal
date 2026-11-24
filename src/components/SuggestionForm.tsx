"use client";

import Link from "next/link";
import { useState } from "react";
import LocationPicker, { type LatLng } from "./LocationPicker";
import { DEFAULT_CENTER, FIX_KEYS, THEME_KEYS, type FixKey, type ThemeKey } from "@/lib/domain";
import type { Dictionary } from "@/i18n/get-dictionary";

type Props = {
  lang: string;
  t: Pick<Dictionary, "themes" | "fixes"> & { location: Dictionary["report"]["location"] };
};

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";

/** Add one curated suggestion. Theme, area and map position are kept after
 *  saving, so several points in the same area are quick to enter. */
export default function SuggestionForm({ lang, t }: Props) {
  const [theme, setTheme] = useState<ThemeKey>("school_crossing");
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fix, setFix] = useState<FixKey | "">("");
  const [pin, setPin] = useState<LatLng>(DEFAULT_CENTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, area, title, description, fix: fix || undefined, lat: pin.lat, lng: pin.lng }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fields = Object.keys(data.fields ?? {});
        setError(fields.length ? `Check: ${fields.join(", ")}` : `Could not save (${data.error ?? res.status}).`);
        return;
      }
      setSaved((s) => [data.code, ...s]);
      setTitle("");
      setDescription("");
      setFix("");
    } catch {
      setError("Could not save. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
      <div className="grid content-start gap-4">
        <label className="grid gap-1">
          <span className="font-semibold">Collection</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} className={field}>
            {THEME_KEYS.map((k) => (
              <option key={k} value={k}>
                {t.themes[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Area</span>
          <input dir="auto" value={area} onChange={(e) => setArea(e.target.value)} placeholder="السالمية" className={field} required minLength={2} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Title</span>
          <input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="معبر مشاة آمن أمام مدرسة …" className={field} required minLength={5} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Description</span>
          <textarea dir="auto" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={field} required minLength={10} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Fix idea (optional)</span>
          <select value={fix} onChange={(e) => setFix(e.target.value as FixKey | "")} className={field}>
            <option value="">None. Let people propose</option>
            {FIX_KEYS.map((k) => (
              <option key={k} value={k}>
                {t.fixes[k]}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className="min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-50">
          {busy ? "Saving…" : "Save and open for signatures"}
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
        {saved.length > 0 && (
          <div role="status" className="rounded-xl border border-line bg-surface p-3 text-sm">
            <p className="font-semibold">Saved {saved.length} in this session:</p>
            <p className="mt-1 flex flex-wrap gap-x-3">
              {saved.map((code) => (
                <Link key={code} href={`/${lang}/p/${code}`} className="underline">
                  {code}
                </Link>
              ))}
            </p>
          </div>
        )}
      </div>
      <div className="h-[60dvh] md:h-auto md:min-h-[520px]">
        <LocationPicker lang={lang} value={pin} onChange={setPin} t={t.location} />
      </div>
    </form>
  );
}
