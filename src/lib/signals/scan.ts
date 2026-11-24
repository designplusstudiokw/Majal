import "server-only";
import { SIGNAL_LANGUAGE_KEYS, type ScanRun, type SignalLanguage } from "@/lib/domain";
import { repo } from "@/lib/repo";
import { scanLanguage } from "./claude";

/** Languages to cover, in rotation order. SIGNALS_LANGUAGES=ar,en,ur narrows it. */
function languages(): SignalLanguage[] {
  const wanted = process.env.SIGNALS_LANGUAGES?.split(",").map((s) => s.trim());
  const list = SIGNAL_LANGUAGE_KEYS.filter((k) => !wanted || wanted.includes(k));
  return list.length ? list : SIGNAL_LANGUAGE_KEYS;
}

let running = false;

/**
 * One step of the rotation: scan the next few languages, save new signals,
 * log the run. Each call covers SIGNALS_LANGUAGES_PER_RUN languages (default
 * 2) so a single run stays well inside hosting time limits; schedule it
 * hourly and every language is covered several times a day.
 */
export async function runScanStep(): Promise<ScanRun | { busy: true }> {
  if (running) return { busy: true };
  running = true;
  try {
    const all = languages();
    const perRun = Math.max(1, Number(process.env.SIGNALS_LANGUAGES_PER_RUN ?? 2));
    const state = await repo.getScanState();
    const batch = Array.from({ length: Math.min(perRun, all.length) }, (_, i) => all[(state.cursor + i) % all.length]);

    const log: ScanRun = {
      at: new Date().toISOString(),
      languages: batch,
      found: 0,
      added: 0,
      searches: 0,
      inputTokens: 0,
      outputTokens: 0,
      errors: [],
    };
    for (const lang of batch) {
      try {
        const { signals, found, usage } = await scanLanguage(lang);
        const added = await repo.addSignals(signals);
        log.found += found;
        log.added += added.length;
        log.searches += usage.searches;
        log.inputTokens += usage.inputTokens;
        log.outputTokens += usage.outputTokens;
      } catch (e) {
        log.errors.push(`${lang}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
      }
    }
    await repo.setScanState({
      cursor: (state.cursor + batch.length) % all.length,
      runs: [log, ...state.runs].slice(0, 30),
    });
    return log;
  } finally {
    running = false;
  }
}
