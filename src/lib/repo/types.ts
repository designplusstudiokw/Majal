import type { Project, ProjectStatus, ReportInput } from "@/lib/domain";

export type NewPhoto = { bytes: Uint8Array; contentType: string };

/** One-time-code state for a phone number (keyed by phone hash). */
export type OtpRecord = {
  /** Null once used or invalidated. */
  codeHash: string | null;
  expiresAt: number;
  attempts: number;
  /** Send times (ms) within the rate-limit window. */
  recentSends: number[];
};

/**
 * Everything the app needs from storage. Today it is backed by a local JSON
 * file; later a Supabase implementation replaces it without touching callers.
 */
export interface Repository {
  createProject(input: ReportInput, photos: NewPhoto[]): Promise<Project>;
  getProjectByCode(code: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  setProjectStatus(code: string, status: ProjectStatus): Promise<Project | null>;
  /** Returns null when the photo does not exist. */
  readPhoto(id: string): Promise<NewPhoto | null>;

  /** One signature per phone per project. `created` is false for a repeat. */
  addSignature(code: string, phoneHash: string): Promise<{ created: boolean }>;
  hasSigned(code: string, phoneHash: string): Promise<boolean>;
  countSignatures(code: string): Promise<number>;

  /** Atomic read-modify-write so concurrent guesses cannot beat the attempt limit. */
  mutateOtp(phoneHash: string, fn: (current: OtpRecord | null) => OtpRecord): Promise<OtpRecord>;
}
