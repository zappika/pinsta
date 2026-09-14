import { storeImage } from "./blob";
import { fetchInstagramPost } from "./instagram-post";

/**
 * A place never goes without a photo. The post's own image is what you saw
 * and is always first; if the post can't be read (private, Apify busy), the
 * place's Google photo stands in. Either way the bytes land in our Blob so
 * the URL is ours and doesn't expire.
 */
export async function findPhoto(instagramUrl: string, placeId: string): Promise<string | null> {
  const shortcode = instagramUrl.split("/").filter(Boolean).pop() ?? "post";
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

/** First photo Google has for the place — Places API (New) Photo media. */
async function googlePhoto(placeId: string, key: string): Promise<string | null> {
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
    const media = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (!media.ok) return null;
    const { photoUri } = (await media.json()) as { photoUri?: string };
    return photoUri ? storeImage(photoUri, `${key}-g`) : null;
  } catch (e) {
    console.error("photo: Google fallback failed", e);
    return null;
  }
}
