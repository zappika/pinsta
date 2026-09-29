/**
 * A Google Maps link already names the place. Short links (maps.app.goo.gl)
 * redirect to the long form — sometimes through Google's consent page, whose
 * `continue` parameter holds the real URL. From the long form we read the
 * place name, the map coordinates, and a place id when the link carries one.
 * No API call here. Server-side only.
 */
export type GoogleLink = { url: string; name: string | null; lat: number | null; lng: number | null; placeId: string | null };

export async function readGoogleLink(input: string): Promise<GoogleLink> {
  let url = input;
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(url)) {
    const res = await fetch(url, { redirect: "follow" });
    url = res.url;
    const cont = new URL(url).searchParams.get("continue");
    if (cont) url = cont;
  }
  const u = new URL(url);
  const q = u.searchParams;
  const placeName = u.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
  const name = placeName
    ? decodeURIComponent(placeName.replace(/\+/g, " "))
    : q.get("q") ?? q.get("query") ?? null;
  // "@41.38,2.18,17z" in the path, or "!3d41.38!4d2.18" in the data blob (the pin itself — preferred).
  const pin = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const view = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const ll = q.get("ll")?.split(",").map(Number);
  const [lat, lng] = pin ? [Number(pin[1]), Number(pin[2])] : view ? [Number(view[1]), Number(view[2])] : ll?.length === 2 ? ll : [null, null];
  const placeId = q.get("query_place_id") ?? q.get("place_id") ?? null;
  if (!name && !placeId) throw new Error("That Google Maps link doesn't point to a place");
  return { url, name: name?.trim() || null, lat, lng, placeId };
}
