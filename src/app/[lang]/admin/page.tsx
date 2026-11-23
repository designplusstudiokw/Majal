import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AdminLogin, ReviewButtons } from "@/components/AdminActions";
import { SIGNATURE_TARGET } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { ADMIN_COOKIE, adminPassword, isAdminToken } from "@/lib/security";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Internal tool: English only, so it ignores the page language and stays left-to-right.
export default function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  return (
    <main dir="ltr" lang="en" className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Admin params={params} />
      </Suspense>
    </main>
  );
}

async function Admin({ params }: { params: PageProps<"/[lang]/admin">["params"] }) {
  const { lang } = await params;
  // Read the cookie first: it makes this render per request. Without it the
  // env check below would be evaluated at build time and frozen into the page.
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;

  if (!adminPassword()) {
    return <p className="py-10">Admin is disabled. Set ADMIN_PASSWORD to enable it.</p>;
  }
  if (!isAdminToken(token)) {
    return (
      <div className="mx-auto grid max-w-sm gap-4 py-16">
        <h1 className="text-2xl font-bold">Admin</h1>
        <AdminLogin />
      </div>
    );
  }

  const projects = await repo.listProjects(); // newest first
  const rows = await Promise.all(
    projects.map(async (p) => ({ p, signatures: await repo.countSignatures(p.code) })),
  );
  const pending = rows.filter((r) => r.p.status === "pending_review");
  const rest = rows.filter((r) => r.p.status !== "pending_review");

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-bold">Review queue</h1>

      <section className="grid gap-3">
        <h2 className="font-semibold">Waiting for review ({pending.length})</h2>
        {pending.length === 0 && <p className="text-muted">Nothing waiting.</p>}
        {pending.map(({ p }) => (
          <article key={p.code} className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
            <div>
              <Link href={`/${lang}/p/${p.code}`} className="font-semibold underline">
                {p.code}: {p.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {p.problem}
                {p.fix ? ` · idea: ${p.fix}` : ""} · {p.photos.length} photo(s) ·{" "}
                {new Date(p.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Kuwait" })}
              </p>
              <p className="mt-2 whitespace-pre-line">{p.description}</p>
            </div>
            <ReviewButtons code={p.code} />
          </article>
        ))}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">All other projects ({rest.length})</h2>
        {rest.map(({ p, signatures }) => (
          <Link
            key={p.code}
            href={`/${lang}/p/${p.code}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
          >
            <span>
              <span className="font-semibold">{p.code}</span> {p.title}
            </span>
            <span className="shrink-0 text-sm text-muted">
              {p.status.replaceAll("_", " ")} · {signatures}/{SIGNATURE_TARGET}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
