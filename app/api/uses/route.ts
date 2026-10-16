import { NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { uses } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";

/**
 * How the app is used: views picked, seconds on each screen, opens (Sarp, 2026-10-16).
 * POST is open like /api/saves (the app has no key) and free: a few small rows a day per
 * phone. The phone sends a day's running totals, so the larger count wins. GET is
 * owner-only and feeds the backoffice Saves page.
 */
const DAYS = 30;
const EVENT = /^[a-z]{1,10}(\.[a-z]{1,12})?$/;

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const install = typeof body.install === "string" && /^[0-9a-f-]{36}$/i.test(body.install) ? body.install : null;
  const day = typeof body.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : null;
  const counts = body.counts && typeof body.counts === "object" ? (body.counts as Record<string, unknown>) : null;
  // A day in the last month or tomorrow at most (time zones): an old or odd one is refused for good.
  const age = day ? (Date.now() - Date.parse(day)) / 86_400_000 : NaN;
  if (!install || !day || !counts || !(age > -2 && age < DAYS + 1)) {
    return NextResponse.json({ error: "install, day and counts are required" }, { status: 400 });
  }
  const build = typeof body.build === "number" && Number.isInteger(body.build) ? body.build : null;
  const rows = Object.entries(counts)
    .filter(([event, n]) => EVENT.test(event) && typeof n === "number" && Number.isFinite(n) && n >= 0)
    .slice(0, 30)
    .map(([event, n]) => ({ day, install, event, build, count: Math.min(Math.round(n as number), 1_000_000) }));
  if (rows.length) {
    await getDb()
      .insert(uses)
      .values(rows)
      .onConflictDoUpdate({
        target: [uses.day, uses.install, uses.event],
        set: { count: sql`greatest(${uses.count}, excluded.count)`, build: sql`excluded.build` },
      });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const from = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  const rows = await getDb().select().from(uses).where(gte(uses.day, from)).limit(5000);
  return NextResponse.json({ days: DAYS, uses: rows });
}
