import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { dirOf, hasLocale, locales } from "@/i18n/config";
import "../globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Majal · مجال", template: "%s · Majal" },
  description:
    "Report places in the public realm that need work, gather signatures, and follow them to completion.",
};

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
