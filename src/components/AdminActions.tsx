"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as { error?: string } };
}

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await post("/api/admin/login", { password });
        if (r.ok) router.refresh();
        else setError(r.data.error === "limit" ? "Too many attempts." : "Wrong password.");
      }}
    >
      <label htmlFor="pw" className="font-semibold">Admin password</label>
      <input
        id="pw"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-xl border border-line bg-surface px-4 py-3"
        autoComplete="current-password"
      />
      <button className="min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-ink">Sign in</button>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </form>
  );
}

export function ReviewButtons({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const r = await post(`/api/admin/projects/${code}`, { action });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.data.error ?? "failed");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={busy}
        onClick={() => act("approve")}
        className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={busy}
        onClick={() => act("reject")}
        className="min-h-11 rounded-full border border-line px-5 text-sm font-medium disabled:opacity-50"
      >
        Reject
      </button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </div>
  );
}
