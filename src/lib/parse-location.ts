import { KUWAIT_BOUNDS } from "@/lib/domain";

const inKuwait = (lat: number, lng: number) =>
  lat >= KUWAIT_BOUNDS.south && lat <= KUWAIT_BOUNDS.north &&
  lng >= KUWAIT_BOUNDS.west && lng <= KUWAIT_BOUNDS.east;

/**
 * Recognise coordinates typed or pasted into the search box, so they work
 * without a network call: "29.33, 48.07", "29.33 48.07", or a map link
 * containing "@29.33,48.07" or "q=29.33,48.07". Returns null otherwise or
 * when the point is outside Kuwait.
 */
export function parseLocation(input: string): { lat: number; lng: number } | null {
  const text = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/٫/g, ".")
    .replace(/،/g, ",");
  const m =
    text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    text.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i) ??
    text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (inKuwait(a, b)) return { lat: a, lng: b };
  if (inKuwait(b, a)) return { lat: b, lng: a }; // pasted as "lng, lat"
  return null;
}
