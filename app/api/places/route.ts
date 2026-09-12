import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { getPlace } from "@/lib/google-places";
import { normalizeInstagramUrl } from "@/lib/instagram";

export async function GET() {
  const rows = await getDb().select().from(places).orderBy(desc(places.createdAt));
  return NextResponse.json({ places: rows });
}

export async function POST(req: Request) {
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
    const p = await getPlace(body.placeId);
    const [row] = await getDb()
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
        imageUrl: body.imageUrl || null,
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
