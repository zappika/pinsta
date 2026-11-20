// Apple Maps Server API search, the same data the iOS app gets from MapKit, but on the server: a fix
// to the search then reaches every phone on deploy instead of with the next build (Sarp, 2026-11-17).
// Free up to 25,000 calls a day per team (shared with MapKit JS). One key, "Vicolo Maps" (Maps + APNs):
// APPLE_MAPS_KEY (the .p8's contents), APPLE_MAPS_KEY_ID, APPLE_TEAM_ID.
import { createPrivateKey, sign } from "node:crypto";
import { categorize } from "@/lib/categories";
import type { PlaceCandidate } from "@/lib/google-places";

const API = "https://maps-api.apple.com/v1";

let token: { value: string; until: number } | null = null;

/** A signed JWT buys a 30-minute access token; kept until a minute before it runs out. */
async function accessToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const pem = process.env.APPLE_MAPS_KEY?.replace(/\\n/g, "\n");
  const kid = process.env.APPLE_MAPS_KEY_ID;
  const iss = process.env.APPLE_TEAM_ID;
  if (!pem || !kid || !iss) throw new Error("Apple Maps key missing (APPLE_MAPS_KEY, APPLE_MAPS_KEY_ID, APPLE_TEAM_ID)");
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: "ES256", kid, typ: "JWT" })}.${b64({ iss, iat: now, exp: now + 3600 })}`;
  const sig = sign("sha256", Buffer.from(head), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" }).toString("base64url");
  const res = await fetch(`${API}/token`, { headers: { Authorization: `Bearer ${head}.${sig}` } });
  if (!res.ok) throw new Error(`Apple Maps token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { accessToken: string; expiresInSeconds: number };
  token = { value: data.accessToken, until: Date.now() + (data.expiresInSeconds - 60) * 1000 };
  return data.accessToken;
}

type AppleResult = {
  id?: string;
  name?: string;
  coordinate?: { latitude: number; longitude: number };
  formattedAddressLines?: string[];
  country?: string;
  countryCode?: string;
  poiCategory?: string;
  structuredAddress?: { locality?: string; administrativeArea?: string; subLocality?: string };
};

/** "NationalPark" → "national_park": Apple's categories read like Google's types for `categorize` and `isVenue`. */
const snake = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

function toCandidate(r: AppleResult): PlaceCandidate {
  const type = r.poiCategory ? snake(r.poiCategory) : null;
  return {
    placeId: r.id ?? `apple:${r.coordinate?.latitude},${r.coordinate?.longitude}`,
    name: r.name ?? r.formattedAddressLines?.[0] ?? "Unnamed place",
    formattedAddress: r.formattedAddressLines?.join(", ") ?? null,
    lat: r.coordinate?.latitude ?? 0,
    lng: r.coordinate?.longitude ?? 0,
    primaryType: type,
    category: categorize(type),
    country: r.country ?? null,
    city: r.structuredAddress?.locality ?? r.structuredAddress?.administrativeArea ?? null,
    region: r.structuredAddress?.administrativeArea ?? null,
    website: null,
    priceLevel: null,
  };
}

/**
 * A text search, nudged toward `near` when given. Venues only, or with `address` streets and towns only:
 * the phone asks MapKit the same way (PlaceSearch.search / .locate). Asking for both, "Rue de la Roquette"
 * found a bar in Fujisawa and The Blue Moon in Paris was dropped as too far from it.
 */
export async function searchApple(query: string, near?: { lat: number; lng: number } | null, address = false): Promise<PlaceCandidate[]> {
  const params = new URLSearchParams({ q: query, lang: "en-US", resultTypeFilter: address ? "Address" : "Poi" });
  if (near) params.set("searchLocation", `${near.lat},${near.lng}`);
  const res = await fetch(`${API}/search?${params}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) throw new Error(`Apple Maps search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { results?: AppleResult[] };
  return (data.results ?? []).slice(0, 6).map(toCandidate);
}
