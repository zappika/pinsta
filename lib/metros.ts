/**
 * Big cities whose neighbourhoods come back as the "town".
 *
 * Map data names the district, not the city, inside some metros: MapKit says
 * "Beyoğlu" for a restaurant in Istanbul and "Nordhavn" for one in Copenhagen
 * (a Danish postal district). Nobody says that to a friend. A place within a
 * metro's radius is filed under the metro's name instead, in the Where menu
 * only; the card keeps the saved town. Coordinates, not names, so it also
 * fixes places already saved. Same list in `ios/Pinsta/Services/Metros.swift`.
 */
export type Metro = { name: string; lat: number; lng: number; km: number };

export const METROS: Metro[] = [
  { name: "Istanbul", lat: 41.015, lng: 28.98, km: 30 },
  { name: "Copenhagen", lat: 55.676, lng: 12.568, km: 9 },
  { name: "Stockholm", lat: 59.329, lng: 18.069, km: 10 },
  { name: "Oslo", lat: 59.913, lng: 10.752, km: 9 },
  { name: "Helsinki", lat: 60.17, lng: 24.94, km: 10 },
  { name: "London", lat: 51.507, lng: -0.128, km: 20 },
  { name: "Paris", lat: 48.857, lng: 2.352, km: 9 },
  { name: "Berlin", lat: 52.52, lng: 13.405, km: 18 },
  { name: "Amsterdam", lat: 52.373, lng: 4.893, km: 9 },
  { name: "Barcelona", lat: 41.389, lng: 2.165, km: 7 },
  { name: "Madrid", lat: 40.417, lng: -3.704, km: 12 },
  { name: "Lisbon", lat: 38.722, lng: -9.139, km: 8 },
  { name: "Rome", lat: 41.893, lng: 12.483, km: 12 },
  { name: "Milan", lat: 45.464, lng: 9.19, km: 9 },
  { name: "Vienna", lat: 48.208, lng: 16.373, km: 12 },
  { name: "Prague", lat: 50.075, lng: 14.437, km: 11 },
  { name: "Budapest", lat: 47.498, lng: 19.04, km: 12 },
  { name: "Athens", lat: 37.984, lng: 23.728, km: 10 },
  { name: "Mexico City", lat: 19.433, lng: -99.133, km: 18 },
  { name: "New York", lat: 40.73, lng: -73.99, km: 18 },
  { name: "Los Angeles", lat: 34.052, lng: -118.244, km: 25 },
  { name: "San Francisco", lat: 37.775, lng: -122.419, km: 8 },
  { name: "Tokyo", lat: 35.681, lng: 139.767, km: 22 },
  { name: "Seoul", lat: 37.566, lng: 126.978, km: 18 },
  { name: "Bangkok", lat: 13.756, lng: 100.502, km: 18 },
  { name: "Buenos Aires", lat: -34.604, lng: -58.382, km: 14 },
];

/** The metro a point lies in, the nearest one if radii overlap. */
export function metroAt(lat: number, lng: number): string | null {
  let best: { name: string; d: number } | null = null;
  for (const m of METROS) {
    const d = km(lat, lng, m.lat, m.lng);
    if (d <= m.km && (!best || d < best.d)) best = { name: m.name, d };
  }
  return best?.name ?? null;
}

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
