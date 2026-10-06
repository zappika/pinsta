/**
 * Thin server-side wrapper around Google Places API (New).
 * Never import this from a client component — it uses the secret key.
 */
import { categorize, type Category } from "./categories";
import { countCall } from "./usage";

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

/**
 * `priceLevel` moves a call to Google's Enterprise tier (1,000 free a month, then
 * about $20 per 1,000), so only the one detail call per save asks for it; the
 * many searches behind the candidates stay on the cheaper tier.
 */
const PRICE_FIELD = "priceLevel";
/** The venue's own website, often its Instagram profile. Same Enterprise tier as the
 * price, so it rides along on that one call for free; never on the searches. */
const WEBSITE_FIELD = "websiteUri";

/** Google's price enum → how many $ to show. Free and unspecified show nothing. */
const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function toPriceLevel(raw: string | undefined | null): number | null {
  return (raw && PRICE_LEVELS[raw]) || null;
}

type AddressComponent = { longText?: string; types?: string[] };

type RawPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  addressComponents?: AddressComponent[];
  priceLevel?: string;
  websiteUri?: string;
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
  /** The venue's website, only on the price call (see WEBSITE_FIELD). */
  website: string | null;
  /** 1–4 ($ to $), only when asked for (see PRICE_FIELD) and Google knows it. */
  priceLevel: number | null;
};

function pick(components: AddressComponent[] | undefined, ...types: string[]) {
  if (!components) return null;
  for (const t of types) {
    const c = components.find((x) => x.types?.includes(t));
    if (c?.longText) return c.longText;
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
    priceLevel: toPriceLevel(p.priceLevel),
    website: p.websiteUri ?? null,
  };
}

export async function searchPlaces(query: string, near?: { lat: number; lng: number } | null): Promise<PlaceCandidate[]> {
  const counted = countCall("google.textSearchPro");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY(),
      "X-Goog-FieldMask": FIELDS.split(",")
        .map((f) => `places.${f}`)
        .join(","),
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 6,
      languageCode: "en",
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 2000 } } } : {}),
    }),
  });
  await counted;
  if (!res.ok) {
    throw new Error(`Places search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map(toCandidate);
}

/** `price`: also ask for the price level (Enterprise tier). Only on save. */
export async function getPlace(placeId: string, opts: { price?: boolean } = {}): Promise<PlaceCandidate> {
  const [res] = await Promise.all([
    fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": opts.price ? `${FIELDS},${PRICE_FIELD},${WEBSITE_FIELD}` : FIELDS },
    }),
    countCall(opts.price ? "google.detailsEnterprise" : "google.detailsPro"),
  ]);
  if (!res.ok) {
    throw new Error(`Place details failed: ${res.status} ${await res.text()}`);
  }
  return toCandidate((await res.json()) as RawPlace);
}


/**
 * The price level of the place named `name` at `at`, for the iOS app (MapKit
 * has no price). One Text Search around the pin; only a result within 150 m
 * counts, so a namesake across town never lends its price.
 */
export async function findPriceLevel(name: string, at: { lat: number; lng: number }): Promise<number | null> {
  const counted = countCall("google.textSearchEnterprise");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY(),
      "X-Goog-FieldMask": `places.location,places.${PRICE_FIELD}`,
    },
    body: JSON.stringify({
      textQuery: name,
      pageSize: 3,
      locationBias: { circle: { center: { latitude: at.lat, longitude: at.lng }, radius: 300 } },
    }),
  });
  await counted;
  if (!res.ok) throw new Error(`Price search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { places?: RawPlace[] };
  const near = (data.places ?? []).find((p) => p.location && metersBetween(at, p.location) <= 150);
  return toPriceLevel(near?.priceLevel);
}

function metersBetween(a: { lat: number; lng: number }, b: { latitude: number; longitude: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.latitude - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.lng) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(h));
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
  /** More queries to merge in (e.g. TikTok gives the tagged place's city). */
  extraQueries?: string[];
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
  for (const q of input.extraQueries ?? []) if (q.trim()) queries.add(q.trim());

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

/**
 * No location tag: fall back to the account that posted. A venue's own account
 * is named like the venue ("Les Œillets", @lesoeillets.paris) — a blogger's is
 * not, so these are suggestions to tap, never to auto-save.
 */
export async function resolveAccount(input: {
  ownerFullName?: string | null;
  ownerUsername?: string | null;
}): Promise<PlaceCandidate[]> {
  const queries = new Set<string>();
  const full = input.ownerFullName?.trim();
  if (full && full.length > 2) queries.add(full);
  const handle = input.ownerUsername?.replace(/[._-]+/g, " ").trim();
  if (handle && handle.length > 2) queries.add(handle);
  if (queries.size === 0) return [];

  const results = await Promise.all(
    [...queries].map((q) => searchPlaces(q).catch(() => [] as PlaceCandidate[])),
  );
  const seen = new Set<string>();
  const merged: PlaceCandidate[] = [];
  for (const list of results) {
    for (const c of list) {
      if (!seen.has(c.placeId)) {
        seen.add(c.placeId);
        merged.push(c);
      }
    }
  }
  // Only places that share a real word with the account: "jecca" must not suggest "JEC Arquitectura".
  const nameWords = [...words(full ?? ""), ...words(input.ownerUsername ?? "")];
  return merged.filter((c) => overlaps(words(c.name), nameWords));
}

/**
 * No tag: look for the place in the caption the way people write it —
 * "dinner at Cal Pep in Barcelona", "brunch @ Burro Cafe". A run of
 * capitalised words after at/@/en/à/på/bei, plus the city after "in" when
 * there is one. Plain pattern matching; suggestions only, never auto-saved.
 */
export function captionPlaceQuery(caption: string | null | undefined): string | null {
  if (!caption) return null;
  const cap = String.raw`[\p{Lu}\d][\p{L}\d'’&.-]*`;
  const re = new RegExp(String.raw`(?:^|\s)(?:at|@|en|à|på|bei)\s+(${cap}(?:\s+(?:de|del|la|le|du|of|the|&|${cap}))*)(?:\s+in\s+(${cap}(?:\s+${cap})*))?`, "u");
  const m = caption.match(re);
  if (!m) return null;
  const place = m[1].replace(/[.,!]+$/, "").trim();
  if (place.length < 3 || /^(the|my|our|this)$/i.test(place)) return null;
  return m[2] ? `${place} ${m[2].replace(/[.,!]+$/, "")}` : place;
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
