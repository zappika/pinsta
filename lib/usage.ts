/**
 * Counting paid API calls, for the Usage sheet in the buddy menu.
 *
 * Google bills Places per call, per SKU, with a free allowance each month, so a
 * count per SKU is enough to estimate the bill. Apify bills compute, not calls;
 * its real month-to-date dollars come from Apify's own API (app/api/usage), and
 * the count here is only for context.
 *
 * Server-side only. A failed count never fails the call it counts.
 */
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { usage } from "./db/schema";

/** Prices as of 2026-10 (Sarp): USD per 1,000 calls, free calls a month. */
export const SERVICES = {
  apify: { label: "Instagram post reads (Apify)", per1000: null, free: null },
  "google.textSearchPro": { label: "Google Text Search Pro", per1000: 32, free: 5000 },
  "google.textSearchEnterprise": { label: "Google Text Search Enterprise", per1000: 35, free: 1000 },
  "google.detailsPro": { label: "Google Place Details Pro", per1000: 17, free: 5000 },
  "google.detailsEnterprise": { label: "Google Place Details Enterprise", per1000: 20, free: 1000 },
  "google.photos": { label: "Google Place Photos", per1000: 7, free: 1000 },
} as const;

export type Service = keyof typeof SERVICES;

/** Today in UTC, as the `date` column wants it. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function countCall(service: Service): Promise<void> {
  try {
    await getDb()
      .insert(usage)
      .values({ day: today(), service, calls: 1 })
      .onConflictDoUpdate({ target: [usage.day, usage.service], set: { calls: sql`${usage.calls} + 1` } });
  } catch (e) {
    console.warn("usage: count failed", service, e instanceof Error ? e.message : e);
  }
}
