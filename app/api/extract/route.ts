import { NextResponse } from "next/server";
import { fetchInstagramPost } from "@/lib/instagram-post";
import { normalizeInstagramUrl } from "@/lib/instagram";
import { resolveAccount, resolveTag, type PlaceCandidate } from "@/lib/google-places";
import { storeImage } from "@/lib/blob";

// Apify runs take 5–30s; give the function room.
export const maxDuration = 60;

export type ExtractResponse = {
  post: {
    url: string;
    caption: string | null;
    locationName: string | null;
    imageUrl: string | null;
    ownerUsername: string | null;
  };
  candidates: PlaceCandidate[];
  /** Where the candidates came from: the post's location tag, or the posting account. */
  source: "tag" | "account" | null;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    instagramUrl?: string;
    native?: string | boolean;
    /** Cities the caller already knows (its saved places) — used to read #hashtags as city hints. */
    cityHints?: string[];
  };
  // The iOS app resolves places with MapKit itself; skip the Google call for it.
  const native = body.native === true || body.native === "true";
  const url = normalizeInstagramUrl(body.instagramUrl ?? "");
  if (!url) {
    return NextResponse.json({ error: "Not an Instagram post link" }, { status: 400 });
  }

  try {
    const post = await fetchInstagramPost(url);
    const shortcode = url.split("/").filter(Boolean).pop() ?? "post";

    // Image copy and place search are independent — run together.
    const source = native ? null : post.locationName ? "tag" : "account";
    const [imageUrl, candidates] = await Promise.all([
      post.imageUrl ? storeImage(post.imageUrl, shortcode) : Promise.resolve(null),
      source === "tag"
        ? resolveTag({
            tag: post.locationName!,
            ownerFullName: post.ownerFullName,
            caption: post.caption,
            hashtags: post.hashtags,
            cityHints: Array.isArray(body.cityHints) ? body.cityHints.slice(0, 50) : [],
          }).then((c) => c.slice(0, 5))
        : source === "account"
          ? resolveAccount({ ownerFullName: post.ownerFullName, ownerUsername: post.ownerUsername }).then((c) => c.slice(0, 3))
          : Promise.resolve([]),
    ]);

    const out: ExtractResponse = {
      post: {
        url,
        caption: post.caption,
        locationName: post.locationName,
        imageUrl,
        ownerUsername: post.ownerUsername,
      },
      candidates,
      source: candidates.length ? source : null,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Could not read post";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
