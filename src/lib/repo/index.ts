import "server-only";
import { localRepository } from "./local";
import type { Repository } from "./types";

// Later: return a Supabase-backed repository when SUPABASE_URL is configured.
export const repo: Repository = localRepository;
