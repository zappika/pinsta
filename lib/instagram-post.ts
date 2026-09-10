/**
 * Fetch a public Instagram post via Apify's instagram-scraper actor.
 * Instagram's own APIs don't expose caption/location for arbitrary posts.
 * Server-side only — uses APIFY_TOKEN.
 */
export type InstagramPost = {
  url: string;
  type: "Image" | "Video" | "Sidecar" | string;
  caption: string | null;
  locationName: string | null;
  locationId: string | null;
  imageUrl: string | null; // Instagram CDN URL — expires, must be copied
  ownerUsername: string | null;
  ownerFullName: string | null;
  hashtags: string[];
};

type RawItem = {
  url?: string;
  type?: string;
  caption?: string;
  locationName?: string;
  locationId?: string;
  displayUrl?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  hashtags?: string[];
  error?: string;
  errorDescription?: string;
};

const ACTOR = "apify~instagram-scraper";

export async function fetchInstagramPost(postUrl: string): Promise<InstagramPost> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const endpoint = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("timeout", "55");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: [postUrl], resultsType: "posts", resultsLimit: 1 }),
  });
  if (!res.ok) {
    console.error("Apify error", res.status, (await res.text()).slice(0, 300));
    if (res.status === 402 || res.status === 429) {
      throw new Error("the Instagram reader is busy — try again in a minute");
    }
    throw new Error("the Instagram reader failed");
  }
  const items = (await res.json()) as RawItem[];
  const it = items[0];
  if (!it || it.error) {
    throw new Error(it?.errorDescription ?? "Post not found or not public");
  }
  return {
    url: it.url ?? postUrl,
    type: it.type ?? "Image",
    caption: it.caption?.trim() || null,
    locationName: it.locationName?.trim() || null,
    locationId: it.locationId ?? null,
    imageUrl: it.displayUrl ?? null,
    ownerUsername: it.ownerUsername ?? null,
    ownerFullName: it.ownerFullName ?? null,
    hashtags: it.hashtags ?? [],
  };
}
