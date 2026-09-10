/**
 * Thin server-side wrapper around Google Places API (New).
 * Never import this from a client component — it uses the secret key.
 */
import { categorize, type Category } from "./categories";

const KEY = () => {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  return k;
};

const FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "addressComponents",
].join(",");

type AddressComponent = { longText: string; types: string[] };

type RawPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  addressComponents?: AddressComponent[];
};

export type PlaceCandidate = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  category: Category;
  country: string | null;
  city: string | null;
};

function pick(components: AddressComponent[] | undefined, ...types: string[]) {
  if (!components) return null;
  for (const t of types) {
    const c = components.find((x) => x.types.includes(t));
    if (c) return c.longText;
  }
  return null;
}

function toCandidate(p: RawPlace): PlaceCandidate {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed place",
    formattedAddress: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    primaryType: p.primaryType ?? null,
    category: categorize(p.primaryType),
    country: pick(p.addressComponents, "country"),
    // Google has no single "city" field; walk down from most to least specific.
    city: pick(
      p.addressComponents,
      "locality",
      "postal_town",
      "administrative_area_level_3",
      "administrative_area_level_2",
      "administrative_area_level_1",
    ),
  };
}

export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY(),
      "X-Goog-FieldMask": FIELDS.split(",")
        .map((f) => `places.${f}`)
        .join(","),
    },
    body: JSON.stringify({ textQuery: query, pageSize: 6 }),
  });
  if (!res.ok) {
    throw new Error(`Places search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map(toCandidate);
}

export async function getPlace(placeId: string): Promise<PlaceCandidate> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": FIELDS },
    },
  );
  if (!res.ok) {
    throw new Error(`Place details failed: ${res.status} ${await res.text()}`);
  }
  return toCandidate((await res.json()) as RawPlace);
}
