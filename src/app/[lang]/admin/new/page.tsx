import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AdminGate from "@/components/AdminGate";
import SuggestionForm from "@/components/SuggestionForm";
import { getDictionary } from "@/i18n/get-dictionary";
import { repo } from "@/lib/repo";

export const metadata: Metadata = { title: "Add a suggestion", robots: { index: false, follow: false } };

export default function NewSuggestionPage({ params, searchParams }: PageProps<"/[lang]/admin/new">) {
  return (
    <main dir="ltr" lang="en" className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-6">
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
  params: PageProps<"/[lang]/admin/new">["params"];
  searchParams: PageProps<"/[lang]/admin/new">["searchParams"];
}) {
  const { lang } = await params;
  const from = (await searchParams).from;
  const signal = typeof from === "string" ? await repo.getSignal(from) : null;
  // Admin is English; field labels for places come from both dictionaries.
  const en = getDictionary("en");
  return (
    <AdminGate>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Add a suggestion</h1>
        <Link href={`/${lang}/admin`} className="underline">Back to queue</Link>
      </div>
      <p className="mb-5 text-muted">
        Curated suggestions open for signatures straight away and are labelled
        &ldquo;Suggested by Majal&rdquo;. Write the title and description in the language residents of the area read.
      </p>
      {signal && (
        <div className="mb-5 rounded-xl border border-line bg-surface p-3 text-sm">
          From a signal ({signal.sourceName}). Check the details and place the pin on the exact spot.
          {signal.url && (
            <>
              {" "}
              <a href={signal.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">Open source</a>
            </>
          )}
        </div>
      )}
      <SuggestionForm
        lang={lang}
        t={{ themes: en.themes, fixes: en.fixes, location: en.report.location }}
        initial={
          signal
            ? {
                signalId: signal.id,
                theme: signal.theme ?? undefined,
                area: signal.area ?? "",
                title: signal.summaryAr.split(/[.!؟?]/)[0].slice(0, 110),
                description: signal.summaryAr,
                search: [signal.locationHint, signal.area].filter(Boolean).join(" "),
              }
            : undefined
        }
      />
    </AdminGate>
  );
}
