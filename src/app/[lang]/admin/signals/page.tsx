import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AdminGate from "@/components/AdminGate";
import { Intake, ScanNow, SignalButtons } from "@/components/SignalActions";
import { getDictionary } from "@/i18n/get-dictionary";
import { SIGNAL_LANGUAGES, SIGNAL_STATUSES, type SignalStatus } from "@/lib/domain";
import { repo } from "@/lib/repo";

export const metadata: Metadata = { title: "Signals", robots: { index: false, follow: false } };

export default function SignalsPage({ params, searchParams }: PageProps<"/[lang]/admin/signals">) {
  return (
    <main dir="ltr" lang="en" className="mx-auto min-h-dvh w-full max-w-4xl px-5 py-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/admin/signals">["params"];
  searchParams: PageProps<"/[lang]/admin/signals">["searchParams"];
}) {
  const { lang } = await params;
  const s = (await searchParams).status;
  const status: SignalStatus = SIGNAL_STATUSES.find((x) => x === s) ?? "new";
  return (
    <AdminGate>
      <Inbox lang={lang} status={status} />
    </AdminGate>
  );
}

const langName = (code: string) => SIGNAL_LANGUAGES[code as keyof typeof SIGNAL_LANGUAGES] ?? code;

async function Inbox({ lang, status }: { lang: string; status: SignalStatus }) {
  const en = getDictionary("en");
  const [signals, scan, all] = await Promise.all([
    repo.listSignals(status),
    repo.getScanState(),
    repo.listSignals(),
  ]);
  const counts = Object.fromEntries(SIGNAL_STATUSES.map((k) => [k, all.filter((x) => x.status === k).length]));
  const last = scan.runs[0];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Signals</h1>
        <Link href={`/${lang}/admin`} className="underline">Back to queue</Link>
      </div>
      <p className="text-muted">
        Complaints found online about public places in Kuwait, in {Object.values(SIGNAL_LANGUAGES).join(", ")}.
        Review each one: dismiss it, or turn it into a suggestion people can sign.
      </p>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <ScanNow />
        {last ? (
          <p className="text-sm text-muted">
            Last scan {new Date(last.at).toLocaleString("en-GB", { timeZone: "Asia/Kuwait" })} ({last.languages.map(langName).join(", ")}):{" "}
            {last.found} found, {last.added} new, {last.searches} searches, {Math.round((last.inputTokens + last.outputTokens) / 1000)}k tokens.
            {last.errors.length > 0 && <span className="text-danger"> Errors: {last.errors.join("; ")}</span>}
          </p>
        ) : (
          <p className="text-sm text-muted">No scans yet.</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Add a link or post someone shared</summary>
          <div className="mt-3">
            <Intake />
          </div>
        </details>
      </section>

      <nav className="flex gap-2" aria-label="Filter by status">
        {SIGNAL_STATUSES.map((k) => (
          <Link
            key={k}
            href={`/${lang}/admin/signals?status=${k}`}
            aria-current={k === status ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${k === status ? "border-foreground bg-foreground text-background" : "border-line bg-surface"}`}
          >
            {k} ({counts[k]})
          </Link>
        ))}
      </nav>

      {signals.length === 0 && <p className="text-muted">Nothing here.</p>}
      <ul className="grid gap-3">
        {signals.map((sig) => (
          <li key={sig.id} className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-medium text-foreground">{sig.sourceName}</span>
              <span>{langName(sig.language)}</span>
              {sig.published && <span>{sig.published}</span>}
              <span>{sig.confidence} confidence</span>
              <span>{sig.via === "intake" ? "added by hand" : "scan"}</span>
            </div>
            <p dir="rtl" lang="ar" className="text-lg">{sig.summaryAr}</p>
            <p>{sig.summaryEn}</p>
            {sig.excerpt && (
              <blockquote dir="auto" className="border-s-4 border-line ps-3 text-sm text-muted">
                {sig.excerpt}
              </blockquote>
            )}
            <p className="text-sm">
              {en.problems[sig.problem].label}
              {sig.theme && ` · ${en.themes[sig.theme].label}`}
              {sig.area && <> · <span dir="rtl">{sig.area}</span></>}
              {sig.locationHint && <> · <span dir="auto">{sig.locationHint}</span></>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {sig.url && (
                <a href={sig.url} target="_blank" rel="noopener noreferrer nofollow" className="min-h-10 content-center px-1 text-sm underline">
                  Open source
                </a>
              )}
              {sig.status === "new" && (
                <Link
                  href={`/${lang}/admin/new?from=${sig.id}`}
                  className="min-h-10 content-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
                >
                  Make a suggestion
                </Link>
              )}
              {sig.status === "converted" && sig.projectCode && (
                <Link href={`/${lang}/p/${sig.projectCode}`} className="text-sm underline">
                  Became {sig.projectCode}
                </Link>
              )}
              <SignalButtons id={sig.id} status={sig.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
