import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { reviewCases, reviews } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";

/**
 * /review on the backoffice (Sarp, 2026-11-01): what the weekly reviewer on Sarp's Mac found
 * (`scripts/review/`, it writes straight to the database), and the regression set it replays.
 * Owner-only. PATCH answers a case: the place a gave-up post shows, or "-" to skip it.
 */
export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const db = getDb();
  const [list, cases] = await Promise.all([
    db.select().from(reviews).orderBy(desc(reviews.at)).limit(12),
    db.select({ url: reviewCases.url, expect: reviewCases.expect, outcome: reviewCases.outcome, note: reviewCases.note, addedAt: reviewCases.addedAt }).from(reviewCases).orderBy(desc(reviewCases.addedAt)),
  ]);
  return NextResponse.json({ reviews: list, cases });
}

export async function PATCH(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const body = ((await req.json().catch(() => null)) ?? {}) as { url?: unknown; expect?: unknown };
  if (typeof body.url !== "string" || typeof body.expect !== "string") return NextResponse.json({ error: "url and expect" }, { status: 400 });
  const expect = body.expect.trim().slice(0, 120) || null;
  await getDb().update(reviewCases).set({ expect }).where(eq(reviewCases.url, body.url));
  return NextResponse.json({ ok: true });
}
