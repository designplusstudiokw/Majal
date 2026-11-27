import "server-only";
import { repo } from "@/lib/repo";
import { clientIp, hmac, secret } from "@/lib/security";

/**
 * Per-visitor limits, counted in the shared store (database in production) so
 * they hold across server instances. Visitors are identified by a keyed hash
 * of their IP address; raw IPs are never stored.
 */
export async function allow(request: Request, name: string, limit: number, windowMs: number) {
  const who = hmac(secret("SESSION_SECRET"), `ip:${clientIp(request)}`).slice(0, 32);
  return repo.rateLimit(`${name}:${who}`, limit, windowMs);
}
