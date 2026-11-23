import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Majal · مجال",
    short_name: "Majal",
    description: "Report places in the public realm that need work.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#2f4558",
    // TODO: add 192/512 PNG icons once the real logo file arrives.
    icons: [],
  };
}
