import { z } from "zod";

// ---------------------------------------------------------------------------
// Vocabulary. Keys are stored in the database; labels live in the dictionaries.
// ---------------------------------------------------------------------------

/** What is wrong, described as a problem (not a solution). */
export const PROBLEM_KEYS = [
  "crossing", // hard or unsafe to cross the road
  "sidewalk", // broken, missing or blocked sidewalk
  "access", // not usable with a stroller, wheelchair or walker
  "shade", // no shade or seating
  "lighting", // poorly lit, feels unsafe
  "green", // neglected green space or play area
  "traffic", // speeding, parking or traffic conflicts
  "other",
] as const;
export type ProblemKey = (typeof PROBLEM_KEYS)[number];

/** Optional: a fix the reporter already has in mind. */
export const FIX_KEYS = [
  "pedestrian_crossing",
  "pedestrian_bridge",
  "ramp",
  "sidewalk_repair",
  "shade_structure",
  "lighting",
  "seating",
  "planting",
  "traffic_calming",
  "other",
] as const;
export type FixKey = (typeof FIX_KEYS)[number];

/** Curated collections of common gaps, suggested by the Majal team. */
export const THEME_KEYS = ["school_crossing", "kindergarten_crossing", "major_crossing"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
/** The problem a curated suggestion files under by default. */
export const THEME_PROBLEM: Record<ThemeKey, ProblemKey> = {
  school_crossing: "crossing",
  kindergarten_crossing: "crossing",
  major_crossing: "crossing",
};

/** Who created a project: a resident's report or a curated suggestion. */
export type ProjectSource = "resident" | "curated";

export const STATUSES = [
  "pending_review", // submitted, waiting for a moderator
  "open_for_signatures",
  "open_for_design",
  "sponsorship",
  "submitted_to_authority",
  "in_progress",
  "completed",
  "rejected",
] as const;
export type ProjectStatus = (typeof STATUSES)[number];

/** Statuses visible to the public (explorer, listings). */
export const PUBLIC_STATUSES = [
  "open_for_signatures",
  "open_for_design",
  "sponsorship",
  "submitted_to_authority",
  "in_progress",
  "completed",
] as const satisfies readonly ProjectStatus[];
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];
export const isPublicStatus = (s: ProjectStatus): s is PublicStatus =>
  (PUBLIC_STATUSES as readonly string[]).includes(s);

/** Marker colours, readable on light and dark basemaps (white outline). */
export const STATUS_COLORS: Record<PublicStatus, string> = {
  open_for_signatures: "#c8501e",
  open_for_design: "#6b4fbb",
  sponsorship: "#b7791f",
  submitted_to_authority: "#2f6fb0",
  in_progress: "#138a72",
  completed: "#2e7d32",
};

// ---------------------------------------------------------------------------
// Geography. Reports must be inside Kuwait (rough bounding box).
// ---------------------------------------------------------------------------

export const KUWAIT_BOUNDS = {
  west: 46.55,
  south: 28.52,
  east: 48.45,
  north: 30.1,
} as const;

/** Salmiya: the pilot area and the map's starting point. */
export const DEFAULT_CENTER = { lat: 29.3345, lng: 48.0765 } as const;

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

/** Signatures a project needs before it can be raised with an authority. */
export const SIGNATURE_TARGET = 100;
export const OTP_LENGTH = 6;

/**
 * Kuwaiti mobile numbers: 8 digits starting with 5, 6 or 9, optionally typed
 * with +965 / 00965 / 965. Returns "+965XXXXXXXX", or null if invalid.
 */
export function normalizeKuwaitPhone(input: string): string | null {
  // Arabic-Indic digits (٠-٩) are common on Arabic keyboards.
  const ascii = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
  let digits = ascii.replace(/\D/g, "");
  if (digits.startsWith("00965")) digits = digits.slice(5);
  else if (digits.startsWith("965") && digits.length === 11) digits = digits.slice(3);
  return /^[569]\d{7}$/.test(digits) ? `+965${digits}` : null;
}

