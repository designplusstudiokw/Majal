import type { StyleSpecification } from "maplibre-gl";

/**
 * Basemap. Set NEXT_PUBLIC_MAP_STYLE to a MapLibre style URL (e.g. the PACI
 * vector style once permission is granted) to replace the default.
 * The default uses OpenStreetMap raster tiles, fine for development only:
 * production needs a hosted tile provider that allows app traffic.
 */
export function mapStyle(): string | StyleSpecification {
  const custom = process.env.NEXT_PUBLIC_MAP_STYLE;
  if (custom) return custom;
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e9e6df" } },
      { id: "osm", type: "raster", source: "osm" },
    ],
  };
}
