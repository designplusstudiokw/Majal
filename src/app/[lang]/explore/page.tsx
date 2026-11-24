import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Explorer from "@/components/Explorer";
import LangToggle from "@/components/LangToggle";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { repo } from "@/lib/repo";
import Wordmark from "@/components/Wordmark";

export async function generateMetadata({ params }: PageProps<"/[lang]/explore">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).explore.title : undefined };
}

export default async function ExplorePage({ params }: PageProps<"/[lang]/explore">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 md:h-dvh md:max-w-none md:p-0">
      <header className="flex items-center justify-between gap-3 md:border-b md:border-line md:px-4 md:py-3">
        <Link href={`/${lang}`} aria-label={t.brand}>
          <Wordmark />
        </Link>
        <h1 className="sr-only">{t.explore.title}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/${lang}/report`} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            {t.explore.report}
          </Link>
          <LangToggle lang={lang} label={t.switchLang} />
        </div>
      </header>
      <Suspense fallback={<p className="py-20 text-center text-muted">…</p>}>
        <Projects lang={lang} />
      </Suspense>
    </main>
  );
}

async function Projects({ lang }: { lang: Locale }) {
  // Always read fresh data at request time; never bake the list in at build.
  await connection();
  const t = getDictionary(lang);
  const projects = await repo.listPublicProjects();
  return (
    <Explorer
      lang={lang}
      projects={projects}
      dict={{ explore: t.explore, statuses: t.statuses, problems: t.problems, sign: t.sign }}
    />
  );
}
