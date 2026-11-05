import "server-only";
import { logger } from "../logger";

/**
 * Minimal in-process background job queue with bounded concurrency.
 * Work is persisted in the database (e.g. tracks with status PROCESSING), so
 * jobs lost on restart are re-enqueued at boot (see src/instrumentation.ts).
 * A dedicated worker (BullMQ, pg-boss…) can replace this behind the same API.
 */
type Job = { name: string; key: string; run: () => Promise<void> };

const g = globalThis as unknown as { __auralisJobs?: { queue: Job[]; running: number; keys: Set<string> } };
const state = (g.__auralisJobs ??= { queue: [], running: 0, keys: new Set() });
const CONCURRENCY = 2;

function pump() {
  while (state.running < CONCURRENCY && state.queue.length) {
    const job = state.queue.shift()!;
    state.running++;
    const started = Date.now();
    job
      .run()
      .then(() => logger.info("job_done", { job: job.name, key: job.key, ms: Date.now() - started }))
      .catch((e) => logger.error("job_failed", { job: job.name, key: job.key, error: String(e) }))
      .finally(() => {
        state.running--;
        state.keys.delete(job.key);
        pump();
      });
  }
}

/** Enqueues a job; duplicate keys already queued/running are ignored. */
export function enqueueJob(name: string, key: string, run: () => Promise<void>) {
  if (state.keys.has(key)) return;
  state.keys.add(key);
  state.queue.push({ name, key, run });
  setImmediate(pump);
}

export function jobStats() {
  return { queued: state.queue.length, running: state.running };
}
