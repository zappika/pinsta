/**
 * Which name goes in the "Where" menu for each place.
 *
 * The rule is what you'd say to a friend: "Barcelona" for a bar in Barcelona,
 * "Halland" for a vineyard in a village nobody's heard of. Decided purely from
 * what's saved — no lookups, no model:
 *
 *   0. First: a place inside a big city (lib/metros) is that city, even
 *      alone. "Beyoğlu" and "Nordhavn" become "Istanbul" and "Copenhagen".
 *      Then a place inside a travel area (AREAS there) is that area, even
 *      alone and even when its village has several: "Costa Brava", not "Begur"
 *      (Sarp, 2026-10-09).
 *   1. A town with 2+ saved places is a destination in its own right.
 *   2. A town with 1 place is folded into its region (a Spanish province is
 *      read as its region: "Girona" → "Catalonia") — but only if that region
 *      then bundles 2+ such places. A region row that would hold one place is
 *      pointless, so the town keeps its own name instead.
 *
 * So the first Malmö place is "Malmö"; Ästad and Ystad together become
 * "Skåne"; Ästad alone stays "Ästad". Labels shift as the list grows, which
 * is the accepted trade-off (decided 2026-09-12).
 */
import { areaAt, metroAt } from "./metros";

export type Groupable = {
  id: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
  country: string | null;
};

const OWN_ROW_AT = 2;

export function destinationLabels<T extends Groupable>(places: T[]): Map<string, string> {
  const labels = new Map<string, string>();
  const rest: T[] = [];
  for (const p of places) {
    const metro = metroAt(p.lat, p.lng) ?? areaAt(p.lat, p.lng);
    if (metro) labels.set(p.id, metro);
    else rest.push(p);
  }
  places = rest;

  const byCity = new Map<string, number>();
  for (const p of places) {
    const c = p.city ?? "";
    byCity.set(c, (byCity.get(c) ?? 0) + 1);
  }

  const regionOf = (p: T) => regionName(p.region, p.country) ?? p.country ?? "Elsewhere";
  const singletonsByRegion = new Map<string, number>();
  for (const p of places) {
    if ((byCity.get(p.city ?? "") ?? 0) >= OWN_ROW_AT) continue;
    const r = regionOf(p);
    singletonsByRegion.set(r, (singletonsByRegion.get(r) ?? 0) + 1);
  }

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

/**
 * MapKit names a Spanish province where the region is wanted, and Sweden by its län
 * letter ("M"). Both are read as the region people say. Google already gives these.
 */
const SPAIN: Record<string, string> = Object.fromEntries(
  Object.entries({
    Catalonia: ["Barcelona", "Girona", "Gerona", "Lleida", "Lérida", "Tarragona", "Catalunya", "Cataluña"],
    Andalusia: ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla", "Seville", "Andalucía"],
    "Basque Country": ["Álava", "Araba", "Bizkaia", "Vizcaya", "Gipuzkoa", "Guipúzcoa", "País Vasco", "Euskadi"],
    Valencia: ["Alicante", "Alacant", "Castellón", "Castelló", "Valencia", "València", "Comunitat Valenciana"],
    Galicia: ["A Coruña", "La Coruña", "Lugo", "Ourense", "Pontevedra"],
    Aragon: ["Huesca", "Teruel", "Zaragoza", "Aragón"],
    "Castile and León": ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"],
    "Castilla-La Mancha": ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"],
    Extremadura: ["Badajoz", "Cáceres"],
    "Balearic Islands": ["Illes Balears", "Islas Baleares", "Baleares", "Mallorca"],
    "Canary Islands": ["Las Palmas", "Santa Cruz de Tenerife", "Canarias"],
  }).flatMap(([region, names]) => names.map((n) => [n.toLowerCase(), region])),
);
const SWEDEN: Record<string, string> = {
  AB: "Stockholm", C: "Uppsala", D: "Södermanland", E: "Östergötland", F: "Jönköping", G: "Kronoberg", H: "Kalmar",
  I: "Gotland", K: "Blekinge", M: "Skåne", N: "Halland", O: "Västra Götaland", S: "Värmland", T: "Örebro",
  U: "Västmanland", W: "Dalarna", X: "Gävleborg", Y: "Västernorrland", Z: "Jämtland", AC: "Västerbotten", BD: "Norrbotten",
};

function regionName(region: string | null | undefined, country: string | null | undefined): string | null {
  const r = region?.trim();
  if (!r) return null;
  if (/^(spain|españa)$/i.test(country ?? "")) return SPAIN[r.toLowerCase()] ?? cleanRegion(r);
  if (/^(sweden|sverige)$/i.test(country ?? "") && SWEDEN[r]) return SWEDEN[r];
  return cleanRegion(r);
}

/** "Hallands län" → "Halland", "Skåne County" → "Skåne", "Province of X" → "X". */
function cleanRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  let r = region.trim();
  r = r.replace(/^(province|region|state|county|department)\s+of\s+/i, "");
  const swedish = /\s+län$/i.test(r);
  r = r.replace(/\s+(län|county|region|province|prefecture|governorate|district|oblast)$/i, "");
  // Swedish län take the genitive: "Hallands län", "Stockholms län".
  if (swedish && /[a-zåäö]s$/i.test(r) && !/(s|x|z)s$/i.test(r)) r = r.slice(0, -1);
  return r || null;
}
