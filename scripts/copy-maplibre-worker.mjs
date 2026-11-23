// MapLibre 6 looks for its web worker next to its own module file, which does
// not exist once Next.js bundles the module into a chunk. We serve a copy from
// /public and point MapLibre at it with setWorkerUrl() (see LocationPicker).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(
  path.join(pkgDir, "dist", "maplibre-gl-worker.mjs"),
  path.join("public", "maplibre-gl-worker.mjs"),
);
console.log("copied maplibre-gl-worker.mjs to public/");
