import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { kmBetween } from "@/lib/geo";
import { ListError, readGoogleList, type ListEntry } from "@/lib/google-list";
import { searchPlaces, type PlaceCandidate } from "@/lib/google-places";
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
 * One text search per entry (Google Text Search Pro, 5,000 free a month),
 * biased to the entry's own pin, which the list gives us exactly.
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

  const entries = list.entries.slice(0, MAX);
  const saved = await getDb().select({ id: places.id, placeId: places.placeId, name: places.name, lat: places.lat, lng: places.lng }).from(places);

  const items = await mapLimit(entries, 4, async (entry) => {
    const match = await matchEntry(entry);
    const probe = match ?? { placeId: null, name: entry.name, lat: entry.lat, lng: entry.lng };
    const existing = saved.find((s) => isSamePlace(s, probe));
    return { ...entry, match, savedId: existing?.id ?? null };
  });

  return NextResponse.json({ title: list.title, total: list.entries.length, items });
}

/**
 * The Google place behind a list entry: searched by name at its pin. The list's
 * pin is Google's own, so the right answer is the nearest one, a few metres off.
 * Further than 150 m means Google found something else: no match, not a guess.
 */
async function matchEntry(entry: ListEntry): Promise<PlaceCandidate | null> {
  const found = await searchPlaces(entry.name, { lat: entry.lat, lng: entry.lng }).catch(() => [] as PlaceCandidate[]);
  const near = found
    .map((c) => ({ c, km: kmBetween(c, entry) }))
    .filter((x) => x.km <= 0.15)
    .sort((a, b) => a.km - b.km);
  return near[0]?.c ?? null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
