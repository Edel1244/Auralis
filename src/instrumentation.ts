/**
 * Runs once when the server boots. Re-queues tracks whose background
 * processing was interrupted by a restart.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { db } = await import("./server/db");
    const { ensureDefaultGenres } = await import("./server/modules/genres/defaults");
    await ensureDefaultGenres();
    const { enqueueTrackProcessing } = await import("./server/modules/tracks/service");
    const stuck = await db.track.findMany({ where: { status: "PROCESSING" }, select: { id: true }, take: 500 });
    stuck.forEach((t) => enqueueTrackProcessing(t.id));
    if (stuck.length) console.log(JSON.stringify({ level: "info", msg: "requeued_processing_tracks", count: stuck.length }));
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "boot_requeue_failed", error: String(e) }));
  }
}
