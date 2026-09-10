/** Deep links shared by the web UI and, later, the iOS app. */
export function googleMapsUrl(name: string, placeId: string) {
  const q = new URLSearchParams({ api: "1", query: name, query_place_id: placeId });
  return `https://www.google.com/maps/search/?${q}`;
}

export function appleMapsUrl(name: string, lat: number, lng: number) {
  const q = new URLSearchParams({ q: name, ll: `${lat},${lng}` });
  return `https://maps.apple.com/?${q}`;
}
