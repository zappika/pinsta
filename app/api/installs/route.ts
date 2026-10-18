import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { installs } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";

/**
 * Names for the reporting phones (Pulse on the backoffice). Owner-only both ways:
 * the phones never see or send these. POST sets one phone's label and/or `me`.
 */
export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  return NextResponse.json({ installs: await getDb().select().from(installs) });
}

export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const install = typeof body.install === "string" && /^[0-9a-f-]{36}$/i.test(body.install) ? body.install : null;
  if (!install) return NextResponse.json({ error: "install is required" }, { status: 400 });
  const set: { label?: string | null; me?: boolean } = {};
  if ("label" in body) set.label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 40) : null;
  if (typeof body.me === "boolean") set.me = body.me;
  await getDb()
    .insert(installs)
    .values({ install, ...set })
    .onConflictDoUpdate({ target: installs.install, set: Object.keys(set).length ? set : { install } });
  return NextResponse.json({ ok: true });
}
