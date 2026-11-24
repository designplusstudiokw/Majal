import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Blob, Buffer, Face, Font, shape } from "harfbuzzjs";

/**
 * Text for link-preview images, drawn as vector outlines.
 *
 * next/og's layout engine joins Arabic letters but cannot measure or order
 * them: words come out in the wrong order with random gaps. So we shape the
 * text ourselves with HarfBuzz (the engine browsers use), wrap and order the
 * words, and hand next/og a ready-made SVG image.
 */

type Weight = 400 | 700;
type Loaded = { font: Font; upem: number; ascender: number; descender: number };
const fonts = new Map<Weight, Loaded>();
const glyphPaths = new Map<string, string>();

function load(weight: Weight): Loaded {
  let f = fonts.get(weight);
  if (!f) {
    const bytes = readFileSync(path.join(process.cwd(), "assets/fonts", `IBMPlexSansArabic-${weight}.ttf`));
    const face = new Face(new Blob(bytes));
    const font = new Font(face);
    const { ascender, descender } = font.hExtents();
    f = { font, upem: face.upem, ascender, descender };
    fonts.set(weight, f);
  }
  return f;
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export const isRtlText = (s: string) => ARABIC.test(s);

type Glyph = { id: number; x: number; dx: number; dy: number };
type Shaped = { glyphs: Glyph[]; width: number }; // font units, visual order

function shapeRun(f: Loaded, text: string): Shaped {
  const buf = new Buffer();
  buf.addText(text);
  buf.guessSegmentProperties(); // script and direction from the text itself
  shape(f.font, buf);
  const glyphs: Glyph[] = [];
  let x = 0;
  // HarfBuzz returns glyphs in visual (left-to-right) order, already joined.
  for (const g of buf.getGlyphInfosAndPositions()) {
    glyphs.push({ id: g.codepoint, x, dx: g.xOffset ?? 0, dy: g.yOffset ?? 0 });
    x += g.xAdvance ?? 0;
  }
  return { glyphs, width: x };
}

export type TextOptions = {
  text: string;
  size: number;
  weight?: Weight;
  color: string;
  maxWidth: number;
  maxLines?: number;
  lineHeight?: number; // multiple of size
  /** Force direction; defaults to the text's own. */
  rtl?: boolean;
  /** Shrink the image to the text instead of using maxWidth. */
  fit?: boolean;
  /** Which edge lines sit against; defaults to the text's start edge. Word
   *  order always follows the text's own direction. */
  align?: "left" | "right";
};

/** Lay out `text` and return an SVG image (data URL) with its pixel size. */
export function textImage(o: TextOptions): { src: string; width: number; height: number; rtl: boolean } {
  const f = load(o.weight ?? 400);
  const scale = o.size / f.upem;
  const rtl = o.rtl ?? isRtlText(o.text);
  const maxUnits = o.maxWidth / scale;
  const space = shapeRun(f, " ").width;

  // Tokens in reading order. In right-to-left text, neighbouring
  // left-to-right words (codes, numbers, Latin names) stay together.
  const words = o.text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const tokens: string[] = [];
  for (const w of words) {
    const last = tokens[tokens.length - 1];
    if (rtl && last !== undefined && !isRtlText(w) && !isRtlText(last)) tokens[tokens.length - 1] = `${last} ${w}`;
    else tokens.push(w);
  }

  // Greedy line wrapping on shaped widths.
  const shaped = tokens.map((t) => ({ text: t, s: shapeRun(f, t) }));
  const lines: (typeof shaped)[] = [];
  let line: typeof shaped = [];
  let lineW = 0;
  for (const tok of shaped) {
    const add = (line.length ? space : 0) + tok.s.width;
    if (line.length && lineW + add > maxUnits) {
      lines.push(line);
      line = [tok];
      lineW = tok.s.width;
    } else {
      line.push(tok);
      lineW += add;
    }
  }
  if (line.length) lines.push(line);

  // Too many lines: keep maxLines, ending the last one with an ellipsis
  // attached to its final word.
  const lineUnits = (l: typeof shaped) => l.reduce((a, t, i) => a + t.s.width + (i ? space : 0), 0);
  if (o.maxLines && lines.length > o.maxLines) {
    lines.length = o.maxLines;
    const last = lines[o.maxLines - 1];
    const withEllipsis = () => {
      const tail = `${last[last.length - 1].text}…`;
      return [...last.slice(0, -1), { text: tail, s: shapeRun(f, tail) }];
    };
    while (last.length > 1 && lineUnits(withEllipsis()) > maxUnits) last.pop();
    lines[o.maxLines - 1] = withEllipsis();
  }

  const boxUnits = o.fit ? Math.max(...lines.map(lineUnits), 0) : maxUnits;
  const lineH = o.size * (o.lineHeight ?? 1.35);
  const glyphH = (f.ascender - f.descender) * scale;
  const paths: string[] = [];
  lines.forEach((l, li) => {
    const baseline = li * lineH + (lineH - glyphH) / 2 + f.ascender * scale;
    // Tokens flow from the text's start edge; the line sits against `align`.
    const alignRight = (o.align ?? (rtl ? "right" : "left")) === "right";
    const lw = lineUnits(l);
    const left = alignRight ? boxUnits - lw : 0;
    let cursor = rtl ? left + lw : left;
    for (const tok of l) {
      const x0 = rtl ? cursor - tok.s.width : cursor;
      for (const g of tok.s.glyphs) {
        const key = `${o.weight ?? 400}:${g.id}`;
        let d = glyphPaths.get(key);
        if (d === undefined) {
          d = f.font.glyphToPath(g.id);
          glyphPaths.set(key, d);
        }
        if (!d) continue; // spaces and empty glyphs
        const gx = (x0 + g.x + g.dx) * scale;
        const gy = baseline - g.dy * scale;
        paths.push(`<path transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`);
      }
      cursor = rtl ? x0 - space : x0 + tok.s.width + space;
    }
  });

  const width = Math.ceil(boxUnits * scale);
  const height = Math.ceil(lines.length * lineH);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="${o.color}">${paths.join("")}</g></svg>`;
  return { src: `data:image/svg+xml;base64,${globalThis.Buffer.from(svg).toString("base64")}`, width, height, rtl };
}
