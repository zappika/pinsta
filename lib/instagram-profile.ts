/**
 * Read a public Instagram profile through Apify, shaped like a post so the same
 * search finds the place. A venue's account rarely carries an address (none of
 * Mert's three did, 2026-10-14), so the clues are: its display name ("VRÅ |
 * Nordic Japanese" → "VRÅ"), the place its own posts are tagged with most
 * ("Hornsgatan, Södermalm"), or a street address in its bio ("Vattugatan 13,
 * Stockholm"). Server-side only — uses APIFY_TOKEN.
 */
import { countCall } from "./usage";
import { streetOfTag } from "./google-places";

export type InstagramProfile = {
  username: string;
  fullName: string | null;
  biography: string | null;
  category: string | null;
  /** The tag or bio address standing in for a post's location tag. */
  locationName: string | null;
  /** The latest post's picture: a profile picture is usually a logo. */
  imageUrl: string | null;
};

type Raw = {
  username?: string;
  fullName?: string;
  biography?: string;
  businessCategoryName?: string;
  latestPosts?: { locationName?: string; displayUrl?: string }[];
  error?: string;
  errorDescription?: string;
};

export async function fetchInstagramProfile(profileUrl: string): Promise<InstagramProfile> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const endpoint = new URL("https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items");
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("timeout", "40");
  const [res] = await Promise.all([
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [profileUrl], resultsType: "details", resultsLimit: 1 }),
      signal: AbortSignal.timeout(45_000),
    }).catch((e) => {
      throw (e as Error).name === "TimeoutError" ? new Error("the Instagram reader took too long — try again") : e;
    }),
    countCall("apify"),
  ]);
  if (!res.ok) {
    console.error("Apify error", res.status, (await res.text()).slice(0, 300));
    throw new Error(res.status === 402 || res.status === 429 ? "the Instagram reader is busy — try again in a minute" : "the Instagram reader failed");
  }
  const it = ((await res.json()) as Raw[])[0];
  if (!it || it.error || !it.username) throw new Error(it?.errorDescription ?? "Profile not found or not public");

  // 𝐓𝐚𝐯𝐞𝐫𝐧 → Tavern: bios are often written in maths letters.
  const plain = (s: string | undefined) => s?.normalize("NFKC").trim() || null;
  const bio = plain(it.biography);
  // "VRÅ | Nordic Japanese", "Bata — tavern": the name is before the separator.
  const fullName = plain(it.fullName)?.split(/\s+[|•·—–-]\s+/)[0].trim() || null;
  const posts = it.latestPosts ?? [];
  return {
    username: it.username,
    fullName,
    biography: bio,
    category: plain(it.businessCategoryName),
    locationName: commonTag(posts.map((p) => p.locationName)) ?? addressIn(bio),
    imageUrl: posts.find((p) => p.displayUrl)?.displayUrl ?? null,
  };
}

/** The tag on two or more of the latest posts: a venue tags itself. */
function commonTag(tags: (string | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const t of tags) if (t?.trim()) counts.set(t.trim(), (counts.get(t.trim()) ?? 0) + 1);
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 2 ? best[0] : null;
}

/** "…Saturday 12:00-16:00 Vattugatan 13, Stockholm" → "Vattugatan 13, Stockholm". Same rule in PostReader.swift. */
export function addressIn(text: string | null): string | null {
  if (!text) return null;
  const re = /(\p{L}[\p{L}'’.-]*(?:\s+\p{L}[\p{L}'’.-]*){0,3})\s+(\d{1,4}[a-zA-Z]?)(?:\s*,\s*(\p{L}[\p{L}'’ -]{1,30}\p{L}))?/gu;
  for (const m of text.matchAll(re)) {
    // Trailing words of the run first: "Saturday Vattugatan" → "Vattugatan".
    const words = m[1].split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const street = words.slice(i).join(" ");
      if (streetOfTag(street)) return [`${street} ${m[2]}`, m[3]?.trim()].filter(Boolean).join(", ");
    }
  }
  return null;
}
