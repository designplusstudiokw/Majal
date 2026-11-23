"use client";

import { useEffect, useRef, useState } from "react";
import { OTP_LENGTH, normalizeKuwaitPhone } from "@/lib/domain";
import { fmt } from "@/i18n/fmt";
import type { Dictionary } from "@/i18n/get-dictionary";

type Props = {
  code: string;
  target: number;
  initialCount: number;
  alreadySigned: boolean;
  /** A valid session cookie exists, so no new code is needed. */
  signedIn: boolean;
  t: Dictionary["sign"];
};

type Stage = "idle" | "phone" | "code" | "signed";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-lg tracking-wide";
const primaryBtn =
  "min-h-12 w-full rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-50";

async function post(url: string, body: unknown = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export default function SignPanel({ code, target, initialCount, alreadySigned, signedIn, t }: Props) {
  const [count, setCount] = useState(initialCount);
  const [stage, setStage] = useState<Stage>(alreadySigned ? "signed" : "idle");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false); // signed just now, not earlier
  const focusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "phone" || stage === "code") focusRef.current?.focus();
  }, [stage]);

  const percent = Math.min(100, Math.round((count / target) * 100));
  const errText = (key?: unknown) => {
    const map = t.errors as Record<string, string>;
    return map[String(key)] ?? t.errors.generic;
  };

  async function sign() {
    const r = await post(`/api/projects/${code}/sign`);
    if (r.ok) {
      setCount(r.data.count as number);
      setFresh(!r.data.alreadySigned);
      setStage("signed");
      return;
    }
    if (r.data.error === "not_open") setError(t.notOpen);
    else if (r.status === 401) setStage("phone"); // session expired
    else setError(t.errors.generic);
  }

  async function start() {
    setError(null);
    if (!signedIn) return setStage("phone");
    setBusy(true);
    try {
      await sign();
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setError(null);
    if (!normalizeKuwaitPhone(phone)) return setError(t.errors.phone);
    setBusy(true);
    try {
      const r = await post("/api/otp/request", { phone });
      if (!r.ok) return setError(errText(r.data.error));
      setDevCode((r.data.devCode as string | undefined) ?? null);
      setOtp("");
      setStage("code");
    } catch {
      setError(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    if (otp.length !== OTP_LENGTH) return setError(t.errors.invalid);
    setBusy(true);
    try {
      const v = await post("/api/otp/verify", { phone, code: otp });
      if (!v.ok) return setError(errText(v.data.error));
      await sign();
    } catch {
      setError(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
      <div>
        <p className="font-semibold" aria-live="polite">
          {fmt(t.count, { n: count, target })}
        </p>
        <div
          role="progressbar"
          aria-label={t.countLabel}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(count, target)}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {stage === "idle" && (
        <button type="button" className={primaryBtn} onClick={start} disabled={busy}>
          {t.button}
        </button>
      )}

      {stage === "phone" && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <label htmlFor="phone" className="font-semibold">
            {t.phoneLabel}
          </label>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="rounded-xl border border-line bg-background px-3 py-3 text-lg text-muted">
              +965
            </span>
            <input
              id="phone"
              ref={focusRef}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-describedby="phone-hint"
              className={inputCls}
            />
          </div>
          <p id="phone-hint" className="text-sm text-muted">
            {t.phoneHint}
          </p>
          <button type="submit" className={primaryBtn} disabled={busy}>
            {busy ? t.sending : t.sendCode}
          </button>
        </form>
      )}

      {stage === "code" && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <label htmlFor="otp" className="font-semibold">
            {t.codeLabel}
          </label>
          <p className="text-sm text-muted">
            {/* U+2066/U+2069 isolate the number so Arabic text cannot reorder "+965 …". */}
            {fmt(t.codeSent, { phone: `\u2066+965 ${normalizeKuwaitPhone(phone)?.slice(4) ?? ""}\u2069` })}
          </p>
          <input
            id="otp"
            ref={focusRef}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className={`${inputCls} text-center text-2xl tracking-[0.4em]`}
          />
          {devCode && (
            <p className="rounded-lg bg-steel/15 px-3 py-2 text-sm">
              {fmt(t.devHint, { code: devCode })}
            </p>
          )}
          <button type="submit" className={primaryBtn} disabled={busy}>
            {busy ? t.confirming : t.confirm}
          </button>
          <div className="flex flex-wrap gap-4 text-sm">
            <button type="button" className="min-h-11 underline" onClick={() => { setError(null); setStage("phone"); }}>
              {t.changeNumber}
            </button>
            <button type="button" className="min-h-11 underline" onClick={() => void sendCode()} disabled={busy}>
              {t.resend}
            </button>
          </div>
        </form>
      )}

      {stage === "signed" && (
        <div role="status" className="grid gap-1">
          <p className="font-semibold">{fresh ? t.done : t.alreadySigned}</p>
          <p className="text-sm text-muted">{t.shareNudge}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
