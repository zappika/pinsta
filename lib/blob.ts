import { put } from "@vercel/blob";

/**
 * Copy an Instagram CDN image into our Blob store. IG URLs expire within days
 * and refuse hotlinking, so the stored URL must be ours.
 */
export async function storeImage(sourceUrl: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Pinsta/0.1)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const blob = await put(`posts/${key}.${ext}`, await res.arrayBuffer(), {
      access: "public",
      contentType: type,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  } catch (e) {
    console.error("storeImage failed", e);
    return null;
  }
}
