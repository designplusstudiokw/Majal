"use client";

/** Load MapLibre in the browser and point it at the worker served from /public
 *  (see scripts/copy-maplibre-worker.mjs). */
export async function loadMapLibre() {
  const maplibre = await import("maplibre-gl");
  maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
  return maplibre;
}