// ---------------------------------------------------------------------------
// Signals: complaints found online by the monitoring job, for team review
// ---------------------------------------------------------------------------

/** Languages residents of Kuwait post in. The scan rotates through these. */
export const SIGNAL_LANGUAGES = {
  ar: "Arabic",
  en: "English",
  ur: "Urdu",
  hi: "Hindi",
  tl: "Filipino (Tagalog)",
  ml: "Malayalam",
  bn: "Bengali",
  ta: "Tamil",
  si: "Sinhala",
  ne: "Nepali",
} as const;
export type SignalLanguage = keyof typeof SIGNAL_LANGUAGES;
export const SIGNAL_LANGUAGE_KEYS = Object.keys(SIGNAL_LANGUAGES) as SignalLanguage[];

export const SIGNAL_STATUSES = ["new", "dismissed", "converted"] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export type Signal = {
  id: string;
  /** Normalised URL used to avoid saving the same post twice. */
  urlKey: string;
  url: string;
  sourceName: string;
  /** ISO date if the source shows one. */
  published: string | null;
  /** Language the post is written in (ISO 639-1). */
  language: string;
  /** Short quote in the original language, never with names or handles. */
  excerpt: string;
  summaryAr: string;
  summaryEn: string;
  problem: ProblemKey;
  theme: ThemeKey | null;
  area: string | null;
  locationHint: string | null;
  confidence: "high" | "medium" | "low";
  foundAt: string;
  /** "scan:<lang>" or "intake". */
  via: string;
  status: SignalStatus;
  projectCode: string | null;
};

export type ScanRun = {
  at: string;
  languages: string[];
  found: number;
  added: number;
  searches: number;
  inputTokens: number;
  outputTokens: number;
  errors: string[];
};

/** Strip tracking parameters, fragments and "www." so one post has one key. */
export function urlKey(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igshid|si$|s$|ref$|ref_src$)/i.test(k)) u.searchParams.delete(k);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    const query = u.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// ---------------------------------------------------------------------------
// Report payload (shared by the browser form and the API route)
// ---------------------------------------------------------------------------

export const reportSchema = z.object({
  lat: z.coerce.number().min(KUWAIT_BOUNDS.south).max(KUWAIT_BOUNDS.north),
  lng: z.coerce.number().min(KUWAIT_BOUNDS.west).max(KUWAIT_BOUNDS.east),
  problem: z.enum(PROBLEM_KEYS),
  fix: z.enum(FIX_KEYS).optional(),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(2000),
});
export type ReportInput = z.infer<typeof reportSchema>;

/** A suggestion added by the team (one at a time or by bulk import). */
export const suggestionSchema = reportSchema.extend({
  theme: z.enum(THEME_KEYS),
  area: z.string().trim().min(2).max(60),
  problem: z.enum(PROBLEM_KEYS).optional(),
});
export type SuggestionInput = z.infer<typeof suggestionSchema>;

/** Distance in metres between two points (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// Stored project
// ---------------------------------------------------------------------------

export type Project = {
  id: string;
  /** Short public code printed on plaques and used in share links, e.g. P-0042. */
  code: string;
  status: ProjectStatus;
  problem: ProblemKey;
  fix: FixKey | null;
  title: string;
  description: string;
  lat: number;
  lng: number;
  /** Photo ids; resolve to URLs with photoUrl(). */
  photos: string[];
  createdAt: string;
  source: ProjectSource;
  /** Curated collection, if any. */
  theme: ThemeKey | null;
  /** Neighbourhood name, e.g. "السالمية". Set for curated suggestions. */
  area: string | null;
};

/** A project as listed publicly, with its signature count. */
export type ProjectSummary = Project & { signatures: number };

export const photoUrl = (id: string) => `/api/uploads/${id}`;
export const projectPath = (lang: string, code: string) => `/${lang}/p/${code}`;
