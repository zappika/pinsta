import { after, NextResponse } from "next/server";
import { runChunk } from "@/lib/import-jobs";

export const maxDuration = 60;

/**
 * The next chunk of an import job, called by the one before it. Answers at once and
 * matches in `after()`, so no function waits on another. Calling it for a job that a
 * chunk already holds, or that is done, does nothing (the lease in `runChunk`).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No such import" }, { status: 404 });
  const origin = new URL(req.url).origin;
  after(() => runChunk(id, origin));
  return NextResponse.json({ ok: true }, { status: 202 });
}
