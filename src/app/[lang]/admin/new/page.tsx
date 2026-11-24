import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AdminGate from "@/components/AdminGate";
import SuggestionForm from "@/components/SuggestionForm";
import { getDictionary } from "@/i18n/get-dictionary";

export const metadata: Metadata = { title: "Add a suggestion", robots: { index: false, follow: false } };

export default function NewSuggestionPage({ params }: PageProps<"/[lang]/admin/new">) {
  return (
    <main dir="ltr" lang="en" className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/[lang]/admin/new">["params"] }) {
  const { lang } = await params;
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
      <SuggestionForm lang={lang} t={{ themes: en.themes, fixes: en.fixes, location: en.report.location }} />
    </AdminGate>
  );
}
