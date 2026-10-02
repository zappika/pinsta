import { NextResponse } from "next/server";
import { findPriceLevel } from "@/lib/google-places";

/**
 * The iOS app finds places with MapKit, which has no price. After a save it
 * asks here once: Google is searched for the name around the pin, and the
 * price level of the match within 150 m comes back (or null).
 *
 * Open like /api/extract, so it spends Sarp's Google quota for friends too:
 * one Text Search (Enterprise tier, 1,000 free a month) per food or drink save.
 * Each call is logged as "price lookup" so the count shows in Vercel's logs.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; lat?: number; lng?: number };
  const name = body.name?.trim().slice(0, 120);
  if (!name || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "name, lat and lng are required" }, { status: 400 });
  }
  console.log("price lookup");
  try {
    return NextResponse.json({ priceLevel: await findPriceLevel(name, { lat: body.lat, lng: body.lng }) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ priceLevel: null });
  }
}
