"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { KUWAIT_BOUNDS } from "@/lib/domain";
import { mapStyle } from "@/lib/map-style";
import { fmt } from "@/i18n/fmt";
import type { Dictionary } from "@/i18n/get-dictionary";

export type LatLng = { lat: number; lng: number };

type Props = {
  value: LatLng;
  onChange: (p: LatLng) => void;
  t: Dictionary["report"]["location"];
};

/**
 * Food-delivery style picker: the pin stays fixed in the middle of the map and
 * the user moves the map beneath it. "Use my location" is a shortcut only.
 */
export default function LocationPicker({ value, onChange, t }: Props) {
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

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    let resizer: ResizeObserver | null = null;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        // Served from /public by scripts/copy-maplibre-worker.mjs.
        maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
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
          attributionControl: { compact: true },
          // Pitch and rotation only confuse people placing a pin.
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false,
        });
        instance.touchZoomRotate.disableRotation();
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
        map.current?.flyTo({ center: [longitude, latitude], zoom: 17.5 });
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

  return (
    <div className="relative h-full min-h-72 overflow-hidden rounded-2xl border border-line bg-surface">
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
  );
}
