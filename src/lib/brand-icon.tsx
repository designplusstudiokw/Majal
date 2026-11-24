import "server-only";
import { ImageResponse } from "next/og";
import { textImage } from "@/lib/og-text";

/**
 * App icon: the name in bold white on a steel plate, like a street sign or
 * the project plaque. Typographic until the real logo arrives.
 * Content stays inside the central 80% so Android can crop it (maskable).
 */
export const PLATE = "#2f4558";

export function brandIcon(px: number) {
  const small = px < 96;
  // Tiny sizes (browser tabs) only fit a single letter.
  const main = textImage({
    text: small ? "م" : "مجال",
    size: small ? px * 0.72 : px * 0.3,
    weight: 700,
    color: "#ffffff",
    maxWidth: px,
    fit: true,
    lineHeight: small ? 1.1 : 1.2,
  });
  const latin = small
    ? null
    : textImage({ text: "MAJAL", size: px * 0.1, weight: 700, color: "#c9d6e0", maxWidth: px, fit: true, lineHeight: 1.2 });

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: PLATE,
          gap: px * 0.02,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={main.src} width={main.width} height={main.height} />
        {latin && (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={latin.src} width={latin.width} height={latin.height} style={{ letterSpacing: 4 }} />
        )}
      </div>
    ),
    { width: px, height: px },
  );
}
