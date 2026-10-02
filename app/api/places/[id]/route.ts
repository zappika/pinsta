import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { getPlace } from "@/lib/google-places";
import { requireOwner } from "@/lib/owner";

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
    const p = await getPlace(body.placeId, { price: true });
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
