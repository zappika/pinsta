import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { getPlace } from "@/lib/google-places";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { placeId?: string };
  if (!body.placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }
  try {
    const p = await getPlace(body.placeId);
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
