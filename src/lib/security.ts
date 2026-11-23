import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Secrets come from the environment. In development we fall back to fixed
 * values so `npm run dev` just works; in production a missing secret is an
 * error, never a silent weak default.
 */
const isProd = () => process.env.NODE_ENV === "production";

export function secret(name: "SESSION_SECRET" | "PHONE_HASH_SECRET"): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd()) throw new Error(`${name} must be set in production`);
  return `dev-only-${name.toLowerCase()}`;
}

export function hmac(key: string, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Phone numbers are stored only as keyed hashes, never in clear text. */
export const hashPhone = (e164: string) => hmac(secret("PHONE_HASH_SECRET"), `phone:${e164}`);

// ---- Signed cookie values ("payload.expiry.signature") --------------------

function sign(kind: string, payload: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${payload}.${exp}`;
  return `${body}.${hmac(secret("SESSION_SECRET"), `${kind}:${body}`)}`;
}

function verify(kind: string, token: string | undefined): string | null {
  if (!token) return null;
  const [payload, exp, sig] = token.split(".");
  if (!payload || !exp || !sig) return null;
  const expected = hmac(secret("SESSION_SECRET"), `${kind}:${payload}.${exp}`);
  if (!safeEqual(sig, expected)) return null;
  return Number(exp) > Date.now() / 1000 ? payload : null;
}

export const SESSION_COOKIE = "majal_session";
export const SESSION_TTL = 60 * 60 * 24 * 90; // 90 days
export const ADMIN_COOKIE = "majal_admin";
export const ADMIN_TTL = 60 * 60 * 12; // 12 hours

export const makeSession = (phoneHash: string) => sign("session", phoneHash, SESSION_TTL);
export const readSession = (token: string | undefined) => verify("session", token);
export const makeAdminToken = () => sign("admin", "admin", ADMIN_TTL);
export const isAdminToken = (token: string | undefined) => verify("admin", token) === "admin";

/** Admin password. Dev default only outside production; unset in prod = admin disabled. */
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return isProd() ? null : "majal-admin";
}

// ---- Request helpers --------------------------------------------------------

export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export const isHttps = (request: Request) =>
  new URL(request.url).protocol === "https:" ||
  request.headers.get("x-forwarded-proto") === "https";

/**
 * JSON-only body. Cross-site HTML forms cannot send application/json without a
 * CORS preflight, which is our cheap CSRF defence alongside SameSite=Lax.
 */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
