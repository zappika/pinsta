import { after, NextResponse } from "next/server";
import { getJob, runChunk, stalled, view } from "@/lib/import-jobs";

export const maxDuration = 60;

/**
 * An import job's progress (`done` of `total`), and its entries with their matches once
 * `status` is "ready". A job whose chunks stopped is started again from here, so the
 * phone's poll is also the safety net. Open: the id is a random uuid.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No such import" }, { status: 404 });
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "No such import" }, { status: 404 });
  if (stalled(job)) {
    const origin = new URL(req.url).origin;
    after(() => runChunk(id, origin));
  }
  return NextResponse.json(view(job));
}
