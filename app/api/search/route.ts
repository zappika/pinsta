import { NextResponse } from "next/server";
import { isNear, isVenue, searchPlaces, type PlaceCandidate } from "@/lib/google-places";
import { callsToday, countCall } from "@/lib/usage";

/**
 * Google, for when Apple Maps doesn't know the place. The iOS app finds places with
 * MapKit; Apple lags on new openings (BATA, Stockholm, 2026-10-14), which are what
 * people save from Instagram. When MapKit finds nothing, the app asks here with the
 * same clues (up to three queries, near a street when the post had one).
 *
 * Open like /api/extract and /api/price, so it spends Sarp's Google quota for
 * friends: capped at FALLBACK_DAILY queries a day across everyone (Usage → "iOS
 * searches Apple Maps missed"), each also counted as a Text Search Pro.
 */
const FALLBACK_DAILY = 200;

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => null)) ?? {}) as { queries?: unknown; near?: { lat?: unknown; lng?: unknown } };
  const queries = (Array.isArray(body.queries) ? body.queries : [])
    .filter((q): q is string => typeof q === "string" && q.trim().length >= 3)
    .map((q) => q.trim().slice(0, 120))
    .slice(0, 3);
  if (!queries.length) return NextResponse.json({ error: "queries are required" }, { status: 400 });
  const near =
    typeof body.near?.lat === "number" && typeof body.near?.lng === "number" ? { lat: body.near.lat, lng: body.near.lng } : null;

  if ((await callsToday("fallback")) + queries.length > FALLBACK_DAILY) {
    // Not an error to show: the app just keeps Apple's (empty) answer.
    return NextResponse.json({ candidates: [], capped: true });
  }
  await Promise.all(queries.map(() => countCall("fallback")));
  const results = await Promise.all(
    queries.map(async (q) =>
      (await searchPlaces(q, near).catch(() => [] as PlaceCandidate[])).filter((c) => isVenue(c, q) && isNear(c, near)),
    ),
  );
  const seen = new Set<string>();
  const candidates = results.flatMap((r) => r.slice(0, 3)).filter((c) => !seen.has(c.placeId) && seen.add(c.placeId));
  return NextResponse.json({ candidates: candidates.slice(0, 4) });
}
