import { NextResponse } from "next/server";
import { and, between, desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { getPlace } from "@/lib/google-places";
import { parseSourceUrl } from "@/lib/sources";
import { findPhoto } from "@/lib/photo";
import { CATEGORIES, type Category } from "@/lib/categories";

// Finding a missing photo may mean re-reading the post (5–30 s).
export const maxDuration = 60;
import { requireOwner } from "@/lib/owner";
import { isSamePlace } from "@/lib/same-place";

export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  try {
    const rows = await getDb().select().from(places).orderBy(desc(places.createdAt));
    return NextResponse.json({ places: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load places" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const raw = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  // Text fields: a string or nothing, whatever the caller sent.
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const body = {
    instagramUrl: str(raw.instagramUrl),
    placeId: str(raw.placeId),
    imageUrl: str(raw.imageUrl),
    caption: str(raw.caption),
    igLocationName: str(raw.igLocationName),
    ownerUsername: str(raw.ownerUsername),
    /** The client's read of the post failed: no second Apify run for a photo. */
    postUnreadable: raw.postUnreadable === true,
    /** Chosen by hand (the Google import's review), over the one Google's type gives. */
    category: CATEGORIES.includes(raw.category as Category) ? (raw.category as Category) : undefined,
    /** The Google list it was imported from, for the card's "why it's here". */
    fromList: listOf(raw.fromList),
  };

  // Field keeps its old name; it holds any supported link (Instagram, TikTok, Google Maps).
  const instagramUrl = parseSourceUrl(body.instagramUrl ?? "")?.url ?? null;
  if (!instagramUrl) {
    return NextResponse.json(
      { error: "That doesn't look like an Instagram, TikTok or Google Maps link" },
      { status: 400 },
    );
  }
  if (!body.placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    // The same link saved before: answered from the DB, before any paid call.
    const [known] = await db
      .select()
      .from(places)
      .where(
        or(
          eq(places.instagramUrl, instagramUrl),
          sql`${places.posts} @> ${JSON.stringify([{ instagramUrl }])}::jsonb`,
        ),
      )
      .limit(1);
    if (known) return NextResponse.json({ place: known, already: true });

    // Re-fetch by id so the stored row reflects Google's data, not the client's.
    const p = await getPlace(body.placeId, { price: true });
    // One place, many posts: a second post of a place already in the list is
    // added to that card instead of becoming a duplicate. SQL narrows it to the
    // same Google id or a box around the pin; isSamePlace makes the call.
    // The box reaches past 60 m every way: 0.001° of latitude is ~111 m, and a
    // degree of longitude shrinks with cos(latitude).
    const dLng = 0.001 / Math.max(Math.cos((p.lat * Math.PI) / 180), 0.1);
    const nearby = await db
      .select()
      .from(places)
      .where(
        or(
          eq(places.placeId, p.placeId),
          and(between(places.lat, p.lat - 0.001, p.lat + 0.001), between(places.lng, p.lng - dLng, p.lng + dLng)),
        ),
      );
    const existing = nearby.find((r) => isSamePlace(r, p));
    if (existing) {
      // The card already has its photo; the extra post keeps whatever the read brought.
      const [merged] = await db
        .update(places)
        .set({
          posts: [
            ...existing.posts,
            {
              instagramUrl,
              imageUrl: body.imageUrl || null,
              caption: body.caption || null,
              ownerUsername: body.ownerUsername || null,
              igLocationName: body.igLocationName || null,
              addedAt: new Date().toISOString(),
            },
          ],
        })
        .where(eq(places.id, existing.id))
        .returning();
      return NextResponse.json({ place: merged, merged: true });
    }

    // The photo is normally found by /api/extract; when the client has none
    // (post unreadable, manual flow), find one here so no place goes without.
    const imageUrl =
      body.imageUrl || (await findPhoto(instagramUrl, p.placeId, { postUnreadable: body.postUnreadable }));
    const [row] = await db
      .insert(places)
      .values({
        instagramUrl,
        name: p.name,
        placeId: p.placeId,
        lat: p.lat,
        lng: p.lng,
        formattedAddress: p.formattedAddress,
        country: p.country,
        city: p.city,
        region: p.region,
        primaryType: p.primaryType,
        category: body.category ?? p.category,
        priceLevel: p.priceLevel,
        imageUrl,
        caption: body.caption || null,
        igLocationName: body.igLocationName || null,
        ownerUsername: body.ownerUsername || null,
        fromList: body.fromList,
      })
      .returning();
    return NextResponse.json({ place: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save place" }, { status: 502 });
  }
}

/** { title, owner } from the import, short strings or null; anything else is dropped. */
function listOf(v: unknown): { title: string | null; owner: string | null } | null {
  if (!v || typeof v !== "object") return null;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 120) : null);
  const { title, owner } = v as Record<string, unknown>;
  return s(title) || s(owner) ? { title: s(title), owner: s(owner) } : null;
}
