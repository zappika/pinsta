import { NextResponse } from "next/server";
import { desc, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { saves, type SaveDetail } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";

/**
 * How saves end on the phones (Sarp, 2026-10-16): testers rarely report a
 * miss, so the app reports every save sheet itself. POST is open like
 * /api/extract (the app has no key) and free: one small row, no paid call.
 * GET is owner-only and feeds the Saves page on the backoffice.
 */
const OUTCOMES = new Set(["auto", "picked", "searched", "many", "already", "changed", "gave_up"]);
const DAYS = 30;

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined);

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = str(body.id, 36);
  const install = str(body.install, 36);
  const outcome = str(body.outcome, 20);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !install || !outcome || !OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: "id, install and outcome are required" }, { status: 400 });
  }
  const d = (body.detail && typeof body.detail === "object" ? body.detail : {}) as Record<string, unknown>;
  // Only the known fields, each capped: the route is open.
  const detail: SaveDetail = {
    readError: str(d.readError, 200),
    source: str(d.source, 20),
    offered: int(d.offered),
    rank: int(d.rank) ?? null,
    google: d.google === true,
    listed: int(d.listed),
    saved: int(d.saved),
    step: str(d.step, 60) ?? undefined,
    place: str(d.place, 120),
    seconds: int(d.seconds),
    via: d.via === "share" ? "share" : "app",
  };
  await getDb()
    .insert(saves)
    .values({ id, install, build: int(body.build) ?? null, url: str(body.url, 500), outcome, detail })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  // ?days=90 for Pulse (first seen, coming back); 30 by default.
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || DAYS, 1), 90);
  const from = new Date(Date.now() - days * 86_400_000);
  const rows = await getDb().select().from(saves).where(gte(saves.at, from)).orderBy(desc(saves.at)).limit(5000);
  return NextResponse.json({ days, saves: rows });
}
