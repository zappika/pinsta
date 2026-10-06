import { NextResponse } from "next/server";
import { gte, inArray, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listMatches, places } from "@/lib/db/schema";
import type { Category } from "@/lib/categories";
import { kmBetween } from "@/lib/geo";
import { ListError, readGoogleList, type ListEntry } from "@/lib/google-list";
import { searchPlaces, type PlaceCandidate } from "@/lib/google-places";
import { requireOwner } from "@/lib/owner";
import { isSamePlace } from "@/lib/same-place";

// A few hundred places at four searches at a time.
export const maxDuration = 60;

/** More than this and the review gets unwieldy (and the free Google tier thin). */
const MAX = 200;

/** How long a remembered match is trusted: Google lets coordinates be kept 30 days. */
const MATCH_DAYS = 30;

type Match = { placeId: string; name: string; city: string | null; category: Category };

/**
 * The import's first step: read a shared Google Maps list and match every entry
 * to a Google place, so the review screen can show each one's category and flag
 * what's already saved. Nothing is written; the client saves the ones Sarp
 * keeps through POST /api/places, like any other save. Owner-only.
 *
 * Google is asked as little as possible, in this order:
 *   1. an entry already in the list is matched to that card: no call;
 *   2. an entry seen in the last MATCH_DAYS (this list read again, or another
 *      list with the same place) reuses that match from list_matches: no call;
 *   3. only what's left gets a text search (Google Text Search Pro, 5,000 free
 *      a month), biased to the entry's own pin, which the list gives exactly.
 */
export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const raw = ((await req.json().catch(() => null)) ?? {}) as { url?: unknown };
  if (typeof raw.url !== "string" || !raw.url.trim()) {
    return NextResponse.json({ error: "Paste the link of a shared list" }, { status: 400 });
  }

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

  const db = getDb();
  const entries = list.entries.slice(0, MAX);
  const keys = entries.map(entryKey);
  const [saved, remembered] = await Promise.all([
    db
      .select({ id: places.id, placeId: places.placeId, name: places.name, lat: places.lat, lng: places.lng, city: places.city, category: places.category })
      .from(places),
    db
      .select()
      .from(listMatches)
      .where(and(inArray(listMatches.key, keys), gte(listMatches.matchedAt, new Date(Date.now() - MATCH_DAYS * 86_400_000)))),
  ]);
  const memory = new Map(remembered.map((r) => [r.key, r.match as Match | null]));

  let searched = 0;
  const items = await mapLimit(entries, 4, async (entry, i) => {
    // 1. Already a card: the entry's own name and pin are enough to tell.
    const own = saved.find((s) => isSamePlace(s, { placeId: null, ...entry }));
    if (own) {
      const match: Match = { placeId: own.placeId, name: own.name, city: own.city, category: (own.category ?? "Other") as Category };
      return { ...entry, match, savedId: own.id };
    }
    // 2. Seen before.
    let match: Match | null | undefined = memory.has(keys[i]) ? memory.get(keys[i]) : undefined;
    // 3. Ask Google, and remember the answer (a failed search isn't remembered).
    if (match === undefined) {
      searched++;
      match = await matchEntry(entry);
      if (match !== undefined) {
        await db
          .insert(listMatches)
          .values({ key: keys[i], match })
          .onConflictDoUpdate({ target: listMatches.key, set: { match, matchedAt: new Date() } })
          .catch((e) => console.warn("import: couldn't remember a match", e instanceof Error ? e.message : e));
      }
    }
    // A match can still be a card under another name (Google's name vs the list's).
    const probe = match && { placeId: match.placeId, name: match.name, lat: entry.lat, lng: entry.lng };
    const existing = probe ? saved.find((s) => isSamePlace(s, probe)) : undefined;
    return { ...entry, match: match ?? null, savedId: existing?.id ?? null };
  });

  return NextResponse.json({ title: list.title, owner: list.owner, total: list.entries.length, searched, items });
}

/** Name and pin to ~1 m: the same entry in any list, a moved or renamed one is new. */
function entryKey(e: ListEntry) {
  return `${e.name.toLowerCase()}|${e.lat.toFixed(5)}|${e.lng.toFixed(5)}`;
}

/**
 * The Google place behind a list entry: searched by name at its pin. The list's
 * pin is Google's own, so the right answer is the nearest one, a few metres off.
 * Further than 150 m means Google found something else: no match, not a guess.
 * undefined = the search itself failed (try again next time, don't remember).
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
  return near ? { placeId: near.placeId, name: near.name, city: near.city, category: near.category } : null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
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
