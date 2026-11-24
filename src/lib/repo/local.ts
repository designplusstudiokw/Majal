import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPublicStatus, type Project, type ReportInput } from "@/lib/domain";
import type { NewPhoto, OtpRecord, Repository } from "./types";

/**
 * Local development store: one JSON file plus an uploads folder under .data/.
 * Single process only. Swap for the Supabase implementation before deploying.
 */

type Signature = { projectCode: string; phoneHash: string; createdAt: string };
type Db = {
  counter: number;
  projects: Project[];
  signatures: Signature[];
  otps: Record<string, OtpRecord>;
};

const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TYPE_BY_EXT = Object.fromEntries(
  Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]),
);
const PHOTO_ID = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

async function load(): Promise<Db> {
  try {
    const db = JSON.parse(await readFile(DB_FILE, "utf8")) as Partial<Db>;
    // Files written before signatures existed lack these fields.
    return {
      counter: db.counter ?? 0,
      projects: db.projects ?? [],
      signatures: db.signatures ?? [],
      otps: db.otps ?? {},
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { counter: 0, projects: [], signatures: [], otps: {} };
    }
    throw e;
  }
}

async function save(db: Db) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_FILE); // atomic replace
}

// Serialise writes so concurrent requests cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export const localRepository: Repository = {
  async createProject(input: ReportInput, photos: NewPhoto[]) {
    return exclusive(async () => {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const photoIds: string[] = [];
      for (const photo of photos) {
        const ext = EXT_BY_TYPE[photo.contentType];
        const id = `${randomBytes(16).toString("hex")}.${ext}`;
        await writeFile(path.join(UPLOAD_DIR, id), photo.bytes);
        photoIds.push(id);
      }

      const db = await load();
      db.counter += 1;
      const project: Project = {
        id: randomBytes(8).toString("hex"),
        code: `P-${String(db.counter).padStart(4, "0")}`,
        status: "pending_review",
        problem: input.problem,
        fix: input.fix ?? null,
        title: input.title,
        description: input.description,
        lat: input.lat,
        lng: input.lng,
        photos: photoIds,
        createdAt: new Date().toISOString(),
      };
      db.projects.push(project);
      await save(db);
      return project;
    });
  },

  async getProjectByCode(code) {
    const db = await load();
    return db.projects.find((p) => p.code === code.toUpperCase()) ?? null;
  },

  async listProjects() {
    const db = await load();
    return [...db.projects].reverse();
  },

  async listPublicProjects() {
    const db = await load();
    const counts = new Map<string, number>();
    for (const s of db.signatures) counts.set(s.projectCode, (counts.get(s.projectCode) ?? 0) + 1);
    return db.projects
      .filter((p) => isPublicStatus(p.status))
      .reverse()
      .map((p) => ({ ...p, signatures: counts.get(p.code) ?? 0 }));
  },

  async setProjectStatus(code, status) {
    return exclusive(async () => {
      const db = await load();
      const project = db.projects.find((p) => p.code === code.toUpperCase());
      if (!project) return null;
      project.status = status;
      await save(db);
      return project;
    });
  },

  async addSignature(code, phoneHash) {
    return exclusive(async () => {
      const db = await load();
      const projectCode = code.toUpperCase();
      if (db.signatures.some((s) => s.projectCode === projectCode && s.phoneHash === phoneHash)) {
        return { created: false };
      }
      db.signatures.push({ projectCode, phoneHash, createdAt: new Date().toISOString() });
      await save(db);
      return { created: true };
    });
  },

  async hasSigned(code, phoneHash) {
    const db = await load();
    const projectCode = code.toUpperCase();
    return db.signatures.some((s) => s.projectCode === projectCode && s.phoneHash === phoneHash);
  },

  async countSignatures(code) {
    const db = await load();
    const projectCode = code.toUpperCase();
    return db.signatures.filter((s) => s.projectCode === projectCode).length;
  },

  async mutateOtp(phoneHash, fn) {
    return exclusive(async () => {
      const db = await load();
      const next = fn(db.otps[phoneHash] ?? null);
      db.otps[phoneHash] = next;
      await save(db);
      return next;
    });
  },

  async readPhoto(id) {
    if (!PHOTO_ID.test(id)) return null;
    try {
      const bytes = await readFile(path.join(UPLOAD_DIR, id));
      return { bytes, contentType: TYPE_BY_EXT[id.split(".")[1]] };
    } catch {
      return null;
    }
  },
};
