import Link from "next/link";
import { notFound } from "next/navigation";
import LangToggle from "@/components/LangToggle";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-5">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">{t.brand}</span>
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
      </section>

      <p className="text-sm text-muted">{t.home.note}</p>
    </main>
  );
}
