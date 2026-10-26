/**
 * Sending places to a friend (Sarp, 2026-10-26): a walk ("Kreuzberg afternoon", in order) or a
 * list ("my Helsinki restaurant tips", no order). Shared by the sheet that makes one, the API and
 * the public page `/w/<id>`. A send is a copy: it never changes after it's made.
 */
import type { SendStop } from "./db/schema";
import { kmBetween } from "./geo";

export type { SendStop };
export type SendKind = "walk" | "list";

/** A walk is a few stops for one afternoon; past this it's a list. */
export const WALK_MAX = 8;
export const SEND_MAX = 40;

/** "4 stops" / "1 place". */
export function countLabel(kind: SendKind, n: number): string {
  const word = kind === "walk" ? "stop" : "place";
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Unguessable, short enough to read aloud: 10 letters/digits ≈ 59 bits. */
export function newSendId(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}

/** On foot: straight lines stretched to streets (×1.3), at 4.8 km/h. Honest enough for "about". */
export function walkStats(stops: { lat: number; lng: number }[]): { km: number; minutes: number } {
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += kmBetween(stops[i - 1], stops[i]);
  km *= 1.3;
  return { km, minutes: Math.round((km / 4.8) * 60) };
}

export function walkLine(stops: { lat: number; lng: number }[]): string {
  const { km, minutes } = walkStats(stops);
  const time = minutes < 60 ? `${Math.max(5, Math.round(minutes / 5) * 5)} min` : `${(minutes / 60).toFixed(1).replace(/\.0$/, "")} h`;
  return `about ${time} on foot · ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}`;
}

/** The shortest open path through every stop (any start). Brute force: 8! is 40k, nothing. */
export function shortestOrder<T extends { lat: number; lng: number }>(stops: T[]): T[] {
  if (stops.length < 3 || stops.length > WALK_MAX) return stops;
  let best = stops, bestKm = Infinity;
  const walk = (path: T[], left: T[], km: number) => {
    if (km >= bestKm) return;
    if (left.length === 0) {
      best = path;
      bestKm = km;
      return;
    }
    for (let i = 0; i < left.length; i++) {
      const next = left[i];
      const add = path.length ? kmBetween(path[path.length - 1], next) : 0;
      walk([...path, next], [...left.slice(0, i), ...left.slice(i + 1)], km + add);
    }
  };
  walk([], stops, 0);
  return best;
}

/** Google Maps walking directions through every stop in order (its link takes up to 9 waypoints). */
export function walkDirectionsUrl(stops: SendStop[]): string {
  const at = (s: SendStop) => `${s.name}, ${s.address ?? `${s.lat},${s.lng}`}`;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("travelmode", "walking");
  u.searchParams.set("origin", at(stops[0]));
  u.searchParams.set("destination", at(stops[stops.length - 1]));
  const mid = stops.slice(1, -1).slice(0, 9);
  if (mid.length) u.searchParams.set("waypoints", mid.map(at).join("|"));
  if (stops[0].placeId) u.searchParams.set("origin_place_id", stops[0].placeId);
  if (stops[stops.length - 1].placeId) u.searchParams.set("destination_place_id", stops[stops.length - 1].placeId!);
  return u.toString();
}

/** What the server keeps of a stop the client sent: only these fields, trimmed. */
export function cleanStop(raw: unknown): SendStop | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const name = str(r.name), lat = num(r.lat), lng = num(r.lng);
  if (!name || lat === null || lng === null) return null;
  const price = num(r.priceLevel);
  const image = str(r.imageUrl, 1000);
  return {
    name,
    placeId: str(r.placeId),
    lat,
    lng,
    address: str(r.address),
    city: str(r.city, 80),
    category: str(r.category, 40),
    primaryType: str(r.primaryType, 60),
    priceLevel: price !== null && price >= 1 && price <= 4 ? price : null,
    imageUrl: image && /^https:\/\//.test(image) ? image : null,
    note: str(r.note, 280),
  };
}

/**
 * Names out of pasted text: a ChatGPT answer, a WhatsApp message, a line of commas.
 * "1. **Voo Store** – concept store on Oranienstraße" → "Voo Store". One line with commas
 * or "and" is split on them; on several lines, each line is one place.
 */
export function namesIn(text: string): string[] {
  const mark = /^\s*(?:[-*•·]|\d+[.)]|[①-⑨])\s+|\*\*/;
  let lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    // "Here's a nice afternoon:" and "Enjoy!" are around the list, not in it.
    .filter((l) => l && !/[:!?]$/.test(l));
  // A marked list (numbers, bullets, bold names): only its lines are places.
  if (lines.filter((l) => mark.test(l)).length >= 2) lines = lines.filter((l) => mark.test(l));
  const pieces =
    lines.length === 1 ? lines[0].split(/\s*(?:,|;|\band\b|&|→|->)\s*/i) : lines;
  const names = pieces
    .map((l) => {
      // A bolded name is the name, whatever follows it.
      const bold = l.match(/\*\*(.+?)\*\*/);
      let s = bold ? bold[1] : l;
      s = s
        .replace(/^\s*(?:[-*•·]|\d+[.)]|[①-⑨])\s*/, "") // list marks
        .replace(/^(?:stop\s*\d+|start|then|finish|end)\s*[:.\-–—]\s*/i, "")
        .replace(/^(?:go to|try|visit|check out)\s+/i, "")
        .split(/\s+[–—-]\s+|:\s|\s\(|\s\|/)[0] // a description after a dash, colon or bracket
        .replace(/[*_`#]/g, "")
        .replace(/[.,;:!]+$/, "")
        .trim();
      return s;
    })
    // Headings and sentences aren't names: too long, or a heading line ending in ":".
    .filter((s) => s.length >= 2 && s.length <= 60 && s.split(/\s+/).length <= 7);
  return [...new Set(names)].slice(0, SEND_MAX);
}
