// Draft a list of candidate places from OpenStreetMap for the team to review
// and then import at /ar/admin/import. Nothing is published by this script.
//
//   node scripts/osm-candidates.mjs --area "Salmiya" --type school
//   node scripts/osm-candidates.mjs --area "الجابرية" --type kindergarten --out jabriya.csv
//
// --area matches an OpenStreetMap area name in Kuwait (Arabic or English).
// --type school | kindergarten
// --label the area name written into the file (default: --area). Use one
//         spelling per area, e.g. --label "السالمية", so the explorer's area
//         filter does not list the same place twice.
//
// Coordinates are the centre of the mapped building or plot, NOT the gate or
// the crossing. Move each pin to the real crossing point before importing.
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith("--") ? [...acc, [v.slice(2), all[i + 1]]] : acc), []),
);
const area = args.area;
const label = args.label ?? area;
const type = args.type;
const THEMES = { school: "school_crossing", kindergarten: "kindergarten_crossing" };
if (!area || !THEMES[type]) {
  console.error('Usage: node scripts/osm-candidates.mjs --area "Salmiya" --type school|kindergarten [--label "السالمية"] [--out file.csv]');
  process.exit(1);
}
const out = args.out ?? `candidates-${type}-${area.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
const endpoint = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

const escaped = area.replace(/[\\"]/g, "\\$&").replace(/[.*+?^${}()|[\]]/g, "\\\\$&");
const query = `
[out:json][timeout:60];
area["ISO3166-1"="KW"][admin_level=2]->.kw;
area[~"^name(:en|:ar)?$"~"^${escaped}$",i](area.kw)->.a;
nwr["amenity"="${type}"](area.a);
out center tags;`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "civic-candidates-script/0.1" },
  body: new URLSearchParams({ data: query }),
});
if (!res.ok) {
  console.error(`Overpass error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const { elements = [] } = await res.json();

const cell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const kind = type === "school" ? "مدرسة" : "روضة";
const rows = elements
  .map((e) => {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const name = e.tags?.["name:ar"] ?? e.tags?.name ?? e.tags?.["name:en"] ?? `${kind} بدون اسم`;
    if (lat == null || lng == null) return null;
    return [
      THEMES[type],
      label,
      `معبر مشاة آمن أمام ${name}`,
      `اقتراح: معبر مشاة آمن عند مدخل ${name}. يحتاج تحققًا ميدانيًا قبل النشر.`,
      lat.toFixed(6),
      lng.toFixed(6),
      "pedestrian_crossing",
      name,
      e.tags?.["name:en"] ?? "",
      `${e.type}/${e.id}`,
      "CHECK: pin is the building centre; move it to the crossing",
    ];
  })
  .filter(Boolean);

const header = ["theme", "area", "title", "description", "lat", "lng", "fix", "osm_name", "osm_name_en", "osm_id", "review"];
// Byte-order mark so Excel opens the Arabic correctly.
writeFileSync(out, "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n");
console.log(`${rows.length} candidates written to ${out}. Review each row, fix the pins, then import.`);
