import "server-only";

/**
 * Cloudflare Turnstile: a privacy-friendly human check, usually invisible.
 * Active when TURNSTILE_SECRET_KEY (server) and NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * (browser) are set; otherwise reports rely on rate limits alone.
 */
export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // fail closed: a report can be retried
  }
}
