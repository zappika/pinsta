import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { sendPush } from "@/lib/apns";
import { getDb } from "@/lib/db";
import { importJobs, type ImportJob, type ImportMatch } from "@/lib/db/schema";
import type { GoogleList } from "@/lib/google-list";
import { entryKey, mapLimit, remembered, searchAndRemember, type Match } from "@/lib/list-match";

/**
 * The iOS app's Google list import, matched on the server (Sarp, 2026-10-19), so it
 * finishes with the phone in a pocket and a push says it's ready. No queue and no cron:
 * a job is matched in chunks that chain themselves. Each chunk holds a lease on the job,
 * matches for up to BUDGET_MS, saves its progress after every batch and calls the next
 * chunk (`POST /api/import/jobs/<id>/run`, which answers at once and works in `after()`).
 * The phone's poll restarts a chunk whose lease ran out, so a broken chain heals itself.
 */

/** A list longer than this is cut (Google's list read gives 500 at most anyway). */
export const MAX_ENTRIES = 500;
/** Jobs are kept this long, then deleted when the next one starts. */
const KEEP_DAYS = 14;
/** Matching time per chunk, well inside the routes' 60 s. */
const BUDGET_MS = 40_000;
const LEASE_SECONDS = 58;
/** Entries per progress write; four Google searches at a time within it. */
const BATCH = 8;

export async function createJob(
  list: GoogleList,
  link: string,
  phone: { token: string | null; sandbox: boolean; install: string | null },
): Promise<ImportJob> {
  const db = getDb();
  await db
    .delete(importJobs)
    .where(lt(importJobs.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)))
    .catch(() => {});
  const entries = list.entries.slice(0, MAX_ENTRIES);
  const [job] = await db
    .insert(importJobs)
    .values({ link, title: list.title, owner: list.owner, entries, total: entries.length, ...phone })
    .returning();
  return job;
}

export async function getJob(id: string): Promise<ImportJob | null> {
  const [job] = await getDb().select().from(importJobs).where(eq(importJobs.id, id));
  return job ?? null;
}

/** Still matching, and no chunk holds it: the chain broke (or hasn't started). */
export function stalled(job: ImportJob) {
  return job.status === "matching" && (!job.runningUntil || job.runningUntil.getTime() < Date.now());
}

/**
 * One chunk. Returns at once when another chunk holds the job. `origin` is where
 * the next chunk is called (this deployment).
 */
export async function runChunk(id: string, origin: string): Promise<void> {
  const db = getDb();
  const [job] = await db
    .update(importJobs)
    .set({ runningUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})` })
    .where(
      and(
        eq(importJobs.id, id),
        eq(importJobs.status, "matching"),
        or(isNull(importJobs.runningUntil), lt(importJobs.runningUntil, sql`now()`)),
      ),
    )
    .returning();
  if (!job) return;

  const started = Date.now();
  const matches = job.matches.slice(0, job.done);
  let done = job.done;
  try {
    const memory = await remembered(job.entries.slice(done), true);
    // At least one batch per chunk, so a chain always moves.
    do {
      const batch = job.entries.slice(done, done + BATCH);
      const found = await mapLimit(batch, 4, async (entry) => {
        const key = entryKey(entry);
        const known = memory.has(key) ? memory.get(key) : undefined;
        // A search that failed outright is tried once more, then counts as not found.
        const match = known !== undefined ? known : ((await searchAndRemember(entry)) ?? (await searchAndRemember(entry)));
        return match ? forPhone(match, entry) : null;
      });
      matches.push(...found);
      done += batch.length;
      await db.update(importJobs).set({ matches, done, updatedAt: new Date() }).where(eq(importJobs.id, id));
    } while (done < job.total && Date.now() - started < BUDGET_MS);
  } catch (e) {
    console.error("import job", id, e);
    // Not one entry further: stop here rather than chain the same failure forever.
    if (done === job.done) {
      await db.update(importJobs).set({ status: "failed", runningUntil: null, updatedAt: new Date() }).where(eq(importJobs.id, id));
      return;
    }
  }

  if (done >= job.total) {
    await db
      .update(importJobs)
      .set({ status: "ready", runningUntil: null, token: null, updatedAt: new Date() })
      .where(eq(importJobs.id, id));
    if (job.token) await notify(job, matches.filter(Boolean).length);
    return;
  }
  await db.update(importJobs).set({ runningUntil: null }).where(eq(importJobs.id, id));
  await fetch(`${origin}/api/import/jobs/${id}/run`, { method: "POST" }).catch((e) =>
    console.warn("import job: next chunk not started", id, e instanceof Error ? e.message : e),
  );
}

/** A remembered match always has its pin here (`remembered(…, true)`); the list's pin is the fallback. */
function forPhone(m: Match, entry: { lat: number; lng: number; address: string | null }): ImportMatch {
  return {
    placeId: m.placeId,
    name: m.name,
    lat: m.lat ?? entry.lat,
    lng: m.lng ?? entry.lng,
    address: m.address ?? entry.address,
    city: m.city,
    region: m.region ?? null,
    country: m.country ?? null,
    category: m.category,
    primaryType: m.primaryType ?? null,
  };
}

async function notify(job: ImportJob, found: number) {
  const title = job.title?.trim() || "Your Google Maps list";
  const body =
    found === job.total
      ? `Ready to review: all ${found} places found.`
      : `Ready to review: ${found} of ${job.total} places found.`;
  const sent = await sendPush(job.token!, { title, body, data: { importJob: job.id } }, job.sandbox);
  if (!sent) console.warn("import job: no push for", job.id);
}

/** What the phone gets: progress, and the entries with their matches once ready. */
export function view(job: ImportJob) {
  return {
    id: job.id,
    status: job.status,
    link: job.link,
    title: job.title,
    owner: job.owner,
    total: job.total,
    done: job.done,
    ...(job.status === "ready" ? { items: job.entries.map((e, i) => ({ ...e, match: job.matches[i] ?? null })) } : {}),
  };
}
