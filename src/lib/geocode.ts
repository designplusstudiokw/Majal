import "server-only";
import { KUWAIT_BOUNDS } from "@/lib/domain";

export type Place = { id: string; name: string; detail: string; lat: number; lng: number };

/**
 * Place search, restricted to Kuwait. Uses Nominatim (OpenStreetMap).
 * The public instance (default) allows ~1 request/second, forbids
 * autocomplete, and requires a User-Agent that identifies the app: set
 * GEOCODER_USER_AGENT. For real traffic, self-host Nominatim (NOMINATIM_URL),
 * use a commercial geocoder, or PACI's address service once permitted.
 */
const BASE = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? "nextjs-geocoder/0.1";
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_MAX = 500;

const cache = new Map<string, { at: number; places: Place[] }>();

// Serialise upstream calls and space them out to respect the usage policy.
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

type NominatimItem = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
};

export async function searchPlaces(query: string, lang: "ar" | "en"): Promise<Place[]> {
  const q = query.trim().replace(/\s+/g, " ");
  const key = `${lang}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.places;

  const url = new URL("/search", BASE);
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "kw",
    viewbox: `${KUWAIT_BOUNDS.west},${KUWAIT_BOUNDS.north},${KUWAIT_BOUNDS.east},${KUWAIT_BOUNDS.south}`,
    bounded: "1",
    limit: "6",
    "accept-language": lang,
  }).toString();

  const items = await throttled(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    return (await res.json()) as NominatimItem[];
  });

  const places = items.map((item) => {
    const parts = item.display_name.split(/[,،]\s*/).filter((p) => !/^(Kuwait|الكويت)$/.test(p));
    const name = item.name?.trim() || parts[0] || item.display_name;
    return {
      id: String(item.place_id),
      name,
      detail: parts.filter((p) => p !== name).slice(0, 3).join(lang === "ar" ? "، " : ", "),
      lat: Number(item.lat),
      lng: Number(item.lon),
    };
  });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), places });
  return places;
}
