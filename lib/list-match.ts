import { and, gte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listMatches } from "@/lib/db/schema";
import type { Category } from "@/lib/categories";
import { kmBetween } from "@/lib/geo";
import type { ListEntry } from "@/lib/google-list";
import { searchPlaces, type PlaceCandidate } from "@/lib/google-places";

/**
 * Matching a Google Maps list entry to a Google place: shared by the web's /import
 * (owner, one request) and the iOS app's server import (`lib/import-jobs.ts`).
 *
 * Google is asked as little as possible: an entry seen in the last MATCH_DAYS (this
 * list read again, or another list with the same place) reuses that match from
 * list_matches; only what's left gets a text search (Text Search Pro, 5,000 free a
 * month), biased to the entry's own pin, which the list gives exactly.
 */

/** How long a remembered match is trusted: Google lets coordinates be kept 30 days. */
const MATCH_DAYS = 30;

/**
 * The pin and address fields are what the phone needs to make a card; matches
 * remembered before 2026-10-19 lack them and are searched once more (`remembered`).
 */
export type Match = {
  placeId: string;
  name: string;
  city: string | null;
  category: Category;
  lat?: number;
  lng?: number;
  address?: string | null;
  region?: string | null;
  country?: string | null;
  primaryType?: string | null;
};

/** Name and pin to ~1 m: the same entry in any list, a moved or renamed one is new. */
export function entryKey(e: ListEntry) {
  return `${e.name.toLowerCase()}|${e.lat.toFixed(5)}|${e.lng.toFixed(5)}`;
}

/**
 * The remembered answers for these entries, by key. null = searched, nothing there.
 * `full`: only matches with a pin count (the iOS import makes cards from them).
 */
export async function remembered(entries: ListEntry[], full = false): Promise<Map<string, Match | null>> {
  if (!entries.length) return new Map();
  const rows = await getDb()
    .select()
    .from(listMatches)
    .where(
      and(
        inArray(listMatches.key, entries.map(entryKey)),
        gte(listMatches.matchedAt, new Date(Date.now() - MATCH_DAYS * 86_400_000)),
      ),
    );
  const out = new Map<string, Match | null>();
  for (const r of rows) {
    const m = r.match as Match | null;
    if (full && m && m.lat == null) continue;
    out.set(r.key, m);
  }
  return out;
}

/**
 * Searches Google for an entry and remembers the answer (a failed search isn't
 * remembered: undefined, try again next time).
 */
export async function searchAndRemember(entry: ListEntry): Promise<Match | null | undefined> {
  const match = await matchEntry(entry);
  if (match !== undefined) {
    await getDb()
      .insert(listMatches)
      .values({ key: entryKey(entry), match })
      .onConflictDoUpdate({ target: listMatches.key, set: { match, matchedAt: new Date() } })
      .catch((e) => console.warn("import: couldn't remember a match", e instanceof Error ? e.message : e));
  }
  return match;
}

/**
 * The Google place behind a list entry: searched by name at its pin. The list's
 * pin is Google's own, so the right answer is the nearest one, a few metres off.
 * Further than 150 m means Google found something else: no match, not a guess.
 * undefined = the search itself failed.
 */
async function matchEntry(entry: ListEntry): Promise<Match | null | undefined> {
  let found: PlaceCandidate[];
  try {
    found = await searchPlaces(entry.name, { lat: entry.lat, lng: entry.lng });
  } catch {
    return undefined;
  }
  const near = found
    .map((c) => ({ c, km: kmBetween(c, entry) }))
    .filter((x) => x.km <= 0.15)
    .sort((a, b) => a.km - b.km)[0]?.c;
  if (!near) return null;
  return {
    placeId: near.placeId,
    name: near.name,
    city: near.city,
    category: near.category,
    lat: near.lat,
    lng: near.lng,
    address: near.formattedAddress,
    region: near.region,
    country: near.country,
    primaryType: near.primaryType,
  };
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
