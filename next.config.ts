import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Loads its WebAssembly file relative to itself, which bundling breaks.
  serverExternalPackages: ["harfbuzzjs"],
  // Preview images and icons read these fonts at runtime; make sure deployments ship them.
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./assets/fonts/*.ttf"],
    "/icon/**": ["./assets/fonts/*.ttf"],
    "/apple-icon": ["./assets/fonts/*.ttf"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
