"use client";

import Link from "next/link";
import { useState } from "react";
import { csvCell } from "@/lib/csv";

type Row = { line: number; title: string; area: string; errors: string[]; duplicateOf: string | null; data: unknown };

const TEMPLATE = [
  ["theme", "area", "title", "description", "lat", "lng", "fix"],
  ["school_crossing", "السالمية", "معبر مشاة آمن أمام مدرسة …", "يعبر الطلاب الشارع بين السيارات صباحًا ولا توجد إشارة مشاة.", "29.3369", "48.0771", "pedestrian_crossing"],
  ["kindergarten_crossing", "الجابرية", "معبر أمام روضة … في القطعة 4", "روضة داخل القطعة السكنية، والسيارات تمر بسرعة وقت الانصراف.", "29.3180", "48.0280", ""],
  ["major_crossing", "حولي", "عبور شارع تونس عند …", "جسر أم عبور أرضي؟ الناس يعبرون هنا رغم وجود جسر قريب.", "29.3390", "48.0300", ""],
]
  .map((r) => r.map(csvCell).join(","))
  .join("\n");
// Byte-order mark so Excel opens Arabic text correctly.
const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${TEMPLATE}\n`)}`;

const MESSAGES: Record<string, string> = {
  empty: "The file has no rows below the header.",
  columns: "Missing columns. Required: theme, area, title, description, lat, lng (fix is optional).",
  too_many: "Too many rows. Import at most 500 at a time.",
};

export default function ImportPanel({ lang }: { lang: string }) {
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: string[]; skipped: number } | null>(null);

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/suggestions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, commit, skipDuplicates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(MESSAGES[data.error] ?? `Failed (${data.error ?? res.status}).`);
      if (commit) {
        setResult(data);
        setRows(null);
        setCsv("");
      } else setRows(data.rows);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const valid = rows?.filter((r) => r.data) ?? [];
  const dups = valid.filter((r) => r.duplicateOf);
  const toImport = skipDuplicates ? valid.length - dups.length : valid.length;

  return (
    <div className="grid gap-5">
      <ol className="grid list-decimal gap-1 ps-5 text-muted">
        <li>
          <a href={templateHref} download="majal-suggestions.csv" className="font-medium text-foreground underline">
            Download the template
          </a>{" "}
          and fill one row per place (Excel or Google Sheets, saved as CSV).
        </li>
        <li>
          <code>theme</code> is one of <code>school_crossing</code>, <code>kindergarten_crossing</code>,{" "}
          <code>major_crossing</code>. <code>lat</code>/<code>lng</code> as decimals, e.g. 29.3369 and 48.0771.
        </li>
        <li>Paste or choose the file below, check the preview, then import.</li>
      </ol>

      <div className="grid gap-2">
        <label htmlFor="csv" className="font-semibold">Spreadsheet (CSV)</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              setCsv(await file.text());
              setRows(null);
              setResult(null);
            }
          }}
        />
        <textarea
          id="csv"
          dir="auto"
          rows={8}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setRows(null);
          }}
          placeholder="theme,area,title,description,lat,lng,fix"
          className="rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm"
        />
        <button
          type="button"
          disabled={busy || !csv.trim()}
          onClick={() => send(false)}
          className="min-h-11 justify-self-start rounded-full border border-line bg-surface px-5 font-medium disabled:opacity-50"
        >
          {busy && !rows ? "Checking…" : "Check file"}
        </button>
      </div>

      {error && <p role="alert" className="text-danger">{error}</p>}

      {rows && (
        <section className="grid gap-3">
          <p>
            <strong>{rows.length}</strong> rows: <strong>{valid.length}</strong> valid,{" "}
            <strong>{rows.length - valid.length}</strong> with errors, <strong>{dups.length}</strong> near an existing place.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-background text-start">
                <tr>
                  <th className="px-3 py-2 text-start">Line</th>
                  <th className="px-3 py-2 text-start">Area</th>
                  <th className="px-3 py-2 text-start">Title</th>
                  <th className="px-3 py-2 text-start">Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t border-line">
                    <td className="px-3 py-2">{r.line}</td>
                    <td className="px-3 py-2" dir="auto">{r.area}</td>
                    <td className="px-3 py-2" dir="auto">{r.title}</td>
                    <td className="px-3 py-2">
                      {r.errors.length ? (
                        <span className="text-danger">Fix: {r.errors.join(", ")}</span>
                      ) : r.duplicateOf ? (
                        <span className="text-steel">Within 40 m of {r.duplicateOf}</span>
                      ) : (
                        <span>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dups.length > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
              Skip the {dups.length} near-duplicate{dups.length === 1 ? "" : "s"}
            </label>
          )}
          <button
            type="button"
            disabled={busy || toImport === 0}
            onClick={() => send(true)}
            className="min-h-12 justify-self-start rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import ${toImport} suggestion${toImport === 1 ? "" : "s"}`}
          </button>
          <p className="text-sm text-muted">Rows with errors are never imported. Imported places open for signatures straight away.</p>
        </section>
      )}

      {result && (
        <div role="status" className="rounded-xl border border-line bg-surface p-4">
          <p className="font-semibold">
            Imported {result.imported.length}
            {result.skipped ? `, skipped ${result.skipped}` : ""}.
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
            {result.imported.map((code) => (
              <Link key={code} href={`/${lang}/p/${code}`} className="underline">
                {code}
              </Link>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
