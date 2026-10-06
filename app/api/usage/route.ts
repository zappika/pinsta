import { NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usage } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";
import { SERVICES, type Service } from "@/lib/usage";

/**
 * This month's paid calls for the Usage sheet. Owner-only, like /api/places.
 *
 * Google: calls counted by lib/usage.ts since the 1st (UTC), minus the free
 * allowance, times the price. An estimate: Google's month runs on Pacific time
 * and calls made before the counter existed are missing.
 * Apify: the real dollars from Apify, for its own billing cycle (it doesn't
 * start on the 1st). Only usage beyond the plan's included credit costs money.
 */
const DAYS = 30;

export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;

  const now = new Date();
  const since = `${now.toISOString().slice(0, 7)}-01`;
  const from = new Date(now.getTime() - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const [rows, apify, perDay] = await Promise.all([
    getDb()
      .select({ service: usage.service, calls: sql<number>`sum(${usage.calls})::int` })
      .from(usage)
      .where(gte(usage.day, since))
      .groupBy(usage.service),
    apifyUsage(),
    getDb()
      .select({ day: usage.day, service: usage.service, calls: usage.calls })
      .from(usage)
      .where(gte(usage.day, from)),
  ]);
  const calls = new Map(rows.map((r) => [r.service, r.calls]));

  const services = (Object.keys(SERVICES) as Service[]).map((id) => {
    const s = SERVICES[id];
    const n = calls.get(id) ?? 0;
    const cost =
      id === "apify"
        ? (apify?.billedUsd ?? 0)
        : s.per1000 === null || s.free === null
          ? 0
          : (Math.max(0, n - s.free) * s.per1000) / 1000;
    return {
      id,
      label: s.label,
      calls: n,
      free: s.free,
      freeLeft: s.free === null ? null : Math.max(0, s.free - n),
      per1000: s.per1000,
      cost,
    };
  });

  // The /usage page: the last DAYS days, every day present (zero when quiet), Apify
  // reads apart from Google calls since they run on different scales.
  const daily = Array.from({ length: DAYS }, (_, i) => ({
    day: new Date(new Date(`${from}T00:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10),
    apify: 0,
    google: 0,
  }));
  const byDay = new Map(daily.map((d) => [d.day, d]));
  for (const row of perDay) {
    const d = byDay.get(String(row.day));
    if (d) d[row.service === "apify" ? "apify" : "google"] += row.calls;
  }

  return NextResponse.json({
    since,
    daily,
    services,
    apify,
    total: services.reduce((sum, s) => sum + s.cost, 0),
  });
}

/** Month-to-date dollars from Apify itself; null when Apify can't be reached. */
async function apifyUsage() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  const get = (path: string) =>
    fetch(`https://api.apify.com/v2/users/me${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [monthly, me] = await Promise.all([get("/usage/monthly"), get("")]);
  const usd = monthly?.data?.totalUsageCreditsUsdAfterVolumeDiscount;
  if (typeof usd !== "number") return null;
  const included: number = me?.data?.plan?.monthlyUsageCreditsUsd ?? 0;
  return {
    usd,
    included,
    billedUsd: Math.max(0, usd - included),
    cycleStart: monthly.data.usageCycle?.startAt ?? null,
    cycleEnd: monthly.data.usageCycle?.endAt ?? null,
  };
}
