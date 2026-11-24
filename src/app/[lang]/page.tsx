import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LangToggle from "@/components/LangToggle";
import { hasLocale, type Locale } from "@/i18n/config";
import { fmt } from "@/i18n/fmt";
import { THEME_KEYS } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { getDictionary } from "@/i18n/get-dictionary";
import Wordmark from "@/components/Wordmark";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-5">
      <header className="flex items-center justify-between">
        <Wordmark size="lg" />
        <LangToggle lang={lang} label={t.switchLang} />
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-12">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          {t.home.headline}
        </h1>
        <p className="text-lg text-muted">{t.home.sub}</p>
        <Link
          href={`/${lang}/report`}
          className="grid min-h-14 place-items-center rounded-full bg-accent px-8 text-lg font-semibold text-accent-ink sm:self-start"
        >
          {t.home.cta}
        </Link>
        <Link
          href={`/${lang}/explore`}
          className="grid min-h-14 place-items-center rounded-full border border-line bg-surface px-8 text-lg font-medium sm:self-start"
        >
          {t.explore.nav}
        </Link>
      </section>

      <Suspense fallback={null}>
        <Collections lang={lang} />
      </Suspense>

      <p className="mt-10 text-sm text-muted">{t.home.note}</p>
    </main>
  );
}

/** Curated collections with places open for signatures ("Start here"). */
async function Collections({ lang }: { lang: Locale }) {
  await connection(); // counts change; never bake them in at build time
  const t = getDictionary(lang);
  const projects = await repo.listPublicProjects();
  const counts = THEME_KEYS.map((k) => ({
    key: k,
    n: projects.filter((p) => p.theme === k).length,
  })).filter((c) => c.n > 0);
  if (counts.length === 0) return null;

  return (
    <section aria-labelledby="start-here" className="grid gap-3">
      <h2 id="start-here" className="text-2xl font-bold">
        {t.curated.homeTitle}
      </h2>
      <p className="text-muted">{t.curated.homeSub}</p>
      <ul className="grid gap-3">
        {counts.map(({ key, n }) => (
          <li key={key}>
            <Link
              href={`/${lang}/explore?theme=${key}`}
              className="grid gap-1 rounded-2xl border border-line bg-surface p-4 hover:border-foreground"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{t.themes[key].label}</span>
                <span className="shrink-0 text-sm text-muted">
                  {n === 1 ? t.curated.onePlace : fmt(t.curated.places, { n })}
                </span>
              </span>
              <span className="text-sm text-muted">{t.themes[key].hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
