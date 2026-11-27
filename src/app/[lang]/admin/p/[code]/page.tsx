import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AdminGate from "@/components/AdminGate";
import ProjectEditor from "@/components/ProjectEditor";
import { getDictionary } from "@/i18n/get-dictionary";
import { repo } from "@/lib/repo";

export const metadata: Metadata = { title: "Moderate project", robots: { index: false, follow: false } };

export default function ModerateProjectPage({ params }: PageProps<"/[lang]/admin/p/[code]">) {
  return (
    <main dir="ltr" lang="en" className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/[lang]/admin/p/[code]">["params"] }) {
  const { lang, code } = await params;
  return (
    <AdminGate>
      <Editor lang={lang} code={code} />
    </AdminGate>
  );
}

async function Editor({ lang, code }: { lang: string; code: string }) {
  const [project, history, signatures] = await Promise.all([
    repo.getProjectByCode(code),
    repo.listModeration(code, 50),
    repo.countSignatures(code),
  ]);
  if (!project) {
    return (
      <p className="py-10">
        No project {code}. <Link href={`/${lang}/admin`} className="underline">Back to queue</Link>
      </p>
    );
  }
  const en = getDictionary("en");
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {project.code} <span className="text-base font-normal text-muted">· {signatures} signatures · {project.source}</span>
        </h1>
        <div className="flex gap-4">
          <Link href={`/${lang}/p/${project.code}`} className="underline">Public page</Link>
          <Link href={`/${lang}/admin`} className="underline">Back to queue</Link>
        </div>
      </div>
      <ProjectEditor
        lang={lang}
        project={project}
        t={{ problems: en.problems, fixes: en.fixes, themes: en.themes, statuses: en.statuses, location: en.report.location }}
      />
      <section className="grid gap-2">
        <h2 className="font-semibold">History</h2>
        {history.length === 0 && <p className="text-sm text-muted">No moderation actions yet.</p>}
        <ul className="grid gap-1 text-sm">
          {history.map((e, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface px-3 py-2">
              <span className="text-muted">{new Date(e.at).toLocaleString("en-GB", { timeZone: "Asia/Kuwait" })}</span>{" "}
              <strong>{e.actor}</strong> {e.action.replace("_", " ")}{" "}
              <span dir="auto" className="text-muted">{describe(e.details)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function describe(details: Record<string, unknown>) {
  const short = (v: unknown) => String(v).slice(0, 40);
  if ("from" in details && "to" in details) return `${short(details.from)} → ${short(details.to)}`;
  return Object.entries(details)
    .map(([k, v]) => {
      const change = v as { from?: unknown; to?: unknown } | null;
      return change && typeof change === "object" && "to" in change
        ? `${k}: ${short(change.from)} → ${short(change.to)}`
        : `${k}: ${short(v)}`;
    })
    .join("; ");
}
