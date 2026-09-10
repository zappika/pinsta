import { NextResponse } from "next/server";
import { fetchInstagramPost } from "@/lib/instagram-post";
import { normalizeInstagramUrl } from "@/lib/instagram";
import { searchPlaces, type PlaceCandidate } from "@/lib/google-places";
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
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { instagramUrl?: string };
  const url = normalizeInstagramUrl(body.instagramUrl ?? "");
  if (!url) {
    return NextResponse.json({ error: "Not an Instagram post link" }, { status: 400 });
  }

  try {
    const post = await fetchInstagramPost(url);
    const shortcode = url.split("/").filter(Boolean).pop() ?? "post";

    // Image copy and place search are independent — run together.
    const [imageUrl, candidates] = await Promise.all([
      post.imageUrl ? storeImage(post.imageUrl, shortcode) : Promise.resolve(null),
      post.locationName ? searchPlaces(post.locationName).then((c) => c.slice(0, 5)) : Promise.resolve([]),
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
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Could not read post";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
