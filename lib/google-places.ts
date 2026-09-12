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
  region: string | null;
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
    region: pick(p.addressComponents, "administrative_area_level_1"),
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
    body: JSON.stringify({ textQuery: query, pageSize: 6, languageCode: "en" }),
  });
  if (!res.ok) {
    throw new Error(`Places search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map(toCandidate);
}

export async function getPlace(placeId: string): Promise<PlaceCandidate> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
    {
      headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": FIELDS },
    },
  );
  if (!res.ok) {
    throw new Error(`Place details failed: ${res.status} ${await res.text()}`);
  }
  return toCandidate((await res.json()) as RawPlace);
}


/**
 * Turn an Instagram location tag into place candidates.
 *
 * The tag alone often isn't enough: "Boreal" is tagged, but Google knows it as
 * "Restaurant Boreal". So several cheap queries run together and the results
 * are merged, with names that actually contain the tag ranked first:
 *   1. the tag as written
 *   2. the account's display name, when it overlaps with the tag
 *      (a venue's own account is usually named exactly like its Google entry)
 *   3. the tag + a category word found in the caption or hashtags
 *      ("restaurant", "bar", "bakery", …)
 *   4. the tag + a city named in the hashtags (#helsinki)
 * No LLM, no extra scrape: a handful of text searches Google already gives us.
 */
export async function resolveTag(input: {
  tag: string;
  ownerFullName?: string | null;
  caption?: string | null;
  hashtags?: string[];
  cityHints?: string[];
}): Promise<PlaceCandidate[]> {
  const tag = input.tag.trim();
  const tagWords = words(tag);
  const queries = new Set<string>([tag]);

  const full = input.ownerFullName?.trim();
  if (full && full.toLowerCase() !== tag.toLowerCase() && overlaps(words(full), tagWords)) {
    queries.add(full);
  }

  const text = `${input.caption ?? ""} ${(input.hashtags ?? []).join(" ")} ${full ?? ""}`.toLowerCase();
  const kind = CATEGORY_WORDS.find((w) => text.includes(w));
  if (kind && !tag.toLowerCase().includes(kind)) queries.add(`${tag} ${kind}`);

  const city = (input.hashtags ?? [])
    .map((h) => h.toLowerCase())
    .find((h) => (input.cityHints ?? []).map((c) => c.toLowerCase().replace(/\s+/g, "")).includes(h));
  if (city) queries.add(`${tag} ${city}`);

  const results = await Promise.all(
    [...queries].map((q) => searchPlaces(q).catch(() => [] as PlaceCandidate[])),
  );

  const seen = new Set<string>();
  const merged: PlaceCandidate[] = [];
  for (const list of results) {
    for (const c of list) {
      if (seen.has(c.placeId)) continue;
      seen.add(c.placeId);
      merged.push(c);
    }
  }
  // Names that contain the tag first, then everything else in Google's order.
  const score = (c: PlaceCandidate) => {
    const n = c.name.toLowerCase();
    if (n === tag.toLowerCase()) return 0;
    if (n.includes(tag.toLowerCase())) return 1;
    if (overlaps(words(c.name), tagWords)) return 2;
    return 3;
  };
  return merged.sort((a, b) => score(a) - score(b));
}

const CATEGORY_WORDS = [
  "restaurant", "ristorante", "restaurang", "bistro", "brasserie", "trattoria", "osteria", "taverna",
  "bar", "cocktail", "wine bar", "vinbar", "pub",
  "cafe", "café", "coffee", "kaffe", "kahvila",
  "bakery", "bageri", "boulangerie", "pastry", "konditori",
  "hotel", "hostel", "guesthouse", "b&b",
  "vineyard", "vingård", "winery",
  "museum", "gallery", "galleri",
  "shop", "store", "boutique", "butik",
  "beach", "park", "spa",
];

function words(s: string) {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
}
function overlaps(a: string[], b: string[]) {
  return a.some((w) => b.includes(w));
}
