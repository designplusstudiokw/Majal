import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LangToggle from "@/components/LangToggle";
import ShareButton from "@/components/ShareButton";
import SignPanel from "@/components/SignPanel";
import { SIGNATURE_TARGET, photoUrl } from "@/lib/domain";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { repo } from "@/lib/repo";
import { SESSION_COOKIE, readSession } from "@/lib/security";

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
        <Link href={`/${lang}`} className="text-xl font-bold">
          {t.brand}
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
