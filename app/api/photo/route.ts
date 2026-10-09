import { NextResponse } from "next/server";
import { googlePhotoNear } from "@/lib/photo";

/**
 * A photo for a place the iOS app imported from a Google list (it has no post):
 * Google's own place at that name and pin, its first photo, copied to our Blob.
 * Only the photo itself is paid (Place Photos, 1,000 free a month); finding the
 * place asks for ids only. Open, like /api/price. imageUrl null = Google has none.
 */
export async function POST(req: Request) {
  const body = ((await req.json().catch(() => null)) ?? {}) as { name?: unknown; lat?: unknown; lng?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "name, lat and lng are required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ imageUrl: await googlePhotoNear(name, body.lat, body.lng) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Photo lookup failed" }, { status: 502 });
  }
}
