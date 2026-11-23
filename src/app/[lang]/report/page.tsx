import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportWizard from "@/components/ReportWizard";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/report">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).report.title : undefined };
}

export default async function ReportPage({ params }: PageProps<"/[lang]/report">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <ReportWizard lang={lang} dict={getDictionary(lang)} />;
}
