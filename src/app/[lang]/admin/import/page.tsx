import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AdminGate from "@/components/AdminGate";
import ImportPanel from "@/components/ImportPanel";

export const metadata: Metadata = { title: "Import suggestions", robots: { index: false, follow: false } };

export default function ImportPage({ params }: PageProps<"/[lang]/admin/import">) {
  return (
    <main dir="ltr" lang="en" className="mx-auto min-h-dvh w-full max-w-4xl px-5 py-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/[lang]/admin/import">["params"] }) {
  const { lang } = await params;
  return (
    <AdminGate>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Import suggestions</h1>
        <Link href={`/${lang}/admin`} className="underline">Back to queue</Link>
      </div>
      <ImportPanel lang={lang} />
    </AdminGate>
  );
}
