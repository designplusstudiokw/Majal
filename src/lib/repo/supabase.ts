import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ModerationEvent, Project, ProjectSummary, ScanRun, Signal } from "@/lib/domain";
import type { NewPhoto, NewProject, OtpRequestResult, OtpVerifyResult, Repository } from "./types";

/**
 * Production store: Supabase (Postgres + Storage), reached over its HTTPS API
 * with the secret key from the server only. Row level security blocks the
 * public API; atomic steps live in database functions (see supabase/migrations).
 */

const BUCKET = "photos";
const EXT_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TYPE_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]));
const PHOTO_ID = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const PROJECT_COLUMNS =
  "id, code, status, problem, fix, title, description, lat, lng, photos, source, theme, area, created_at";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // supabase-js also copies the key into "Authorization: Bearer". New
      // sb_secret_ keys only need the apikey header, so drop the copy: one
      // fewer place the secret travels.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (!key.startsWith("eyJ") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        return fetch(input, { ...init, headers, cache: "no-store" });
      },
    },
  });
  return client;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data;
}

type ProjectRow = {
  id: string;
  code: string;
  status: Project["status"];
  problem: Project["problem"];
  fix: Project["fix"];
  title: string;
  description: string;
  lat: number;
  lng: number;
  photos: string[];
  source: Project["source"];
  theme: Project["theme"];
  area: string | null;
  created_at: string;
};

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  code: r.code,
  status: r.status,
  problem: r.problem,
  fix: r.fix ?? null,
  title: r.title,
  description: r.description,
  lat: r.lat,
  lng: r.lng,
  photos: r.photos ?? [],
  createdAt: r.created_at,
  source: r.source,
  theme: r.theme ?? null,
  area: r.area ?? null,
});

type SignalRow = {
  id: string;
  url_key: string;
  url: string;
  source_name: string;
  published: string | null;
  language: string;
  excerpt: string;
  summary_ar: string;
  summary_en: string;
  problem: Signal["problem"];
  theme: Signal["theme"];
  area: string | null;
  location_hint: string | null;
  confidence: Signal["confidence"];
  found_at: string;
  via: string;
  status: Signal["status"];
  project_code: string | null;
};

const toSignal = (r: SignalRow): Signal => ({
  id: r.id,
  urlKey: r.url_key,
  url: r.url,
  sourceName: r.source_name,
  published: r.published,
  language: r.language,
  excerpt: r.excerpt,
  summaryAr: r.summary_ar,
  summaryEn: r.summary_en,
  problem: r.problem,
  theme: r.theme ?? null,
  area: r.area,
  locationHint: r.location_hint,
  confidence: r.confidence,
  foundAt: r.found_at,
  via: r.via,
  status: r.status,
  projectCode: r.project_code,
});

const fromSignal = (s: Omit<Signal, "id">) => ({
  url_key: s.urlKey,
  url: s.url,
  source_name: s.sourceName,
  published: s.published,
  language: s.language,
  excerpt: s.excerpt,
  summary_ar: s.summaryAr,
  summary_en: s.summaryEn,
  problem: s.problem,
  theme: s.theme,
  area: s.area,
  location_hint: s.locationHint,
  confidence: s.confidence,
  found_at: s.foundAt,
  via: s.via,
  status: s.status,
  project_code: s.projectCode,
});

const toItem = (input: NewProject, photos: string[]) => ({
  problem: input.problem,
  fix: input.fix ?? null,
  title: input.title,
  description: input.description,
  lat: input.lat,
  lng: input.lng,
  photos,
  status: input.status ?? "pending_review",
  source: input.source ?? "resident",
  theme: input.theme ?? null,
  area: input.area ?? null,
});

