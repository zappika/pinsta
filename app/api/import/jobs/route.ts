import { after, NextResponse } from "next/server";
import { ListError, readGoogleList } from "@/lib/google-list";
import { createJob, runChunk, view } from "@/lib/import-jobs";

export const maxDuration = 60;

/**
 * The iOS app starts a Google list import here (Sarp, 2026-10-19): the list is read
 * (free), stored as a job, and matched on the server in the background
 * (`lib/import-jobs.ts`); the phone polls `GET /api/import/jobs/<id>` and gets a push
 * when it's ready. Open, like /api/list: each new entry costs one Google search.
 * Body: { url, token?: APNs device token (hex), sandbox?: a Debug build's token, install? }.
 */
export async function POST(req: Request) {
  const raw = ((await req.json().catch(() => null)) ?? {}) as { url?: unknown; token?: unknown; sandbox?: unknown; install?: unknown };
  if (typeof raw.url !== "string" || !raw.url.trim()) {
    return NextResponse.json({ error: "Paste the link of a shared list" }, { status: 400 });
  }
  const token = typeof raw.token === "string" && /^[0-9a-f]{32,200}$/i.test(raw.token) ? raw.token : null;
  const install = typeof raw.install === "string" ? raw.install.slice(0, 64) : null;

  let list;
  try {
    list = await readGoogleList(raw.url);
  } catch (e) {
    if (e instanceof ListError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: "Couldn't read that list" }, { status: 502 });
  }
  if (list.entries.length === 0) {
    return NextResponse.json({ error: "That list has no places Vicolo can read" }, { status: 422 });
  }

  const job = await createJob(list, raw.url.trim(), { token, sandbox: raw.sandbox === true, install });
  const origin = new URL(req.url).origin;
  after(() => runChunk(job.id, origin));
  return NextResponse.json(view(job));
}
