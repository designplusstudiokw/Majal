"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import {
  DEFAULT_CENTER,
  KUWAIT_BOUNDS,
  PROBLEM_KEYS,
  PUBLIC_STATUSES,
  SIGNATURE_TARGET,
  STATUS_COLORS,
  type ProblemKey,
  type ProjectSummary,
  type PublicStatus,
} from "@/lib/domain";
import { mapStyle } from "@/lib/map-style";
import { loadMapLibre } from "@/lib/maplibre";
import { fmt } from "@/i18n/fmt";
import { signatureCountText } from "@/i18n/signature-count";
import type { Dictionary } from "@/i18n/get-dictionary";

type Props = {
  lang: string;
  projects: ProjectSummary[];
  dict: Pick<Dictionary, "explore" | "statuses" | "problems" | "sign">;
};

const chip = (on: boolean) =>
  `min-h-10 shrink-0 rounded-full border px-4 text-sm ${
    on ? "border-foreground bg-foreground font-semibold text-background" : "border-line bg-surface"
  }`;

export default function Explorer({ lang, projects, dict }: Props) {
  const t = dict.explore;
  const [status, setStatus] = useState<PublicStatus | "all">("all");
  const [problem, setProblem] = useState<ProblemKey | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);

  const mapBox = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const cards = useRef(new Map<string, HTMLElement>());

  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (problem === "all" || p.problem === problem),
      ),
    [projects, status, problem],
  );
  const visibleCodes = useMemo(() => new Set(visible.map((p) => p.code)), [visible]);
  const selectedProject = visible.find((p) => p.code === selected) ?? null;

  // Create the map and one marker per project, once.
  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    const markerStore = markers.current;

    (async () => {
      const maplibre = await loadMapLibre();
      if (cancelled || !mapBox.current) return;
      instance = new maplibre.Map({
        container: mapBox.current,
        style: mapStyle(),
        center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: 12,
        minZoom: 8,
        maxZoom: 19,
        maxBounds: [
          [KUWAIT_BOUNDS.west, KUWAIT_BOUNDS.south],
          [KUWAIT_BOUNDS.east, KUWAIT_BOUNDS.north],
        ],
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      instance.touchZoomRotate.disableRotation();
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      // Top corner: the preview card occupies the bottom of the map.
      instance.addControl(new maplibre.AttributionControl({ compact: true }), "top-left");

      for (const p of projects) {
        // A real <button>: reachable by keyboard and announced by screen readers.
        const el = document.createElement("button");
        el.type = "button";
        el.className = "explorer-marker";
        el.style.setProperty("--marker", STATUS_COLORS[p.status as PublicStatus] ?? "#555");
        el.setAttribute("aria-label", `${p.code}: ${p.title}`);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelected(p.code);
        });
        const marker = new maplibre.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .addTo(instance);
        markerStore.set(p.code, { marker, el });
      }
      instance.on("click", () => setSelected(null));

      if (projects.length > 1) {
        const bounds = new maplibre.LngLatBounds();
        projects.forEach((p) => bounds.extend([p.lng, p.lat]));
        instance.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      } else if (projects.length === 1) {
        instance.jumpTo({ center: [projects[0].lng, projects[0].lat], zoom: 15 });
      }
      map.current = instance;
    })();

    return () => {
      cancelled = true;
      markerStore.forEach(({ marker }) => marker.remove());
      markerStore.clear();
      instance?.remove();
      map.current = null;
    };
  }, [projects]);

  // Filters and selection drive marker visibility and emphasis.
  useEffect(() => {
    markers.current.forEach(({ el }, code) => {
      el.hidden = !visibleCodes.has(code);
      el.dataset.selected = String(code === selected);
    });
  }, [visibleCodes, selected]);

  // Keep the selected marker visible above the preview card.
  useEffect(() => {
    const p = projects.find((x) => x.code === selected);
    const m = map.current;
    if (!p || !m) return;
    const box = m.getContainer().getBoundingClientRect();
    const wide = window.matchMedia("(min-width: 768px)").matches;
    // Phones: card spans the bottom, so aim higher. Desktop: card sits at the end side.
    m.easeTo({ center: [p.lng, p.lat], offset: wide ? [0, 0] : [0, -box.height * 0.22], duration: 400 });
  }, [selected, projects]);

  // Keep the selected card in view in the side list (desktop only: on phones
  // the list is part of the page and jumping the page would hide the map).
  useEffect(() => {
    if (!selected || !window.matchMedia("(min-width: 768px)").matches) return;
    cards.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  function showOnMap(p: ProjectSummary) {
    setSelected(p.code); // the effect above centres the marker
    if (map.current && map.current.getZoom() < 15) map.current.setZoom(15);
    mapBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const filtersActive = status !== "all" || problem !== "all";

  return (
    <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(320px,400px)_1fr] md:gap-0">
      {/* List + filters (start side on desktop, below the map on phones) */}
      <section aria-label={t.list} className="order-2 grid content-start gap-3 md:order-1 md:min-h-0 md:overflow-y-auto md:border-e md:border-line md:p-4">
        <div className="grid gap-3 md:sticky md:-top-4 md:z-10 md:-mx-4 md:-mt-4 md:bg-background md:px-4 md:pb-3 md:pt-4">
          <div role="group" aria-label={t.status} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <button type="button" aria-pressed={status === "all"} className={chip(status === "all")} onClick={() => setStatus("all")}>
              {t.all}
            </button>
            {PUBLIC_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                className={`${chip(status === s)} inline-flex items-center gap-2`}
                onClick={() => setStatus(s)}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                {dict.statuses[s]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="problem-filter" className="sr-only">
              {t.category}
            </label>
            <select
              id="problem-filter"
              value={problem}
              onChange={(e) => setProblem(e.target.value as ProblemKey | "all")}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3"
            >
              <option value="all">{t.allCategories}</option>
              {PROBLEM_KEYS.map((k) => (
                <option key={k} value={k}>
                  {dict.problems[k].label}
                </option>
              ))}
            </select>
            <p className="shrink-0 text-sm text-muted" aria-live="polite">
              {visible.length === 1 ? t.countOne : fmt(t.count, { n: visible.length })}
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-muted">{t.empty}</p>
        ) : visible.length === 0 ? (
          <div className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
            <p className="text-muted">{t.noMatch}</p>
            {filtersActive && (
              <button
                type="button"
                className="min-h-11 justify-self-start underline"
                onClick={() => {
                  setStatus("all");
                  setProblem("all");
                }}
              >
                {t.clear}
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3">
            {visible.map((p) => {
              const isSel = p.code === selected;
              const pct = Math.min(100, Math.round((p.signatures / SIGNATURE_TARGET) * 100));
              return (
                <li
                  key={p.code}
                  ref={(el) => {
                    if (el) cards.current.set(p.code, el);
                    else cards.current.delete(p.code);
                  }}
                  className={`grid gap-2 rounded-2xl border bg-surface p-4 ${isSel ? "border-foreground ring-2 ring-foreground/20" : "border-line"}`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span aria-hidden className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[p.status as PublicStatus] }} />
                      {dict.statuses[p.status]}
                    </span>
                    <span dir="ltr" className="font-medium text-muted">{p.code}</span>
                  </div>
                  <Link href={`/${lang}/p/${p.code}`} className="text-lg font-semibold leading-snug hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-sm text-muted">{dict.problems[p.problem].label}</p>
                  <div>
                    <p className="text-sm">{signatureCountText(dict.sign, p.signatures, SIGNATURE_TARGET)}</p>
                    <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => showOnMap(p)} className="min-h-11 justify-self-start text-sm underline">
                    {t.showOnMap}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Map */}
      <section aria-label={t.map} className="relative order-1 h-[48dvh] overflow-hidden rounded-2xl border border-line md:order-2 md:h-auto md:rounded-none md:border-0">
        <div ref={mapBox} className="absolute inset-0" />
        {selectedProject && (
          <div className="absolute inset-x-3 bottom-3 z-10 grid gap-1 rounded-2xl bg-surface p-4 shadow-lg md:inset-x-auto md:end-4 md:w-80">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted">{dict.statuses[selectedProject.status]}</p>
              <button
                type="button"
                aria-label={t.close}
                onClick={() => setSelected(null)}
                className="-me-2 -mt-2 grid size-10 place-items-center rounded-full text-xl"
              >
                ×
              </button>
            </div>
            <p className="font-semibold leading-snug">{selectedProject.title}</p>
            <p className="text-sm">{signatureCountText(dict.sign, selectedProject.signatures, SIGNATURE_TARGET)}</p>
            <Link
              href={`/${lang}/p/${selectedProject.code}`}
              className="mt-2 grid min-h-11 place-items-center rounded-full bg-accent px-4 font-semibold text-accent-ink"
            >
              {t.open}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
