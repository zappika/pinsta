import { NextResponse } from "next/server";
import { isVenue, nearbyPlaces } from "@/lib/google-places";
import { requireOwner } from "@/lib/owner";

/** "Around you" in the save sheet: the places within ~150 m of { lat, lng }, closest first. */
export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const { lat, lng } = ((await req.json().catch(() => null)) ?? {}) as { lat?: unknown; lng?: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  try {
    const candidates = (await nearbyPlaces({ lat, lng })).filter((c) => isVenue(c)).slice(0, 6);
    return NextResponse.json({ candidates });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nearby search failed" }, { status: 502 });
  }
}
