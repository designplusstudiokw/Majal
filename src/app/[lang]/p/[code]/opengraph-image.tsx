import { ImageResponse } from "next/og";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { signatureCountText } from "@/i18n/signature-count";
import { SIGNATURE_TARGET, STATUS_COLORS, isPublicStatus } from "@/lib/domain";
import { OG, OG_SIZE, Txt } from "@/lib/og-card";
import { repo } from "@/lib/repo";
import { SITE_URL } from "@/lib/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Majal project";

const W = OG_SIZE.width - OG.padding * 2;

export default async function Image({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { lang: rawLang, code } = await params;
  const lang = hasLocale(rawLang) ? rawLang : "ar";
  const t = getDictionary(lang);
  const rtl = lang === "ar";
  const found = await repo.getProjectByCode(code);
  const project = found?.status === "rejected" ? null : found; // hidden: no details in previews
  const start = rtl ? "flex-end" : "flex-start";

  if (!project) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: OG.background, padding: OG.padding, alignItems: "center" }}>
          <Txt text={t.brand} size={96} weight={700} color={OG.ink} maxWidth={W} rtl={rtl} />
        </div>
      ),
      OG_SIZE,
    );
  }

  const isPublic = isPublicStatus(project.status);
  const statusColor = isPublic ? STATUS_COLORS[project.status as keyof typeof STATUS_COLORS] : OG.muted;
  const signatures = isPublic ? await repo.countSignatures(project.code) : 0;
  const pct = Math.min(1, signatures / SIGNATURE_TARGET);

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
          // Accent edge on the reading-start side.
          [rtl ? "borderRight" : "borderLeft"]: `14px solid ${OG.accent}`,
        }}
      >
        {/* Brand and project code */}
        <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", width: W }}>
          <Txt text={t.brand} size={40} weight={700} color={OG.ink} maxWidth={400} fit rtl={rtl} />
          <Txt text={project.code} size={30} weight={700} color={OG.muted} maxWidth={300} fit rtl={false} />
        </div>

        {/* Status pill */}
        <div
          style={{
            display: "flex",
            flexDirection: rtl ? "row-reverse" : "row",
            alignItems: "center",
            gap: 14,
            marginTop: 40,
            padding: "10px 24px",
            borderRadius: 999,
            background: OG.surface,
            border: `2px solid ${OG.line}`,
          }}
        >
          <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: statusColor }} />
          <Txt text={t.statuses[project.status]} size={28} weight={700} color={OG.ink} maxWidth={600} fit rtl={rtl} />
        </div>

        {/* Titles may be in either language; keep them on the card's start edge. */}
        <Txt text={project.title} size={64} weight={700} color={OG.ink} maxWidth={W} maxLines={2} lineHeight={1.3} align={rtl ? "right" : "left"} style={{ marginTop: 28 }} />
        <Txt text={[project.theme ? t.themes[project.theme].short : t.problems[project.problem].label, project.area].filter(Boolean).join(" · ")} size={32} color={OG.muted} maxWidth={W} maxLines={1} rtl={rtl} style={{ marginTop: 8 }} />

        <div style={{ display: "flex", flex: 1 }} />

        {isPublic && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: start, width: W, gap: 14 }}>
            <Txt text={signatureCountText(t.sign, signatures, SIGNATURE_TARGET)} size={32} weight={700} color={OG.ink} maxWidth={W} rtl={rtl} />
            <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", width: W, height: 16, borderRadius: 999, background: OG.line }}>
              <div style={{ display: "flex", width: Math.max(16, Math.round(W * pct)), height: 16, borderRadius: 999, background: OG.accent }} />
            </div>
          </div>
        )}
        <Txt text={`${SITE_URL.host}/p/${project.code}`} size={26} color={OG.muted} maxWidth={W} rtl={rtl} style={{ marginTop: 18 }} />
      </div>
    ),
    OG_SIZE,
  );
}
