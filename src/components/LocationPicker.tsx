"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { KUWAIT_BOUNDS } from "@/lib/domain";
import { mapStyle } from "@/lib/map-style";
import { loadMapLibre } from "@/lib/maplibre";
import { parseLocation } from "@/lib/parse-location";
import { fmt } from "@/i18n/fmt";
import type { Dictionary } from "@/i18n/get-dictionary";

export type LatLng = { lat: number; lng: number };

type Place = { id: string; name: string; detail: string; lat: number; lng: number };

type Props = {
  lang: string;
  value: LatLng;
  onChange: (p: LatLng) => void;
  t: Dictionary["report"]["location"];
};

/**
 * Food-delivery style picker: the pin stays fixed in the middle of the map and
 * the user moves the map beneath it. "Use my location" is a shortcut only.
 */
export default function LocationPicker({ lang, value, onChange, t }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const onChangeRef = useRef(onChange);
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [gps, setGps] = useState<
    | { state: "idle" }
    | { state: "locating" }
    | { state: "denied" }
    | { state: "unsupported" }
    | { state: "ok"; accuracy: number }
  >({ state: "idle" });

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "results"; places: Place[] }
    | { state: "empty" }
    | { state: "error" }
    | { state: "jumped" }
  >({ state: "idle" });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    let resizer: ResizeObserver | null = null;

    (async () => {
      try {
        const maplibre = await loadMapLibre();
        if (cancelled || !box.current) return;
        instance = new maplibre.Map({
          container: box.current,
          style: mapStyle(),
          center: [value.lng, value.lat],
          zoom: 15.5,
          minZoom: 8,
          maxZoom: 19,
          maxBounds: [
            [KUWAIT_BOUNDS.west, KUWAIT_BOUNDS.south],
            [KUWAIT_BOUNDS.east, KUWAIT_BOUNDS.north],
          ],
          // Added below at the top so it never sits under "Use my location".
          attributionControl: false,
          // Pitch and rotation only confuse people placing a pin.
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false,
        });
        instance.touchZoomRotate.disableRotation();
        instance.addControl(new maplibre.AttributionControl({ compact: true }), "top-left");
        instance.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.on("movestart", () => setMoving(true));
        instance.on("moveend", () => {
          setMoving(false);
          const c = instance!.getCenter();
          onChangeRef.current({ lat: c.lat, lng: c.lng });
        });
        map.current = instance;
        // The wizard hides this map on other steps; resize when it returns.
        resizer = new ResizeObserver(() => instance?.resize());
        resizer.observe(box.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      resizer?.disconnect();
      instance?.remove();
      map.current = null;
    };
    // The map is created once; later value changes come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record the target right away: if the person taps Continue while the map
  // is still animating, the report must already hold the new spot.
  function flyTo(lat: number, lng: number) {
    onChangeRef.current({ lat, lng });
    map.current?.flyTo({ center: [lng, lat], zoom: 17.5, maxDuration: 1200 });
  }

  function jumpTo(lat: number, lng: number) {
    flyTo(lat, lng);
    setSearch({ state: "jumped" });
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    // Coordinates or a pasted map link: no network call needed.
    const point = parseLocation(q);
    if (point) return jumpTo(point.lat, point.lng);

    setSearch({ state: "loading" });
    try {
      const res = await fetch(`/api/geocode?${new URLSearchParams({ q, lang })}`);
      if (!res.ok) return setSearch({ state: "error" });
      const { results } = (await res.json()) as { results: Place[] };
      setSearch(results.length ? { state: "results", places: results } : { state: "empty" });
    } catch {
      setSearch({ state: "error" });
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setGps({ state: "unsupported" });
      return;
    }
    setGps({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGps({ state: "ok", accuracy: Math.round(accuracy) });
        flyTo(latitude, longitude);
      },
      () => setGps({ state: "denied" }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  const message =
    gps.state === "denied"
      ? t.denied
      : gps.state === "unsupported"
        ? t.unsupported
        : gps.state === "ok"
          ? fmt(t.accuracy, { m: gps.accuracy })
          : null;

  const searchMessage =
    search.state === "empty"
      ? t.noResults
      : search.state === "error"
        ? t.searchUnavailable
        : search.state === "jumped"
          ? t.jumped
          : null;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* A div, not a <form>: this sits inside the report form. */}
      <div role="search" className="relative">
        <label htmlFor="place-search" className="sr-only">
          {t.searchLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="place-search"
            type="search"
            enterKeyHint="search"
            value={query}
            placeholder={t.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the report form
                void runSearch();
              } else if (e.key === "Escape") {
                setSearch({ state: "idle" });
              }
            }}
            aria-describedby={searchMessage ? "search-msg" : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={search.state === "loading"}
            className="min-h-11 shrink-0 rounded-xl bg-foreground px-4 font-medium text-background disabled:opacity-60"
          >
            {search.state === "loading" ? t.searching : t.search}
          </button>
        </div>
        {search.state === "results" && (
          <ul
            aria-label={t.resultsLabel}
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-lg"
          >
            {search.places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(p.lat, p.lng)}
                  className="block min-h-12 w-full px-4 py-2.5 text-start hover:bg-background focus-visible:bg-background"
                >
                  <span className="block font-medium">{p.name}</span>
                  {p.detail && <span className="block text-sm text-muted">{p.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p id="search-msg" role="status" className={searchMessage ? "mt-1 text-sm text-muted" : "sr-only"}>
          {searchMessage ?? ""}
        </p>
      </div>

      <div className="relative min-h-72 flex-1 overflow-hidden rounded-2xl border border-line bg-surface">
        <div ref={box} className="absolute inset-0" />

        {failed ? (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted">
            {t.mapUnavailable}
          </p>
        ) : (
          <>
            {/* Fixed pin: its tip sits on the exact centre of the map. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 map-pin"
            >
              <svg
                width="40"
                height="52"
                viewBox="0 0 40 52"
                className={`drop-shadow-md transition-transform duration-150 ${moving ? "-translate-y-2" : ""}`}
              >
                <path
                  d="M20 51C20 51 4 31 4 19a16 16 0 0 1 32 0c0 12-16 32-16 32Z"
                  fill="var(--accent)"
                  stroke="#fff"
                  strokeWidth="2.5"
                />
                <circle cx="20" cy="19" r="6" fill="#fff" />
              </svg>
            </div>

            <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
              {message && (
                <p
                  role="status"
                  className="rounded-xl bg-surface/95 px-3 py-2 text-sm shadow"
                >
                  {message}
                </p>
              )}
              <button
                type="button"
                onClick={locate}
                disabled={gps.state === "locating"}
                className="min-h-11 self-start rounded-full bg-surface px-4 text-sm font-medium shadow ring-1 ring-line disabled:opacity-60"
              >
                {gps.state === "locating" ? t.locating : t.useMine}
              </button>
            </div>
          </>
        )}
        <span className="sr-only" aria-live="polite">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </span>
      </div>
    </div>
  );
}
