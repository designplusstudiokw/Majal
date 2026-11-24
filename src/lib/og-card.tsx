import "server-only";
import { textImage, type TextOptions } from "@/lib/og-text";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG = {
  background: "#f6f5f2",
  surface: "#ffffff",
  ink: "#16212b",
  muted: "#5c6873",
  line: "#dcdad4",
  accent: "#c8501e",
  padding: 64,
};

/** A block of text rendered as an image (see og-text.ts for why). */
export function Txt(props: TextOptions & { style?: React.CSSProperties }) {
  const { style, ...opts } = props;
  const t = textImage(opts);
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img src={t.src} width={t.width} height={t.height} style={style} />;
}
