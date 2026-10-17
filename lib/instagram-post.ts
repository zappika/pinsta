/**
 * Fetch a public Instagram post via Apify's instagram-scraper actor.
 * Instagram's own APIs don't expose caption/location for arbitrary posts.
 * Server-side only — uses APIFY_TOKEN.
 */
import { countCall } from "./usage";

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
  /** A collab post's other authors ("brothboy.ramen x vra"): one of them is often the venue. */
  coauthors: string[];
  /** A carousel's pictures (Instagram CDN, short-lived): the iOS app reads the place names written on them. */
  slides: string[];
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
  coauthorProducers?: { username?: string }[];
  taggedUsers?: { username?: string }[];
  mentions?: string[];
  childPosts?: { type?: string; displayUrl?: string }[];
  error?: string;
  errorDescription?: string;
  // An age-restricted post (a restaurant's beer, Liebling 2026-10-17) comes back as "restricted_page"
  // with only the page's preview: the account, "Name (@handle) • Instagram…", the caption quoted in
  // "N likes, … - handle on <date>: \"…\". ", and a 640 px picture.
  user?: { username?: string };
  title?: string;
  description?: string;
  image?: string;
};

const ACTOR = "apify~instagram-scraper";

export async function fetchInstagramPost(postUrl: string): Promise<InstagramPost> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const endpoint = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
  endpoint.searchParams.set("token", token);
  // The callers run under maxDuration 60 and still copy the image or search
  // Google afterwards: Apify gets 40 s, and the fetch gives up at 45 s.
  endpoint.searchParams.set("timeout", "40");

  const [res] = await Promise.all([
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [postUrl], resultsType: "posts", resultsLimit: 1 }),
      signal: AbortSignal.timeout(45_000),
    }).catch((e) => {
      throw (e as Error).name === "TimeoutError" ? new Error("the Instagram reader took too long — try again") : e;
    }),
    countCall("apify"),
  ]);
  if (!res.ok) {
    console.error("Apify error", res.status, (await res.text()).slice(0, 300));
    if (res.status === 402 || res.status === 429) {
      throw new Error("the Instagram reader is busy — try again in a minute");
    }
    throw new Error("the Instagram reader failed");
  }
  const items = (await res.json()) as RawItem[];
  const it = items[0];
  if (it?.error === "restricted_page" && it.user?.username) return restricted(it, postUrl);
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
    // Tagged accounts too (Broth Boy x Vrå tags @clarionpost, the hotel Vrå is in), and the
    // caption's @mentions ("thanks to @lamenagerieparis", the venue — Cindy Khalifa, 2026-10-14).
    coauthors: [
      ...new Set([
        ...[...(it.coauthorProducers ?? []), ...(it.taggedUsers ?? [])].map((c) => c.username),
        ...(it.mentions ?? []),
      ].filter((u): u is string => !!u)),
    ].slice(0, 6),
    slides: (it.childPosts ?? []).filter((c) => c.type !== "Video" && c.displayUrl).map((c) => c.displayUrl!).slice(0, 10),
  };
}

/** What an age-restricted post still shows: who posted it, what it says, its picture. No tag, no slides. */
function restricted(it: RawItem, postUrl: string): InstagramPost {
  const caption = it.description?.match(/^[^:]*:\s*"([\s\S]*)"\.?\s*$/)?.[1]?.trim() || null;
  const fullName = it.title?.match(/^(.*?)\s*\(@/)?.[1]?.trim() || null;
  return {
    url: it.url ?? postUrl,
    type: "Image",
    caption,
    locationName: null,
    locationId: null,
    imageUrl: it.image ?? null,
    ownerUsername: it.user!.username!,
    ownerFullName: fullName,
    hashtags: [...(caption ?? "").matchAll(/#([\p{L}\d_]+)/gu)].map((m) => m[1]),
    coauthors: [...new Set([...(caption ?? "").matchAll(/@([\w.]+)/g)].map((m) => m[1].replace(/\.$/, "")))].slice(0, 6),
    slides: [],
  };
}
