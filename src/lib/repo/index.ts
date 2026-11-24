import "server-only";
import { localRepository } from "./local";
import { supabaseRepository } from "./supabase";
import type { Repository } from "./types";

/**
 * Supabase when configured (SUPABASE_URL + SUPABASE_SECRET_KEY), otherwise the
 * local JSON store for development. Production refuses to fall back silently.
 */
function pick(): Repository {
  if (process.env.SUPABASE_URL) return supabaseRepository;
  if (process.env.NODE_ENV === "production" && process.env.MAJAL_ALLOW_LOCAL_STORE !== "1") {
    // Local files vanish on most hosts at every deploy; never use them by accident.
    throw new Error("SUPABASE_URL is not set. Set it, or MAJAL_ALLOW_LOCAL_STORE=1 for a local demo.");
  }
  return localRepository;
}

let chosen: Repository | null = null;
export const repo: Repository = new Proxy({} as Repository, {
  get: (_t, prop: keyof Repository) => {
    chosen ??= pick();
    return chosen[prop];
  },
});
