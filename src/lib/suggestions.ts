import "server-only";
import {
  THEME_PROBLEM,
  distanceMeters,
  suggestionSchema,
  type Project,
  type SuggestionInput,
} from "@/lib/domain";
import { parseCsv } from "@/lib/csv";
import type { NewProject } from "@/lib/repo/types";

export const IMPORT_COLUMNS = ["theme", "area", "title", "description", "lat", "lng", "fix"] as const;
export const MAX_IMPORT_ROWS = 500;
/** Closer than this to another project counts as a likely duplicate. */
export const DUPLICATE_RADIUS_M = 40;

export type ImportRow = {
  line: number; // 1-based line in the file, header included
  title: string;
  area: string;
  errors: string[]; // field names that failed validation
  duplicateOf: string | null; // project code or "line N"
  data: SuggestionInput | null;
};

/** Curated suggestions are reviewed by the team, so they open for signatures. */
export function toNewProject(s: SuggestionInput): NewProject {
  return {
    ...s,
    problem: s.problem ?? THEME_PROBLEM[s.theme],
    source: "curated",
    status: "open_for_signatures",
  };
}

export function checkImport(
  csv: string,
  existing: Project[],
): { rows: ImportRow[]; error?: "empty" | "columns" | "too_many" } {
  const table = parseCsv(csv);
  if (table.length < 2) return { rows: [], error: "empty" };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = IMPORT_COLUMNS.filter((c) => c !== "fix" && !header.includes(c));
  if (missing.length) return { rows: [], error: "columns" };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { rows: [], error: "too_many" };

  const col = (r: string[], name: string) => (r[header.indexOf(name)] ?? "").trim();
  const live = existing.filter((p) => p.status !== "rejected");
  const accepted: { line: number; lat: number; lng: number }[] = [];

  const rows = table.slice(1).map((r, i): ImportRow => {
    const line = i + 2;
    const parsed = suggestionSchema.safeParse({
      theme: col(r, "theme"),
      area: col(r, "area"),
      title: col(r, "title"),
      description: col(r, "description"),
      lat: col(r, "lat"),
      lng: col(r, "lng"),
      fix: col(r, "fix") || undefined,
      problem: col(r, "problem") || undefined,
    });
    const base = { line, title: col(r, "title"), area: col(r, "area") };
    if (!parsed.success) {
      return { ...base, errors: Object.keys(parsed.error.flatten().fieldErrors), duplicateOf: null, data: null };
    }
    const here = parsed.data;
    const near = live.find((p) => distanceMeters(p, here) < DUPLICATE_RADIUS_M);
    const nearRow = accepted.find((a) => distanceMeters(a, here) < DUPLICATE_RADIUS_M);
    accepted.push({ line, lat: here.lat, lng: here.lng });
    return {
      ...base,
      errors: [],
      duplicateOf: near ? near.code : nearRow ? `line ${nearRow.line}` : null,
      data: here,
    };
  });
  return { rows };
}
