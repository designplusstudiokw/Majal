import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { dirOf, hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SITE_NAME, SITE_URL, ogLocale } from "@/lib/site";
import "../globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDictionary(hasLocale(lang) ? lang : "ar");
  return {
    metadataBase: SITE_URL,
    title: { default: `${t.brand} · ${t.home.headline}`, template: `%s · ${t.brand}` },
    description: t.home.sub,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    openGraph: { type: "website", siteName: SITE_NAME, locale: ogLocale(lang) },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximum-scale: users must be able to zoom.
  themeColor: "#2f4558",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang} dir={dirOf(lang)} className={plex.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
