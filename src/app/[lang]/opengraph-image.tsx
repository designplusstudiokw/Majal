import { ImageResponse } from "next/og";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { OG, OG_SIZE, Txt } from "@/lib/og-card";
import { SITE_URL } from "@/lib/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Majal";

const W = OG_SIZE.width - OG.padding * 2;

/** Default preview for pages without their own (home, explore, report). */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : "ar";
  const t = getDictionary(lang);
  const rtl = lang === "ar";
  const start = rtl ? "flex-end" : "flex-start";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: start,
          width: "100%",
          height: "100%",
          background: OG.background,
          padding: OG.padding,
          [rtl ? "borderRight" : "borderLeft"]: `14px solid ${OG.accent}`,
        }}
      >
        <Txt text={t.brand} size={44} weight={700} color={OG.accent} maxWidth={W} rtl={rtl} />
        <div style={{ display: "flex", flex: 1 }} />
        <Txt text={t.home.headline} size={76} weight={700} color={OG.ink} maxWidth={W} maxLines={2} lineHeight={1.25} rtl={rtl} />
        <Txt text={t.home.sub} size={32} color={OG.muted} maxWidth={W} maxLines={3} lineHeight={1.45} rtl={rtl} style={{ marginTop: 20 }} />
        <div style={{ display: "flex", flex: 1 }} />
        <Txt text={SITE_URL.host} size={28} weight={700} color={OG.muted} maxWidth={W} rtl={rtl} />
      </div>
    ),
    OG_SIZE,
  );
}
