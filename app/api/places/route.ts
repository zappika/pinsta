import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { getPlace } from "@/lib/google-places";
import { normalizeInstagramUrl } from "@/lib/instagram";
import { findPhoto } from "@/lib/photo";

// Finding a missing photo may mean re-reading the post (5–30 s).
export const maxDuration = 60;
import { requireOwner } from "@/lib/owner";
import { isSamePlace } from "@/lib/same-place";

export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const rows = await getDb().select().from(places).orderBy(desc(places.createdAt));
  return NextResponse.json({ places: rows });
}

export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const body = (await req.json().catch(() => ({}))) as {
    instagramUrl?: string;
    placeId?: string;
    note?: string;
    imageUrl?: string | null;
    caption?: string | null;
    igLocationName?: string | null;
    ownerUsername?: string | null;
  };

  const instagramUrl = normalizeInstagramUrl(body.instagramUrl ?? "");
  if (!instagramUrl) {
    return NextResponse.json(
      { error: "That doesn't look like an Instagram post link" },
      { status: 400 },
    );
  }
  if (!body.placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  try {
    // Re-fetch by id so the stored row reflects Google's data, not the client's.
    // The photo is normally found by /api/extract; when the client has none
    // (post unreadable, manual flow), find one here so no place goes without.
    const [p, imageUrl] = await Promise.all([
      getPlace(body.placeId),
      body.imageUrl ? Promise.resolve(body.imageUrl) : findPhoto(instagramUrl, body.placeId),
    ]);
    // One place, many posts: a second post of a place already in the list is
    // added to that card instead of becoming a duplicate.
    const db = getDb();
    const existing = (await db.select().from(places)).find((r) => isSamePlace(r, p));
    if (existing) {
      const known = existing.instagramUrl === instagramUrl || existing.posts.some((x) => x.instagramUrl === instagramUrl);
      if (known) return NextResponse.json({ place: existing, already: true });
      const [merged] = await db
        .update(places)
        .set({
          posts: [
            ...existing.posts,
            {
              instagramUrl,
              imageUrl,
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
        category: p.category,
        note: body.note?.trim() || null,
        imageUrl,
        caption: body.caption || null,
        igLocationName: body.igLocationName || null,
        ownerUsername: body.ownerUsername || null,
      })
      .returning();
    return NextResponse.json({ place: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save place" }, { status: 502 });
  }
}
