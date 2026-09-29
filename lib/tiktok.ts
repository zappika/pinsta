/**
 * Read a public TikTok video with no key: the page's own rehydration JSON has
 * the caption, author and — when the creator tagged one — the location
 * ("poi": name, address, city). oEmbed is the fallback for caption, author and
 * thumbnail when the page is blocked. Server-side only.
 */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

export type TikTokPost = {
  url: string;
  caption: string | null;
  locationName: string | null;
  locationCity: string | null;
  imageUrl: string | null;
  ownerUsername: string | null;
  ownerFullName: string | null;
  hashtags: string[];
};

/** vm.tiktok.com/xyz → https://www.tiktok.com/@user/video/123 */
export async function canonicalTikTokUrl(url: string): Promise<string> {
  if (/^https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+/.test(url)) return url;
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
  const m = res.url.match(/tiktok\.com\/@([\w.-]+)\/(?:video|photo)\/(\d+)/);
  if (!m) throw new Error("That TikTok link doesn't lead to a video");
  return `https://www.tiktok.com/@${m[1]}/video/${m[2]}`;
}

type Item = {
  desc?: string;
  poi?: { name?: string; city?: string; address?: string } | null;
  author?: { uniqueId?: string; nickname?: string };
  video?: { cover?: string; originCover?: string };
  textExtra?: { hashtagName?: string }[];
};

export async function fetchTikTokPost(input: string): Promise<TikTokPost> {
  const url = await canonicalTikTokUrl(input);
  let item: Item | undefined;
  try {
    const page = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    const html = await page.text();
    const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) item = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  } catch (e) {
    console.warn("tiktok: page unreadable, falling back to oEmbed", e instanceof Error ? e.message : e);
  }

  let oembed: { title?: string; author_name?: string; author_unique_id?: string; thumbnail_url?: string } = {};
  try {
    const o = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (o.ok) oembed = await o.json();
  } catch {}

  if (!item && !oembed.title && !oembed.author_name) throw new Error("Video not found or not public");
  const caption = (item?.desc ?? oembed.title ?? "").trim() || null;
  const hashtags =
    item?.textExtra?.map((t) => t.hashtagName).filter((h): h is string => !!h) ??
    [...(caption ?? "").matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  return {
    url,
    caption,
    locationName: item?.poi?.name?.trim() || null,
    locationCity: item?.poi?.city?.trim() || null,
    imageUrl: oembed.thumbnail_url ?? item?.video?.originCover ?? item?.video?.cover ?? null,
    ownerUsername: item?.author?.uniqueId ?? oembed.author_unique_id ?? null,
    ownerFullName: item?.author?.nickname ?? oembed.author_name ?? null,
    hashtags,
  };
}
