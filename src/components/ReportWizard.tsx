"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LocationPicker, { type LatLng } from "./LocationPicker";
import {
  DEFAULT_CENTER,
  FIX_KEYS,
  MAX_PHOTOS,
  PROBLEM_KEYS,
  type FixKey,
  type ProblemKey,
} from "@/lib/domain";
import { downscaleImage } from "@/lib/downscale";
import { fmt } from "@/i18n/fmt";
import type { Dictionary } from "@/i18n/get-dictionary";
import Wordmark from "@/components/Wordmark";

type Photo = { id: string; blob: Blob; preview: string };
type Props = { lang: string; dict: Dictionary };

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base placeholder:text-muted/70";
const primaryBtn =
  "min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-50";
const ghostBtn =
  "min-h-12 rounded-full border border-line bg-surface px-6 font-medium";

export default function ReportWizard({ lang, dict }: Props) {
  const t = dict.report;
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState<LatLng>(DEFAULT_CENTER);
  const [problem, setProblem] = useState<ProblemKey | null>(null);
  const [fix, setFix] = useState<FixKey | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [triedDetails, setTriedDetails] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCode, setDoneCode] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const photosRef = useRef<Photo[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Release object URLs when leaving the page.
  useEffect(
    () => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)),
    [],
  );
  // Move focus to the new step's heading for screen-reader users.
  useEffect(() => {
    heading.current?.focus();
  }, [step, doneCode]);

  const titleOk = title.trim().length >= 5;
  const descOk = description.trim().length >= 10;

  function next() {
    if (step === 1 && !problem) return;
    if (step === 2) {
      setTriedDetails(true);
      if (!titleOk || !descOk) return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const blob = await downscaleImage(file);
        setPhotos((p) => [
          ...p,
          { id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) },
        ]);
      } catch {
        setPhotoError(t.errors.photoType);
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos((list) => {
      const gone = list.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.id !== id);
    });
  }

  async function submit(formEl: HTMLFormElement) {
    if (!problem) return;
    setSending(true);
    setError(null);
    const body = new FormData(formEl); // carries the hidden honeypot field
    body.set("lat", String(pin.lat));
    body.set("lng", String(pin.lng));
    body.set("problem", problem);
    if (fix) body.set("fix", fix);
    body.set("title", title.trim());
    body.set("description", description.trim());
    photos.forEach((p, i) => body.append("photos", p.blob, `photo-${i}.jpg`));
    try {
      const res = await fetch("/api/reports", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "photo_too_large"
            ? t.errors.photoTooLarge
            : data.error === "photo_type"
              ? t.errors.photoType
              : data.fields?.lat || data.fields?.lng
                ? t.errors.outsideKuwait
                : t.errors.submit,
        );
        return;
      }
      const { code } = (await res.json()) as { code: string };
      setDoneCode(code);
    } catch {
      setError(t.errors.submit);
    } finally {
      setSending(false);
    }
  }

  // ---- Done -------------------------------------------------------------
  if (doneCode) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold outline-none">
          {t.done.heading}
        </h1>
        <p className="text-muted">{t.done.body}</p>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t.done.codeLabel}</p>
          <p dir="ltr" className="text-start text-4xl font-bold tracking-wide">
            {doneCode}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/${lang}/p/${doneCode}`} className={`${primaryBtn} grid place-items-center`}>
            {t.done.view}
          </Link>
          <button type="button" className={ghostBtn} onClick={() => location.reload()}>
            {t.done.another}
          </button>
        </div>
      </main>
    );
  }

  const stepTitle = [
    dict.report.location.heading,
    t.problem.heading,
    t.details.heading,
    t.review.heading,
  ][step];

  return (
    <form
      className="mx-auto flex h-dvh w-full max-w-xl flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 3) void submit(e.currentTarget);
      }}
      noValidate
    >
      <header className="px-4 pt-4">
        <div className="flex items-center justify-between text-sm text-muted">
          <Link href={`/${lang}`} aria-label={dict.brand}>
            <Wordmark />
          </Link>
          <span>{fmt(t.stepOf, { n: step + 1, total: 4 })}</span>
        </div>
        <ol className="mt-3 flex gap-1.5" aria-hidden>
          {t.steps.map((label, i) => (
            <li
              key={label}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </ol>
        <h1 ref={heading} tabIndex={-1} className="mt-4 text-2xl font-bold outline-none">
          {stepTitle}
        </h1>
        {step === 0 && <p className="mt-1 text-muted">{t.location.hint}</p>}
        {step === 1 && <p className="mt-1 text-muted">{t.problem.hint}</p>}
      </header>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* The map stays mounted so the chosen spot survives back/forward. */}
        <div className={step === 0 ? "h-full" : "hidden"}>
          <LocationPicker lang={lang} value={pin} onChange={setPin} t={t.location} />
        </div>

        {step === 1 && (
          <fieldset className="grid gap-2.5">
            <legend className="sr-only">{t.problem.heading}</legend>
            {PROBLEM_KEYS.map((key) => (
              <label
                key={key}
                className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-4 py-3 ${
                  problem === key ? "border-accent bg-accent/10" : "border-line bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="problem"
                  value={key}
                  checked={problem === key}
                  onChange={() => setProblem(key)}
                  className="sr-only"
                />
                <span className="font-semibold">{dict.problems[key].label}</span>
                <span className="text-sm text-muted">{dict.problems[key].hint}</span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <div>
              <label htmlFor="title" className="mb-1.5 block font-semibold">
                {t.details.titleLabel}
              </label>
              <input
                id="title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.details.titlePlaceholder}
                aria-invalid={triedDetails && !titleOk}
                aria-describedby={triedDetails && !titleOk ? "title-err" : undefined}
                className={field}
              />
              {triedDetails && !titleOk && (
                <p id="title-err" className="mt-1 text-sm text-danger">
                  {t.errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="desc" className="mb-1.5 block font-semibold">
                {t.details.descLabel}
              </label>
              <textarea
                id="desc"
                rows={5}
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.details.descPlaceholder}
                aria-invalid={triedDetails && !descOk}
                aria-describedby={triedDetails && !descOk ? "desc-err" : undefined}
                className={field}
              />
              {triedDetails && !descOk && (
                <p id="desc-err" className="mt-1 text-sm text-danger">
                  {t.errors.description}
                </p>
              )}
            </div>

            <div>
              <p className="font-semibold">{t.details.photosLabel}</p>
              <p className="mb-2 text-sm text-muted">
                {fmt(t.details.photosHint, { n: MAX_PHOTOS })}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {photos.map((p) => (
                  <div key={p.id} className="relative size-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.preview}
                      alt=""
                      className="size-24 rounded-xl border border-line object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      aria-label={t.details.removePhoto}
                      className="absolute -end-2 -top-2 grid size-8 place-items-center rounded-full bg-foreground text-background"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="grid size-24 cursor-pointer place-items-center rounded-xl border border-dashed border-muted px-2 text-center text-sm text-muted">
                    {t.details.addPhoto}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        void addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              {photoError && <p className="mt-2 text-sm text-danger">{photoError}</p>}
            </div>

            <fieldset>
              <legend className="font-semibold">{t.details.fixLabel}</legend>
              <p className="mb-2 text-sm text-muted">{t.details.fixHint}</p>
              <div className="flex flex-wrap gap-2">
                {[null, ...FIX_KEYS].map((key) => {
                  const selected = fix === key;
                  return (
                    <label
                      key={key ?? "none"}
                      className={`min-h-11 cursor-pointer rounded-full border px-4 py-2.5 text-sm ${
                        selected ? "border-accent bg-accent/10 font-semibold" : "border-line bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fix-choice"
                        checked={selected}
                        onChange={() => setFix(key)}
                        className="sr-only"
                      />
                      {key ? dict.fixes[key] : t.details.fixNone}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && problem && (
          <div className="grid gap-4">
            <dl className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
              <div>
                <dt className="text-sm text-muted">{t.review.problem}</dt>
                <dd className="font-semibold">{dict.problems[problem].label}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{title.trim()}</dt>
                <dd className="whitespace-pre-line">{description.trim()}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.review.fix}</dt>
                <dd>{fix ? dict.fixes[fix] : t.review.noFix}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.review.location}</dt>
                <dd dir="ltr" className="text-start">
                  {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                </dd>
              </div>
              {photos.length > 0 && (
                <div>
                  <dt className="mb-2 text-sm text-muted">{t.review.photos}</dt>
                  <dd className="flex flex-wrap gap-2">
                    {photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={p.preview} alt="" className="size-16 rounded-lg object-cover" />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            <p className="text-sm text-muted">{t.review.moderationNote}</p>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="flex gap-3 border-t border-line bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {step > 0 && (
          <button type="button" className={ghostBtn} onClick={() => setStep(step - 1)}>
            {t.back}
          </button>
        )}
        {step < 3 ? (
          <button
            key="next"
            type="button"
            className={`${primaryBtn} flex-1`}
            onClick={next}
            disabled={step === 1 && !problem}
          >
            {t.next}
          </button>
        ) : (
          // Distinct key: otherwise React reuses the "next" button element and
          // the click that moved to this step also submits the form.
          <button key="submit" type="submit" className={`${primaryBtn} flex-1`} disabled={sending}>
            {sending ? t.submitting : t.submit}
          </button>
        )}
      </footer>
    </form>
  );
}
