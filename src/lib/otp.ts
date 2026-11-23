import "server-only";
import { randomInt } from "node:crypto";
import { OTP_LENGTH } from "@/lib/domain";
import { repo } from "@/lib/repo";
import type { OtpRecord } from "@/lib/repo/types";
import { getSmsProvider } from "@/lib/sms";
import { hashPhone, hmac, safeEqual, secret } from "@/lib/security";

const CODE_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const WINDOW_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

const codeHash = (phoneHash: string, code: string) =>
  hmac(secret("PHONE_HASH_SECRET"), `otp:${phoneHash}:${code}`);

export type RequestResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: "cooldown" | "limit" | "sms_failed"; retryAfter?: number };

export async function requestCode(phoneE164: string): Promise<RequestResult> {
  const sms = getSmsProvider();
  const phoneHash = hashPhone(phoneE164);
  const code =
    sms.fixedCode ?? String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const now = Date.now();
  let blocked: RequestResult | null = null;

  await repo.mutateOtp(phoneHash, (current) => {
    const recent = (current?.recentSends ?? []).filter((t) => now - t < WINDOW_MS);
    const last = recent[recent.length - 1];
    if (last && now - last < RESEND_COOLDOWN_MS) {
      blocked = {
        ok: false,
        error: "cooldown",
        retryAfter: Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000),
      };
    } else if (recent.length >= MAX_SENDS_PER_WINDOW) {
      blocked = { ok: false, error: "limit" };
    }
    if (blocked) return current ?? { codeHash: null, expiresAt: 0, attempts: 0, recentSends: recent };
    return {
      codeHash: codeHash(phoneHash, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      recentSends: [...recent, now],
    };
  });
  if (blocked) return blocked;

  try {
    await sms.send(phoneE164, `Majal: your code is ${code}`);
  } catch {
    return { ok: false, error: "sms_failed" };
  }
  return { ok: true, devCode: sms.isDev ? code : undefined };
}

export type VerifyResult =
  | { ok: true; phoneHash: string }
  | { ok: false; error: "invalid" | "expired" | "locked" };

export async function verifyCode(phoneE164: string, code: string): Promise<VerifyResult> {
  const phoneHash = hashPhone(phoneE164);
  const now = Date.now();
  let result: VerifyResult = { ok: false, error: "invalid" };

  await repo.mutateOtp(phoneHash, (current): OtpRecord => {
    const empty: OtpRecord = { codeHash: null, expiresAt: 0, attempts: 0, recentSends: [] };
    if (!current || !current.codeHash) return current ?? empty;
    if (now > current.expiresAt) {
      result = { ok: false, error: "expired" };
      return { ...current, codeHash: null };
    }
    if (current.attempts >= MAX_ATTEMPTS) {
      result = { ok: false, error: "locked" };
      return { ...current, codeHash: null };
    }
    if (safeEqual(current.codeHash, codeHash(phoneHash, code))) {
      result = { ok: true, phoneHash };
      return { ...current, codeHash: null }; // single use
    }
    const attempts = current.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) result = { ok: false, error: "locked" };
    return { ...current, attempts, codeHash: attempts >= MAX_ATTEMPTS ? null : current.codeHash };
  });
  return result;
}
