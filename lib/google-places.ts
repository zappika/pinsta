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
  ownerUsername?: string | null;
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

  // The handle too: "restaurangvra" says restaurant when nothing else does.
  const text = `${input.caption ?? ""} ${(input.hashtags ?? []).join(" ")} ${full ?? ""} ${input.ownerUsername ?? ""}`.toLowerCase();
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
  // A result in a town named like the tag matched the town, not the venue ("VRÅ" → Vrå, Denmark).
  return merged
    .filter((c) => isVenue(c, tag) && fold(c.city ?? "") !== fold(tag))
    .sort((a, b) => score(a) - score(b));
}

/**
 * No location tag: fall back to the account that posted. A venue's own account
 * is named like the venue ("Les Œillets", @lesoeillets.paris) — a blogger's is
 * not, so these are suggestions to tap, never to auto-save.
 */
export async function resolveAccount(input: {
  ownerFullName?: string | null;
  ownerUsername?: string | null;
  /** The post is tagged with a town, not a place: search the account there. */
  town?: string | null;
  /** The post is tagged with a street: search around it, drop what's far. */
  near?: { lat: number; lng: number } | null;
}): Promise<PlaceCandidate[]> {
  const queries = new Set<string>();
  const full = input.ownerFullName?.trim();
  if (full && full.length > 2) queries.add(full);
  const handle = input.ownerUsername?.replace(/[._-]+/g, " ").trim();
  if (handle && handle.length > 2) queries.add(handle);
  const split = handleWithCity(input.ownerUsername);
  if (split) queries.add(split);
  const kindSplit = handleWithKind(input.ownerUsername);
  if (kindSplit) queries.add(kindSplit);
  if (input.town) for (const q of [...queries]) if (q !== split) queries.add(`${q} ${input.town}`);
  if (queries.size === 0) return [];
  // A city glued to the handle pins the search there ("batasthlm": Bata the shoe shop in Spain is not it).
  const handleCity = split?.split(" ").pop() ?? null;
  const near = input.near ?? (handleCity ? await locate(handleCity) : null);

  const results = await Promise.all(
    [...queries].map((q) => searchPlaces(q, near).catch(() => [] as PlaceCandidate[])),
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
  // A handle glues the words together ("richterholtermann"): a long name word inside it counts too.
  // The handle's city is where, not who: "Stockholm University" doesn't match @batasthlm.
  const cityWords = words(handleCity ?? "");
  // "restaurangvra" names "vra"; the "restaurang" part names nothing.
  const nameWords = [...words(full ?? ""), ...words(input.ownerUsername ?? ""), ...words(split ?? ""), ...words(kindSplit ?? "")].filter(
    (w) => !cityWords.includes(w) && !CATEGORY_WORDS.includes(w),
  );
  const glued = (input.ownerUsername ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  // The city glued to the handle ("batasthlm" → Stockholm) and a name exactly the account's rank first:
  // the untagged Bata post put a Barcelona uniform shop ahead of BATA (2026-10-14).
  const exact = new Set([full, input.ownerUsername].filter(Boolean).map((n) => letters(n!)));
  const rank = (c: PlaceCandidate) =>
    (handleCity && c.city?.toLowerCase() === handleCity.toLowerCase() ? 0 : 2) + (exact.has(letters(c.name)) ? 0 : 1);
  return merged
    .filter(
      (c) =>
        isVenue(c) &&
        isNear(c, near) &&
        (overlaps(words(c.name), nameWords) || words(c.name).some((w) => w.length >= 4 && glued.includes(w))),
    )
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

function letters(s: string) {
  return fold(s).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** For comparing names: case, accents and maths letters away. "VRÅ" = "vra" (@restaurangvra), 𝐁𝐀𝐓𝐀 = bata. */
function fold(s: string) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * A profile is one venue: keep the candidates named like the account, and of its kind
 * when the account says ("Restaurant", "Art Gallery" ↔ restaurant, art_gallery). Drops
 * the Bata shoe shop for BATA the tavern, Vraa Slotshotel for VRÅ. Same rule in AddPlaceView.swift.
 */
export function profileMatches(cs: PlaceCandidate[], p: { fullName: string | null; username: string | null; category: string | null }) {
  const names = [...words(p.fullName ?? ""), ...words(p.username ?? "")];
  const glued = letters(p.username ?? "");
  const named = cs.filter((c) => overlaps(words(c.name), names) || words(c.name).some((w) => w.length >= 3 && glued.includes(w)));
  const kind = words(p.category ?? "");
  const sameKind = named.filter((c) => kind.length > 0 && kind.every((w) => (c.primaryType ?? "").includes(w)));
  return sameKind.length ? sameKind : named;
}

const REGION_NAMES = (() => {
  const names = new Set(["usa", "uk", "uae", "england", "scotland", "italia", "españa", "deutschland", "sverige", "danmark", "türkiye"]);
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    const name = display.of(code);
    if (name && name !== code) names.add(name.toLowerCase());
  }
  return names;
})();

/**
 * A location tag that names a town, not a place: "Ostuni, Puglia, Italy", "Paris, France".
 * Three or more parts, or two ending in a country. Returns the town; null for a place tag
 * ("Bar Brutal", "Septime, Paris" keeps its name). Same rule in PlaceSearch.swift.
 */
export function areaOfTag(tag: string | null | undefined): string | null {
  const parts = (tag ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 || (parts.length === 2 && REGION_NAMES.has(parts[1].toLowerCase()))) return parts[0];
  return null;
}

// Cities restaurants glue onto their handle: "barabbacph", "joe_nyc", "cafe.sthlm".
// Only codes that don't end ordinary words ("ber" would split "amber"). Same list in PlaceSearch.swift.
const HANDLE_CITIES: Record<string, string> = {
  oslo: "Oslo",
  cph: "Copenhagen", copenhagen: "Copenhagen", kbh: "Copenhagen",
  nyc: "New York", ldn: "London", london: "London", bcn: "Barcelona", barcelona: "Barcelona",
  sthlm: "Stockholm", stockholm: "Stockholm", gbg: "Gothenburg", malmo: "Malmö",
  cdmx: "Mexico City", paris: "Paris", berlin: "Berlin", istanbul: "Istanbul", lisbon: "Lisbon",
  lisboa: "Lisbon", madrid: "Madrid", milano: "Milano", roma: "Rome", tokyo: "Tokyo", hki: "Helsinki",
};

/** "restaurangvra" → "restaurang vra", "barbrutal" → "bar brutal": a category word glued on. Same rule in PlaceSearch.swift. */
export function handleWithKind(username: string | null | undefined): string | null {
  const h = (username ?? "").toLowerCase().replace(/[._-]+/g, "");
  for (const w of [...CATEGORY_WORDS].filter((w) => /^[a-z]+$/.test(w)).sort((a, b) => b.length - a.length)) {
    if (h.length >= w.length + 3 && h.startsWith(w)) return `${w} ${h.slice(w.length)}`;
    if (h.length >= w.length + 3 && h.endsWith(w)) return `${h.slice(0, -w.length)} ${w}`;
  }
  return null;
}

/** "barabbacph" → "barabba Copenhagen"; null when the handle carries no city. */
export function handleWithCity(username: string | null | undefined): string | null {
  const parts = (username ?? "").toLowerCase().split(/[._-]+/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (HANDLE_CITIES[p] && i > 0) return [...parts.slice(0, i), ...parts.slice(i + 1), HANDLE_CITIES[p]].join(" ");
    for (const [code, city] of Object.entries(HANDLE_CITIES)) {
      if (p.length >= code.length + 3 && p.endsWith(code)) {
        return [...parts.slice(0, i), p.slice(0, -code.length), ...parts.slice(i + 1), city].join(" ");
      }
    }
  }
  return null;
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

/**
 * A location tag that names a street, not a place: "Vattugatan", "Hornsgatan, Södermalm",
 * "Carrer de Girona 145". It says where to look, never what: searched as the venue, it
 * offered the street itself (Mert, 2026-10-14). Returns the street; null for a venue tag.
 * Same rule in PlaceSearch.swift.
 */
export function streetOfTag(tag: string | null | undefined): string | null {
  const first = (tag ?? "").split(",")[0].trim();
  if (!first) return null;
  const ws = first.toLowerCase().split(/\s+/);
  const last = ws[ws.length - 1].replace(/\.$/, "");
  if (ws.some((w) => STREET_ENDINGS.some((e) => w.length > e.length + 2 && w.endsWith(e)))) return first;
  if (ws.length > 1 && STREET_WORDS.includes(last)) return first;
  if (ws.length > 1 && STREET_PREFIXES.includes(ws[0])) return first;
  return null;
}
// Glued onto the name: Hornsgatan, Kungsvägen, Nørregade, Torstraße.
const STREET_ENDINGS = ["gatan", "vägen", "gränd", "gade", "straße", "strasse", "straat", "gasse", "caddesi", "sokak", "sokağı"];
// A word of its own at the end: "Oxford Street", "Main St".
const STREET_WORDS = ["street", "st", "road", "rd", "avenue", "ave", "boulevard", "blvd", "lane", "caddesi", "sokak", "sokağı", "cd", "sk"];
// …or at the start: "Carrer de Girona", "Calle Mayor". Not "via" or "rue": too many venues are called that.
const STREET_PREFIXES = ["carrer", "calle", "avenida", "avinguda", "rua", "passeig", "paseo"];

/**
 * The line a caption pins the place on: "📍 Prodigi" and, on the next line, its address.
 * Food accounts write it this way more than any other, and it beats the account that
 * posted (often a blog, not the venue). → "Prodigi Carrer de Girona, 145, Barcelona".
 * Same rule in PlaceSearch.swift.
 */
export function pinnedPlaceQuery(caption: string | null | undefined): string | null {
  const lines = (caption ?? "").split("\n").map((l) => l.trim());
  // "Address:", and "Address of the bar:" (Side Quest Department, 2026-10-14).
  const lead = /^(?:📍|📌|(?:location|address|adress|adresse|dirección)(?:\s+of\s+the\s+\p{L}+)?\s*:)\uFE0F?/iu;
  const i = lines.findIndex((l) => lead.test(l));
  if (i < 0) return null;
  const clean = (l: string) => l.replace(lead, "").replace(/[@#]/g, " ").replace(/\s+/g, " ").trim();
  let q = clean(lines[i]);
  const below = lines[i + 1] ?? "";
  const next = clean(below);
  // The address on the line below: has a number or a comma, and isn't hashtags.
  if (next && !below.startsWith("#") && !lead.test(below) && (/\d/.test(next) || next.includes(",") || q.length < 3)) {
    q = `${q} ${next}`.trim();
  }
  return q.length >= 3 ? q.slice(0, 120) : null;
}

/**
 * A collab headline: "BROTH BOY x VRÅ", "Noma × Ark". Usually one venue hosting the
 * other, so both are searched. Only the caption's first line counts.
 * Same rule in PlaceSearch.swift.
 */
export function collabNames(caption: string | null | undefined): string[] {
  const first = (caption ?? "").split("\n")[0].replace(/[^\p{L}\p{N}\s×&'’.-]/gu, " ");
  const parts = first.split(/\s+[x×]\s+/i);
  if (parts.length !== 2) return [];
  // The capitalised names touching the x, three words at most: "Pop-up: BROTH BOY x VRÅ ramen night".
  const name = (ws: string[]) => {
    const run: string[] = [];
    for (const w of ws) {
      if (!/^\p{Lu}/u.test(w) || run.length === 3) break;
      run.push(w);
    }
    return run.join(" ");
  };
  const left = name(parts[0].trim().split(/\s+/).reverse()).split(" ").reverse().join(" ");
  const right = name(parts[1].trim().split(/\s+/));
  return [left, right].filter((p) => p.length >= 3);
}

// What a search returns that isn't somewhere to go: streets, areas, addresses.
const NOT_VENUE = /^(route|street_address|street_number|premise|subpremise|locality|sublocality.*|neighborhood|administrative_area.*|country|postal_code|plus_code|political|geocode|intersection)$/;
// Real places, but almost never what a post means: kept only when the name was asked for.
const TRANSIT = /^(transit_station|train_station|subway_station|bus_station|bus_stop|light_rail_station|parking|parking_lot)$/;

/** Somewhere to go, not a street or a station ("vR" offered Stockholm Central). `asked`: the words searched. */
export function isVenue(c: PlaceCandidate, asked?: string): boolean {
  const t = c.primaryType ?? "";
  if (NOT_VENUE.test(t)) return false;
  // A town or a street comes back untyped: named like its town ("Vrå"), or like a street ("Vattugatan").
  if (!t && ((c.city && c.name.toLowerCase() === c.city.toLowerCase()) || streetOfTag(c.name))) return false;
  // Searched "VRÅ", got Vrå the Danish town, its station and its school: a result in a town named like the search.
  if (asked && c.city && fold(c.city) === fold(asked.trim())) return false;
  if (TRANSIT.test(t)) return !!asked && overlaps(words(c.name), words(asked));
  return true;
}

/** Within 30 km of a street tag's pin, or anywhere without one ("Bata, Ragusa" for a Stockholm post). */
export function isNear(c: { lat: number; lng: number }, near: { lat: number; lng: number } | null | undefined) {
  return !near || metersBetween(near, { latitude: c.lat, longitude: c.lng }) <= 30_000;
}

/** Where a street tag is: the first result's pin. */
export async function locate(query: string): Promise<{ lat: number; lng: number } | null> {
  for (const q of [query, streetOfTag(query)]) {
    if (!q) continue;
    const [first] = await searchPlaces(q).catch(() => [] as PlaceCandidate[]);
    if (first) return { lat: first.lat, lng: first.lng };
  }
  return null;
}

/**
 * Untagged, or tagged with a street or a town: the venue has to be read off the post.
 * Clues in order of trust: the caption's 📍 line, "at X in Y", a collab headline and its
 * co-authors, then the posting account (often a blog, never the venue for sure). All
 * searched near the street when there is one; streets, areas and far-off namesakes dropped.
 * `pinned`: the 📍 line answered — trusted like a tag. Same order in AddPlaceView.swift.
 */
export async function resolveUntagged(input: {
  caption: string | null;
  ownerFullName: string | null;
  ownerUsername: string | null;
  coauthors: string[];
  town: string | null;
  near: { lat: number; lng: number } | null;
  /** A tag that found nothing by itself ("VRÅ"): what carries its words ranks first. */
  hint?: string | null;
}): Promise<{ candidates: PlaceCandidate[]; pinned: boolean }> {
  const search = async (q: string | null) =>
    q ? (await searchPlaces(q, input.near).catch(() => [] as PlaceCandidate[])).filter((c) => isVenue(c, q) && isNear(c, input.near)) : [];
  const pin = pinnedPlaceQuery(input.caption);
  const [fromPin, fromCaption, fromCollab, fromAccounts] = await Promise.all([
    search(pin),
    search(captionPlaceQuery(input.caption)),
    // A collab name is a guess at a venue: the result has to carry one of its words.
    Promise.all(collabNames(input.caption).map(async (n) => (await search(n)).filter((c) => overlaps(words(c.name), words(n))))),
    Promise.all(
      [
        { ownerFullName: input.ownerFullName, ownerUsername: input.ownerUsername },
        ...input.coauthors.filter((u) => u !== input.ownerUsername).map((u) => ({ ownerFullName: null, ownerUsername: u })),
      ].map((a) => resolveAccount({ ...a, town: input.town, near: input.near }).then((r) => r.slice(0, 3))),
    ),
  ]);
  if (fromPin.length) return { candidates: fromPin.slice(0, 3), pinned: true };
  // Co-authors before the poster: on a collab the venue is rarely the one who posted.
  const accounts = [...fromAccounts.slice(1).flat(), ...fromAccounts[0]];
  const seen = new Set<string>();
  const merged = [...fromCaption.slice(0, 3), ...fromCollab.flatMap((r) => r.slice(0, 2)), ...accounts].filter(
    (c) => !seen.has(c.placeId) && seen.add(c.placeId),
  );
  // On a collab, the venue carries the tag's or a collab name's words (VRÅ, not the Clarion Hotel it's in).
  const hints = [...words(input.hint ?? ""), ...collabNames(input.caption).flatMap(words)];
  const hit = (c: PlaceCandidate) => (hints.length && overlaps(words(c.name), hints) ? 0 : 1);
  const ranked = merged.map((c, i) => ({ c, i })).sort((a, b) => hit(a.c) - hit(b.c) || a.i - b.i).map(({ c }) => c);
  return { candidates: ranked.slice(0, 4), pinned: false };
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
  return fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
}
function overlaps(a: string[], b: string[]) {
  return a.some((w) => b.includes(w));
}
