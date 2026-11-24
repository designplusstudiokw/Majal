"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const btn = "min-h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium disabled:opacity-50";

export function ScanNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("Scanning. This takes a minute or two…");
          const r = await post("/api/admin/signals/scan", {});
          setBusy(false);
          if (!r.ok) return setMsg(`Failed (${String(r.data.error ?? "error")}).`);
          if (r.data.busy) return setMsg("A scan is already running.");
          const errs = (r.data.errors as string[]) ?? [];
          setMsg(`Scanned ${(r.data.languages as string[]).join(", ")}: ${r.data.added} new.${errs.length ? ` Errors: ${errs.join("; ")}` : ""}`);
          router.refresh();
        }}
      >
        {busy ? "Scanning…" : "Scan now"}
      </button>
      {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
    </div>
  );
}

export function Intake() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const r = await post("/api/admin/signals/intake", { url, text });
        setBusy(false);
        if (!r.ok) {
          const e = String(r.data.error);
          return setMsg(e === "bad_url" ? "That link is not valid." : e === "empty" ? "Add a link or some text." : "Could not read it. Paste the text instead.");
        }
        if (!r.data.found) return setMsg("Nothing that qualifies as a public-realm complaint in Kuwait. If the link is an Instagram or X post, paste its text.");
        setMsg(r.data.added ? "Added to the inbox." : "Already in the inbox.");
        setUrl("");
        setText("");
        router.refresh();
      }}
    >
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Link</span>
        <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="rounded-xl border border-line bg-surface px-3 py-2" />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Or the text (any language)</span>
        <textarea dir="auto" rows={3} value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2" />
      </label>
      <button className={`${btn} justify-self-start`} disabled={busy || (!url.trim() && !text.trim())}>
        {busy ? "Reading…" : "Read and add"}
      </button>
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
    </form>
  );
}

export function SignalButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (action: "dismiss" | "reopen") => {
    setBusy(true);
    await post(`/api/admin/signals/${id}`, { action });
    setBusy(false);
    router.refresh();
  };
  return status === "new" ? (
    <button className={btn} disabled={busy} onClick={() => act("dismiss")}>Dismiss</button>
  ) : status === "dismissed" ? (
    <button className={btn} disabled={busy} onClick={() => act("reopen")}>Reopen</button>
  ) : null;
}
