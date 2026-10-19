import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import type { Category } from "@/lib/categories";
import { ListError, readGoogleList } from "@/lib/google-list";
import { entryKey, mapLimit, remembered, searchAndRemember, type Match } from "@/lib/list-match";
import { requireOwner } from "@/lib/owner";
import { isSamePlace } from "@/lib/same-place";

// A few hundred places at four searches at a time.
export const maxDuration = 60;

/** More than this and the review gets unwieldy (and the free Google tier thin). */
const MAX = 200;


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
  const [saved, memory] = await Promise.all([
    db
      .select({ id: places.id, placeId: places.placeId, name: places.name, lat: places.lat, lng: places.lng, city: places.city, category: places.category })
      .from(places),
    remembered(entries),
  ]);

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
      match = await searchAndRemember(entry);
    }
    // A match can still be a card under another name (Google's name vs the list's).
    const probe = match && { placeId: match.placeId, name: match.name, lat: entry.lat, lng: entry.lng };
    const existing = probe ? saved.find((s) => isSamePlace(s, probe)) : undefined;
    return { ...entry, match: match ?? null, savedId: existing?.id ?? null };
  });

  return NextResponse.json({ title: list.title, owner: list.owner, total: list.entries.length, searched, items });
}