export const supabaseRepository: Repository = {
  async createProject(input: NewProject, photos: NewPhoto[]) {
    const ids: string[] = [];
    try {
      for (const photo of photos) {
        const id = `${randomBytes(16).toString("hex")}.${EXT_BY_TYPE[photo.contentType]}`;
        check(await db().storage.from(BUCKET).upload(id, photo.bytes, { contentType: photo.contentType }));
        ids.push(id);
      }
      const rows = check(await db().rpc("create_projects", { items: [toItem(input, ids)] })) as ProjectRow[];
      return toProject(rows[0]);
    } catch (e) {
      // Don't leave orphaned photos behind if the project was not created.
      if (ids.length) await db().storage.from(BUCKET).remove(ids);
      throw e;
    }
  },

  async createProjects(inputs: NewProject[]) {
    const rows = check(await db().rpc("create_projects", { items: inputs.map((i) => toItem(i, [])) })) as ProjectRow[];
    return rows.map(toProject);
  },

  async getProjectByCode(code) {
    const row = check(
      await db().from("projects").select(PROJECT_COLUMNS).eq("code", code.toUpperCase()).maybeSingle(),
    ) as ProjectRow | null;
    return row ? toProject(row) : null;
  },

  async listProjects() {
    const rows = check(
      await db().from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }),
    ) as ProjectRow[];
    return rows.map(toProject);
  },

  async listPublicProjects(): Promise<ProjectSummary[]> {
    const rows = check(await db().rpc("list_public_projects")) as { project: ProjectRow; signatures: number }[];
    return rows.map((r) => ({ ...toProject(r.project), signatures: Number(r.signatures) }));
  },

  async setProjectStatus(code, status) {
    const row = check(
      await db().from("projects").update({ status }).eq("code", code.toUpperCase()).select(PROJECT_COLUMNS).maybeSingle(),
    ) as ProjectRow | null;
    return row ? toProject(row) : null;
  },

  async updateProject(code, edit) {
    const patch = Object.fromEntries(Object.entries(edit).filter(([, v]) => v !== undefined));
    if (!Object.keys(patch).length) return supabaseRepository.getProjectByCode(code);
    const row = check(
      await db().from("projects").update(patch).eq("code", code.toUpperCase()).select(PROJECT_COLUMNS).maybeSingle(),
    ) as ProjectRow | null;
    return row ? toProject(row) : null;
  },

  async removePhoto(code, photoId) {
    const project = await supabaseRepository.getProjectByCode(code);
    if (!project || !project.photos.includes(photoId)) return null;
    const row = check(
      await db()
        .from("projects")
        .update({ photos: project.photos.filter((id) => id !== photoId) })
        .eq("code", project.code)
        .select(PROJECT_COLUMNS)
        .maybeSingle(),
    ) as ProjectRow | null;
    if (PHOTO_ID.test(photoId)) await db().storage.from(BUCKET).remove([photoId]);
    return row ? toProject(row) : null;
  },

  async logModeration(event) {
    check(
      await db().from("moderation_events").insert({
        actor: event.actor,
        action: event.action,
        project_code: event.projectCode,
        details: event.details,
      }),
    );
  },

  async listModeration(projectCode, limit = 100) {
    let q = db().from("moderation_events").select("at, actor, action, project_code, details").order("at", { ascending: false }).limit(limit);
    if (projectCode) q = q.eq("project_code", projectCode.toUpperCase());
    const rows = check(await q) as { at: string; actor: string; action: string; project_code: string | null; details: Record<string, unknown> }[];
    return rows.map((r): ModerationEvent => ({ at: r.at, actor: r.actor, action: r.action, projectCode: r.project_code, details: r.details }));
  },

  async readPhoto(id) {
    if (!PHOTO_ID.test(id)) return null;
    const { data, error } = await db().storage.from(BUCKET).download(id);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: TYPE_BY_EXT[id.split(".")[1]] };
  },

  async addSignature(code, phoneHash) {
    const rows = check(
      await db()
        .from("signatures")
        .upsert({ project_code: code.toUpperCase(), phone_hash: phoneHash }, { ignoreDuplicates: true })
        .select("project_code"),
    ) as unknown[];
    return { created: rows.length > 0 };
  },

  async hasSigned(code, phoneHash) {
    const { count, error } = await db()
      .from("signatures")
      .select("project_code", { count: "exact", head: true })
      .eq("project_code", code.toUpperCase())
      .eq("phone_hash", phoneHash);
    if (error) throw new Error(`supabase: ${error.message}`);
    return (count ?? 0) > 0;
  },

  async countSignatures(code) {
    const { count, error } = await db()
      .from("signatures")
      .select("project_code", { count: "exact", head: true })
      .eq("project_code", code.toUpperCase());
    if (error) throw new Error(`supabase: ${error.message}`);
    return count ?? 0;
  },

  async addSignals(items) {
    if (!items.length) return [];
    const rows = check(
      await db()
        .from("signals")
        .upsert(items.map(fromSignal), { onConflict: "url_key", ignoreDuplicates: true })
        .select("*"),
    ) as SignalRow[];
    return rows.map(toSignal);
  },

  async listSignals(status) {
    let q = db().from("signals").select("*").order("found_at", { ascending: false });
    if (status) q = q.eq("status", status);
    return (check(await q) as SignalRow[]).map(toSignal);
  },

  async getSignal(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const row = check(await db().from("signals").select("*").eq("id", id).maybeSingle()) as SignalRow | null;
    return row ? toSignal(row) : null;
  },

  async setSignalStatus(id, status, projectCode) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const patch: Record<string, unknown> = { status };
    if (projectCode) patch.project_code = projectCode;
    const row = check(
      await db().from("signals").update(patch).eq("id", id).select("*").maybeSingle(),
    ) as SignalRow | null;
    return row ? toSignal(row) : null;
  },

  async getScanState() {
    const row = check(
      await db().from("scan_state").select("cursor_pos, runs").eq("id", 1).maybeSingle(),
    ) as { cursor_pos: number; runs: ScanRun[] } | null;
    return { cursor: row?.cursor_pos ?? 0, runs: row?.runs ?? [] };
  },

  async setScanState(state) {
    check(await db().from("scan_state").upsert({ id: 1, cursor_pos: state.cursor, runs: state.runs }));
  },

  async rateLimit(key, limit, windowMs) {
    return check(
      await db().rpc("rate_limit_hit", { p_key: key, p_window_ms: windowMs, p_limit: limit, p_now: Date.now() }),
    ) as boolean;
  },

  async otpRequest(phoneHash, codeHash, now, rules): Promise<OtpRequestResult> {
    const res = check(
      await db().rpc("otp_request", {
        p_phone_hash: phoneHash,
        p_code_hash: codeHash,
        p_now: now,
        p_ttl_ms: rules.ttlMs,
        p_cooldown_ms: rules.cooldownMs,
        p_window_ms: rules.windowMs,
        p_max_sends: rules.maxSends,
      }),
    ) as { ok: boolean; error?: "cooldown" | "limit"; retryAfter?: number };
    return res.ok ? { ok: true } : { ok: false, error: res.error ?? "limit", retryAfter: res.retryAfter };
  },

  async otpVerify(phoneHash, codeHash, now, maxAttempts) {
    return check(
      await db().rpc("otp_verify", {
        p_phone_hash: phoneHash,
        p_code_hash: codeHash,
        p_now: now,
        p_max_attempts: maxAttempts,
      }),
    ) as OtpVerifyResult;
  },
};
