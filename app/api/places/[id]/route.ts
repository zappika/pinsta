import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { getPlace } from "@/lib/google-places";
import { requireOwner } from "@/lib/owner";
import { googlePhoto, isGooglePhoto } from "@/lib/photo";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const { id } = await params;
  const deleted = await getDb().delete(places).where(eq(places.id, id)).returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}

/** Re-select the place behind a saved post: everything from Google is replaced, the post itself stays. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { placeId?: string; removePost?: string };
  // "Wrong place?" after a merge: take that one post back off the card.
  if (body.removePost) {
    const [row] = await getDb().select().from(places).where(eq(places.id, id));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [updated] = await getDb()
      .update(places)
      .set({ posts: row.posts.filter((x) => x.instagramUrl !== body.removePost) })
      .where(eq(places.id, id))
      .returning();
    return NextResponse.json({ place: updated });
  }
  if (!body.placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }
  try {
    const [current] = await getDb().select().from(places).where(eq(places.id, id));
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // A Google photo shows the old place: the new one's replaces it. A new Blob
    // key, because the same URL would come back from caches with the old bytes.
    // The post's own image stays; it is what was shared.
    const shortcode = current.instagramUrl.split(/[/?#]/).filter(Boolean).pop()?.slice(0, 40) ?? "post";
    const [p, photo] = await Promise.all([
      getPlace(body.placeId, { price: true }),
      isGooglePhoto(current.imageUrl) && body.placeId !== current.placeId
        ? googlePhoto(body.placeId, `${shortcode}-${body.placeId.replace(/[^A-Za-z0-9]/g, "").slice(-10)}`)
        : Promise.resolve(null),
    ]);
    const [row] = await getDb()
      .update(places)
      .set({
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
        priceLevel: p.priceLevel,
        ...(photo ? { imageUrl: photo } : {}),
      })
      .where(eq(places.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ place: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not change place" }, { status: 502 });
  }
}
