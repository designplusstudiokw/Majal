import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LangToggle from "@/components/LangToggle";
import ShareButton from "@/components/ShareButton";
import SignPanel from "@/components/SignPanel";
import { SIGNATURE_TARGET, isPublicStatus, photoUrl } from "@/lib/domain";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { repo } from "@/lib/repo";
import { SESSION_COOKIE, readSession } from "@/lib/security";
import { SITE_NAME, ogLocale } from "@/lib/site";
import Wordmark from "@/components/Wordmark";

/** What WhatsApp, iMessage, X and others show when the link is shared.
 *  The image comes from opengraph-image.tsx next to this file. */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/p/[code]">): Promise<Metadata> {
  const { lang, code } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  const project = await repo.getProjectByCode(code);
  if (!project) return { title: t.project.notFound, robots: { index: false } };

  const description = clipText(project.description, 180);
  const path = `/${lang}/p/${project.code}`;
  return {
    title: project.title,
    description,
    alternates: {
      canonical: path,
      languages: { ar: `/ar/p/${project.code}`, en: `/en/p/${project.code}` },
    },
    // Reports not yet approved (or rejected) stay out of search engines.
    robots: isPublicStatus(project.status) ? undefined : { index: false, follow: false },
    // Nested objects replace the layout's, so repeat the shared fields.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: ogLocale(lang),
      url: path,
      title: project.title,
      description,
    },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

function clipText(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, t.lastIndexOf(" ", max) > max * 0.6 ? t.lastIndexOf(" ", max) : max).trim()}…`;
}

export default function ProjectPage({ params }: PageProps<"/[lang]/p/[code]">) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 py-5">
      <Suspense fallback={<p className="py-20 text-center text-muted">…</p>}>
        <Project params={params} />
      </Suspense>
    </main>
  );
}

async function Project({ params }: { params: PageProps<"/[lang]/p/[code]">["params"] }) {
  const { lang, code } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const project = await repo.getProjectByCode(code);

  // Signing state is per visitor, so it is read here, inside the Suspense boundary.
  const phoneHash = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const signatures = project ? await repo.countSignatures(project.code) : 0;
  const alreadySigned =
    project && phoneHash ? await repo.hasSigned(project.code, phoneHash) : false;

  return (
    <>
      <header className="flex items-center justify-between">
        <Link href={`/${lang}`} aria-label={t.brand}>
          <Wordmark />
        </Link>
        <LangToggle lang={lang} label={t.switchLang} />
      </header>

      {!project ? (
        <div className="grid gap-4 py-20 text-center">
          <p className="text-xl">{t.project.notFound}</p>
          <Link href={`/${lang}`} className="underline">
            {t.project.backHome}
          </Link>
        </div>
      ) : (
        <article className="grid gap-6 py-8">
          <div>
            <p className="text-sm text-muted">
              {t.project.code}{" "}
              <span dir="ltr" className="font-semibold text-foreground">
                {project.code}
              </span>
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-snug">{project.title}</h1>
            <p className="mt-3 inline-block rounded-full bg-steel/15 px-3 py-1 text-sm font-medium text-steel">
              {t.statuses[project.status]}
            </p>
          </div>

          {project.source === "curated" && (
            <div className="rounded-2xl border border-steel/30 bg-steel/10 p-4">
              <p className="font-semibold text-steel">
                {t.curated.badge}
                {project.theme ? ` · ${t.themes[project.theme].label}` : ""}
                {project.area ? ` · ${project.area}` : ""}
              </p>
              <p className="mt-1">{t.curated.body}</p>
            </div>
          )}

          {project.status === "pending_review" && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-semibold">{t.project.pendingTitle}</p>
              <p className="mt-1 text-muted">{t.project.pendingBody}</p>
            </div>
          )}

          <p className="whitespace-pre-line text-lg">{project.description}</p>

          {project.status === "open_for_signatures" && (
            <SignPanel
              code={project.code}
              target={SIGNATURE_TARGET}
              initialCount={signatures}
              alreadySigned={alreadySigned}
              signedIn={Boolean(phoneHash)}
              t={t.sign}
            />
          )}

          {project.photos.length > 0 && (
            <section aria-label={t.project.photos} className="grid grid-cols-2 gap-2">
              {project.photos.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={photoUrl(id)}
                  alt=""
                  className="aspect-square w-full rounded-xl border border-line object-cover"
                />
              ))}
            </section>
          )}

          <dl className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
            <div>
              <dt className="text-sm text-muted">{t.problems[project.problem].label}</dt>
              <dd>{t.problems[project.problem].hint}</dd>
            </div>
            {project.fix && (
              <div>
                <dt className="text-sm text-muted">{t.project.fix}</dt>
                <dd>{t.fixes[project.fix]}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted">{t.project.location}</dt>
              <dd>
                <a
                  dir="ltr"
                  className="underline"
                  href={`https://www.google.com/maps?q=${project.lat},${project.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {project.lat.toFixed(5)}, {project.lng.toFixed(5)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t.project.reportedOn}</dt>
              <dd>{formatDate(project.createdAt, lang)}</dd>
            </div>
          </dl>

          <ShareButton
            code={project.code}
            label={t.project.share}
            copied={t.project.copied}
            text={t.project.shareText}
          />
        </article>
      )}
    </>
  );
}

function formatDate(iso: string, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Kuwait",
  }).format(new Date(iso));
}
