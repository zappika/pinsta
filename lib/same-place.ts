/**
 * Is a new save the same place as one already in the list? Google sometimes
 * has two entries for one venue ("Bar Brutal" and "Can Cisa/Bar Brutal" at the
 * same address), so the Google id alone isn't enough:
 *   same Google id, or within ~60 m with a shared word in the name.
 * Mirrored in ios/Pinsta/Services/SamePlace.swift.
 */
import { kmBetween } from "./geo";

type P = { placeId?: string | null; name: string; lat: number; lng: number };

export function isSamePlace(a: P, b: P): boolean {
  if (a.placeId && a.placeId === b.placeId) return true;
  if (kmBetween(a, b) > 0.06) return false;
  const wa = words(a.name);
  return words(b.name).some((w) => wa.includes(w));
}

const GENERIC = new Set(["bar", "cafe", "café", "restaurant", "the", "and", "hotel", "coffee", "shop"]);

function words(s: string) {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !GENERIC.has(w));
}
