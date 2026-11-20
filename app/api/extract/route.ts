import { NextResponse } from "next/server";
import { fetchInstagramPost } from "@/lib/instagram-post";
import { fetchTikTokPost } from "@/lib/tiktok";
import { fetchInstagramProfile } from "@/lib/instagram-profile";
import { readGoogleLink } from "@/lib/google-link";
import { listIdFrom } from "@/lib/google-list";
import { parseSourceUrl, type SourceKind } from "@/lib/sources";
import { type PlaceCandidate } from "@/lib/google-places";
import { resolvePost, type Resolved } from "@/lib/resolve-post";
import { storeImage } from "@/lib/blob";
import { isOwner } from "@/lib/owner";

// Apify runs take 5–30s; give the function room.
export const maxDuration = 60;

export type ExtractResponse = {
  post: {
    /** Canonical link (short links resolved) — save this one. */
    url: string;
    kind: SourceKind;
    caption: string | null;
    locationName: string | null;
    imageUrl: string | null;
    ownerUsername: string | null;
    ownerFullName: string | null;
    hashtags: string[];
    /** A collab post's other authors; the iOS app searches them like the poster. */
    coauthors: string[];
    /** Google Maps links carry the pin; the iOS app searches MapKit around it. */
    near: { lat: number; lng: number } | null;
    /** A carousel's pictures, for the iOS app to read place names off (Vink's six Oslo places, 2026-10-14). */
    slides: string[];
    /** An Instagram profile's own category ("Restaurant"): the iOS app keeps matches of that kind. */
    category: string | null;
    /** TikTok's location tag names its city; the iOS app adds "tag city" to its searches, as resolveTag does here. */
    city: string | null;
  };
  candidates: PlaceCandidate[];
  /**
   * Where the candidates came from: the post's location tag, the posting
   * account, or the Google Maps link itself. Only "tag" and "link" are
   * trusted enough to auto-save a single match.
   */
  source: "tag" | "account" | "link" | null;
};

type Read = Omit<ExtractResponse["post"], "url" | "kind" | "imageUrl" | "city" | "coauthors" | "category" | "slides"> & {
  coauthors?: string[];
  slides?: string[];
  url: string;
  rawImage: string | null;
  city?: string | null;
  placeId?: string | null;
  /** A profile's own category ("Restaurant"): its match has to be one. */
  category?: string | null;
};

async function read(kind: SourceKind, url: string): Promise<Read> {
  if (kind === "instagram") {
    const p = await fetchInstagramPost(url);
    return { url, caption: p.caption, locationName: p.locationName, rawImage: p.imageUrl, ownerUsername: p.ownerUsername, ownerFullName: p.ownerFullName, hashtags: p.hashtags, coauthors: p.coauthors, slides: p.slides, near: null };
  }
  if (kind === "profile") {
    // A profile reads like a post: its own name, its posts' tag or bio address as the tag, its bio as the caption.
    const p = await fetchInstagramProfile(url);
    return { url, caption: p.biography, locationName: p.locationName, rawImage: p.imageUrl, ownerUsername: p.username, ownerFullName: p.fullName, hashtags: [], near: null, category: p.category };
  }
  if (kind === "tiktok") {
    const p = await fetchTikTokPost(url);
    return { url: p.url, caption: p.caption, locationName: p.locationName, city: p.locationCity, rawImage: p.imageUrl, ownerUsername: p.ownerUsername, ownerFullName: p.ownerFullName, hashtags: p.hashtags, near: null };
  }
  const g = await readGoogleLink(url);
  return {
    url: g.url,
    caption: null,
    locationName: g.name,
    rawImage: null, // the Google photo is fetched at save time
    ownerUsername: null,
    ownerFullName: null,
    hashtags: [],
    near: g.lat !== null && g.lng !== null ? { lat: g.lat, lng: g.lng } : null,
    placeId: g.placeId,
  };
}

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => null)) ?? {}) as {
    instagramUrl?: unknown;
    native?: string | boolean;
    /** Cities the caller already knows (its saved places) — used to read #hashtags as city hints. */
    cityHints?: unknown;
  };
  // The iOS app resolves places with MapKit itself; skip the Google call for it.
  // Anyone but the owner gets native mode too: no Google Places spend from unknown callers.
  const native = body.native === true || body.native === "true" || !isOwner(req);
  const parsed = parseSourceUrl(typeof body.instagramUrl === "string" ? body.instagramUrl : "");
  if (!parsed) {
    return NextResponse.json({ error: "Not an Instagram, TikTok or Google Maps link, or an @handle" }, { status: 400 });
  }

  // The + menu's one Google Maps entry takes a place or a shared list: a list goes to /import (free to tell).
  if (parsed.kind === "google" && (await listIdFrom(parsed.url).catch(() => null))) {
    return NextResponse.json({ list: parsed.url });
  }

  try {
    const post = await read(parsed.kind, parsed.url);
    const key = `${parsed.kind === "instagram" ? "" : parsed.kind + "-"}${post.url.split(/[/?#]/).filter(Boolean).pop()?.slice(0, 40) ?? "post"}`;
    const cityHints = Array.isArray(body.cityHints)
      ? body.cityHints.filter((c): c is string => typeof c === "string").slice(0, 50)
      : [];

    // Image copy and place search are independent — run together. The iOS app searches by itself.
    const none: Resolved = { candidates: [], source: null };
    const [imageUrl, found] = await Promise.all([
      post.rawImage ? storeImage(post.rawImage, key) : Promise.resolve(null),
      native ? Promise.resolve(none) : resolvePost(parsed.kind, post, cityHints),
    ]);

    const out: ExtractResponse = {
      post: {
        url: post.url,
        kind: parsed.kind,
        caption: post.caption,
        locationName: post.locationName,
        imageUrl,
        ownerUsername: post.ownerUsername,
        ownerFullName: post.ownerFullName,
        hashtags: post.hashtags,
        coauthors: post.coauthors ?? [],
        category: post.category ?? null,
        slides: post.slides ?? [],
        near: post.near,
        city: post.city ?? null,
      },
      ...found,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Could not read that link";
    // A deleted or private post won't come back: say so, so the app stops paying to retry it.
    if (/does not exist|not found|not public/i.test(msg)) {
      return NextResponse.json({ error: msg, permanent: true }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

