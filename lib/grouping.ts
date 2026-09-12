/**
 * Which name goes in the "Where" menu for each place.
 *
 * The rule is what you'd say to a friend: "Barcelona" for a bar in Barcelona,
 * "Halland" for a vineyard in a village nobody's heard of. Decided purely from
 * what's saved — no lookups, no model:
 *
 *   1. A town with 2+ saved places is a destination in its own right.
 *   2. A town with 1 place is folded into its region — but only if that region
 *      then bundles 2+ such places. A region row that would hold one place is
 *      pointless, so the town keeps its own name instead.
 *
 * So the first Malmö place is "Malmö"; Ästad and Ystad together become
 * "Skåne"; Ästad alone stays "Ästad". Labels shift as the list grows, which
 * is the accepted trade-off (decided 2026-09-12).
 */
export type Groupable = {
  id: string;
  city: string | null;
  region: string | null;
  country: string | null;
};

const OWN_ROW_AT = 2;

export function destinationLabels<T extends Groupable>(places: T[]): Map<string, string> {
  const byCity = new Map<string, number>();
  for (const p of places) {
    const c = p.city ?? "";
    byCity.set(c, (byCity.get(c) ?? 0) + 1);
  }

  const regionOf = (p: T) => cleanRegion(p.region) ?? p.country ?? "Elsewhere";
  const singletonsByRegion = new Map<string, number>();
  for (const p of places) {
    if ((byCity.get(p.city ?? "") ?? 0) >= OWN_ROW_AT) continue;
    const r = regionOf(p);
    singletonsByRegion.set(r, (singletonsByRegion.get(r) ?? 0) + 1);
  }

  const labels = new Map<string, string>();
  for (const p of places) {
    const city = p.city ?? "";
    if ((byCity.get(city) ?? 0) >= OWN_ROW_AT) {
      labels.set(p.id, city || regionOf(p));
      continue;
    }
    const r = regionOf(p);
    labels.set(p.id, (singletonsByRegion.get(r) ?? 0) >= OWN_ROW_AT ? r : city || r);
  }
  return labels;
}

/** "Hallands län" → "Halland", "Skåne County" → "Skåne", "Province of X" → "X". */
export function cleanRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  let r = region.trim();
  r = r.replace(/^(province|region|state|county|department)\s+of\s+/i, "");
  const swedish = /\s+län$/i.test(r);
  r = r.replace(/\s+(län|county|region|province|prefecture|governorate|district|oblast)$/i, "");
  // Swedish län take the genitive: "Hallands län", "Stockholms län".
  if (swedish && /[a-zåäö]s$/i.test(r) && !/(s|x|z)s$/i.test(r)) r = r.slice(0, -1);
  return r || null;
}
