import { NextResponse } from "next/server";
import { fetchInstagramPost } from "@/lib/instagram-post";
import { fetchTikTokPost } from "@/lib/tiktok";
import { readGoogleLink } from "@/lib/google-link";
import { parseSourceUrl, type SourceKind } from "@/lib/sources";
import { captionPlaceQuery, getPlace, resolveAccount, resolveTag, searchPlaces, type PlaceCandidate } from "@/lib/google-places";
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
    /** Google Maps links carry the pin; the iOS app searches MapKit around it. */
    near: { lat: number; lng: number } | null;
  };
  candidates: PlaceCandidate[];
  /**
   * Where the candidates came from: the post's location tag, the posting
   * account, or the Google Maps link itself. Only "tag" and "link" are
   * trusted enough to auto-save a single match.
   */
  source: "tag" | "account" | "link" | null;
};

type Read = Omit<ExtractResponse["post"], "url" | "kind" | "imageUrl"> & {
  url: string;
  rawImage: string | null;
  city?: string | null;
  placeId?: string | null;
};

async function read(kind: SourceKind, url: string): Promise<Read> {
  if (kind === "instagram") {
    const p = await fetchInstagramPost(url);
    return { url, caption: p.caption, locationName: p.locationName, rawImage: p.imageUrl, ownerUsername: p.ownerUsername, ownerFullName: p.ownerFullName, hashtags: p.hashtags, near: null };
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
  const body = (await req.json().catch(() => ({}))) as {
    instagramUrl?: string;
    native?: string | boolean;
    /** Cities the caller already knows (its saved places) — used to read #hashtags as city hints. */
    cityHints?: string[];
  };
  // The iOS app resolves places with MapKit itself; skip the Google call for it.
  // Anyone but the owner gets native mode too: no Google Places spend from unknown callers.
  const native = body.native === true || body.native === "true" || !isOwner(req);
  const parsed = parseSourceUrl(body.instagramUrl ?? "");
  if (!parsed) {
    return NextResponse.json({ error: "Not an Instagram, TikTok or Google Maps link" }, { status: 400 });
  }

  try {
    const post = await read(parsed.kind, parsed.url);
    const key = `${parsed.kind === "instagram" ? "" : parsed.kind + "-"}${post.url.split(/[/?#]/).filter(Boolean).pop()?.slice(0, 40) ?? "post"}`;
    const cityHints = Array.isArray(body.cityHints) ? body.cityHints.slice(0, 50) : [];

    const source: ExtractResponse["source"] = native
      ? null
      : parsed.kind === "google"
        ? "link"
        : post.locationName
          ? "tag"
          : "account";

    const find = async (): Promise<PlaceCandidate[]> => {
      if (source === "link") {
        if (post.placeId) return [await getPlace(post.placeId)];
        return post.locationName ? (await searchPlaces(post.locationName, post.near)).slice(0, 3) : [];
      }
      if (source === "tag") {
        return (
          await resolveTag({
            tag: post.locationName!,
            ownerFullName: post.ownerFullName,
            caption: post.caption,
            hashtags: post.hashtags,
            cityHints,
            extraQueries: post.city ? [`${post.locationName} ${post.city}`] : [],
          })
        ).slice(0, 5);
      }
      if (source === "account") {
        // The caption naming a place beats the account; both are suggestions only.
        const q = captionPlaceQuery(post.caption);
        const fromCaption = q ? (await searchPlaces(q).catch(() => [])).slice(0, 3) : [];
        const fromAccount = (await resolveAccount({ ownerFullName: post.ownerFullName, ownerUsername: post.ownerUsername })).slice(0, 3);
        const seen = new Set<string>();
        return [...fromCaption, ...fromAccount].filter((c) => !seen.has(c.placeId) && seen.add(c.placeId)).slice(0, 4);
      }
      return [];
    };

    // Image copy and place search are independent — run together.
    const [imageUrl, found] = await Promise.all([
      post.rawImage ? storeImage(post.rawImage, key) : Promise.resolve(null),
      find(),
    ]);
    // A Google link names one place: the candidate nearest its pin comes first.
    const candidates = source === "link" && post.near && found.length > 1 ? nearestFirst(found, post.near) : found;

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
        near: post.near,
      },
      candidates: source === "link" && candidates.length > 1 && isClear(candidates, post.near) ? candidates.slice(0, 1) : candidates,
      source: candidates.length ? source : null,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Could not read that link";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function nearestFirst(cs: PlaceCandidate[], p: { lat: number; lng: number }) {
  const d = (c: PlaceCandidate) => (c.lat - p.lat) ** 2 + (c.lng - p.lng) ** 2;
  return [...cs].sort((a, b) => d(a) - d(b));
}

/** The nearest candidate sits right on the link's pin (≈ within 100 m): no need to ask. */
function isClear(cs: PlaceCandidate[], p: { lat: number; lng: number } | null) {
  if (!p) return false;
  const [a] = cs;
  return Math.abs(a.lat - p.lat) < 0.001 && Math.abs(a.lng - p.lng) < 0.0013;
}
