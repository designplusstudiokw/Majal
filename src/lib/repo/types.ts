import type {
  ModerationEvent,
  Project,
  ProjectEdit,
  ProjectSource,
  ProjectStatus,
  ProjectSummary,
  ReportInput,
  ScanRun,
  Signal,
  SignalStatus,
  ThemeKey,
} from "@/lib/domain";

/** A project to create: a resident report, or a curated suggestion. */
export type NewProject = ReportInput & {
  source?: ProjectSource;
  theme?: ThemeKey | null;
  area?: string | null;
  /** Defaults to pending_review. */
  status?: ProjectStatus;
};

export type NewPhoto = { bytes: Uint8Array; contentType: string };

export type OtpRules = {
  ttlMs: number;
  cooldownMs: number;
  windowMs: number;
  maxSends: number;
};
export type OtpRequestResult =
  | { ok: true }
  | { ok: false; error: "cooldown" | "limit"; retryAfter?: number };
export type OtpVerifyResult = "ok" | "invalid" | "expired" | "locked";

/**
 * Everything the app needs from storage. Today it is backed by a local JSON
 * file; later a Supabase implementation replaces it without touching callers.
 */
export interface Repository {
  createProject(input: NewProject, photos: NewPhoto[]): Promise<Project>;
  /** Several at once, all or nothing (bulk import). */
  createProjects(inputs: NewProject[]): Promise<Project[]>;
  getProjectByCode(code: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  /** Publicly visible projects with signature counts, in one query. */
  listPublicProjects(): Promise<ProjectSummary[]>;
  setProjectStatus(code: string, status: ProjectStatus): Promise<Project | null>;
  /** Moderator edit; only the given fields change. */
  updateProject(code: string, edit: ProjectEdit): Promise<Project | null>;
  /** Remove one photo from a project and delete the file. */
  removePhoto(code: string, photoId: string): Promise<Project | null>;
  logModeration(event: Omit<ModerationEvent, "at">): Promise<void>;
  /** Newest first; for one project, or the whole log. */
  listModeration(projectCode?: string, limit?: number): Promise<ModerationEvent[]>;
  /** Returns null when the photo does not exist. */
  readPhoto(id: string): Promise<NewPhoto | null>;

  /** One signature per phone per project. `created` is false for a repeat. */
  addSignature(code: string, phoneHash: string): Promise<{ created: boolean }>;
  hasSigned(code: string, phoneHash: string): Promise<boolean>;
  countSignatures(code: string): Promise<number>;

  /** Signals from online monitoring. addSignals skips URLs already saved. */
  addSignals(signals: Omit<Signal, "id">[]): Promise<Signal[]>;
  listSignals(status?: SignalStatus): Promise<Signal[]>;
  getSignal(id: string): Promise<Signal | null>;
  setSignalStatus(id: string, status: SignalStatus, projectCode?: string): Promise<Signal | null>;
  /** Which languages the next scan covers, and recent run logs. */
  getScanState(): Promise<{ cursor: number; runs: ScanRun[] }>;
  setScanState(state: { cursor: number; runs: ScanRun[] }): Promise<void>;

  /** Count one hit for `key`; false once it is over `limit` in the window. */
  rateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;

  /** Store a new code unless the resend cooldown or send limit applies.
   *  Must be atomic per phone so concurrent requests cannot bypass limits. */
  otpRequest(phoneHash: string, codeHash: string, now: number, rules: OtpRules): Promise<OtpRequestResult>;
  /** Check a code; single use; void after maxAttempts wrong guesses. Atomic per phone. */
  otpVerify(phoneHash: string, codeHash: string, now: number, maxAttempts: number): Promise<OtpVerifyResult>;
}
