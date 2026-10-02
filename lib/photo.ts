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
