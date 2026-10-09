import { storeImage } from "./blob";
import { fetchInstagramPost } from "./instagram-post";
import { sourceKind } from "./sources";
import { countCall } from "./usage";

/**
 * A place never goes without a photo. The post's own image is what you saw
 * and is always first; if the post can't be read (private, Apify busy), the
 * place's Google photo stands in. Either way the bytes land in our Blob so
 * the URL is ours and doesn't expire.
 * `postUnreadable`: the client's own read just failed, so a second Apify run
 * would only cost money and time; go straight to Google.
 */
export async function findPhoto(
  instagramUrl: string,
  placeId: string,
  opts: { postUnreadable?: boolean } = {},
): Promise<string | null> {
  const shortcode = instagramUrl.split(/[/?#]/).filter(Boolean).pop()?.slice(0, 40) ?? "post";
  if (sourceKind(instagramUrl) !== "instagram" || opts.postUnreadable) return googlePhoto(placeId, shortcode);
  try {
    const post = await fetchInstagramPost(instagramUrl);
    if (post.imageUrl) {
      const url = await storeImage(post.imageUrl, shortcode);
      if (url) return url;
    }
  } catch (e) {
    console.warn("photo: post unreadable, trying Google", e instanceof Error ? e.message : e);
  }
  return googlePhoto(placeId, shortcode);
}

/** A photo googlePhoto stored (its Blob key ends "-g"), not the post's own image. */
export function isGooglePhoto(url: string | null): boolean {
  return !!url && /-g\.(jpg|png|webp)(\?|$)/.test(url);
}

/**
 * First photo Google has for the place — Places API (New) Photo media.
 * `key` names the Blob file; "-g" is appended to it.
 */
export async function googlePhoto(placeId: string, key: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: { name: string }[] };
    const name = data.photos?.[0]?.name;
    if (!name) return null;
    // skipHttpRedirect returns the CDN URL as JSON instead of 302ing to it.
    // Only this call is billed (Place Photos); the one above asks only for photo
    // names, which is the free IDs Only SKU, so it isn't counted.
    const [media] = await Promise.all([
      fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`, {
        headers: { "X-Goog-Api-Key": apiKey },
      }),
      countCall("google.photos"),
    ]);
    if (!media.ok) return null;
    const { photoUri } = (await media.json()) as { photoUri?: string };
    return photoUri ? storeImage(photoUri, `${key}-g`) : null;
  } catch (e) {
    console.error("photo: Google fallback failed", e);
    return null;
  }
}

/**
 * Google's photo for a place known only by name and pin (an iOS list import).
 * The Text Search asks for ids only (the free IDs Only SKU) inside ~150 m of the
 * pin, so a match elsewhere can't happen; then googlePhoto, the one paid call.
 * Throws when Google itself fails, so the app tries again later.
 */
export async function googlePhotoNear(name: string, lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const d = 0.0015; // ≈150 m of latitude; a little less of longitude away from the equator
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({
      textQuery: name,
      pageSize: 1,
      locationRestriction: { rectangle: { low: { latitude: lat - d, longitude: lng - d }, high: { latitude: lat + d, longitude: lng + d } } },
    }),
  });
  if (!res.ok) throw new Error(`Places search failed: ${res.status}`);
  const id = ((await res.json()) as { places?: { id: string }[] }).places?.[0]?.id;
  if (!id) return null;
  return googlePhoto(id, `list-${id.slice(-12)}`);
}
