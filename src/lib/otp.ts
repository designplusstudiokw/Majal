import "server-only";
import { randomInt } from "node:crypto";
import { OTP_LENGTH } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { getSmsProvider } from "@/lib/sms";
import { hashPhone, hmac, secret } from "@/lib/security";

export const OTP_RULES = {
  ttlMs: 5 * 60_000, // a code is valid for 5 minutes
  cooldownMs: 30_000, // wait 30 s before asking for another
  windowMs: 10 * 60_000, // at most maxSends codes per 10 minutes
  maxSends: 3,
  maxAttempts: 5, // wrong guesses before the code is void
};

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

  // The store applies the cooldown and send limit atomically.
  const stored = await repo.otpRequest(phoneHash, codeHash(phoneHash, code), Date.now(), OTP_RULES);
  if (!stored.ok) return stored;

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
  const result = await repo.otpVerify(phoneHash, codeHash(phoneHash, code), Date.now(), OTP_RULES.maxAttempts);
  return result === "ok" ? { ok: true, phoneHash } : { ok: false, error: result };
}
