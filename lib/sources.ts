/**
 * The links Vicolo accepts: an Instagram post, a TikTok video, or a Google
 * Maps place. Client and server share this parser. Short links
 * (vm.tiktok.com, maps.app.goo.gl) are accepted as-is; the server follows them
 * to the real URL, and that canonical URL is what gets saved.
 */
import { normalizeInstagramUrl } from "./instagram";

export type SourceKind = "instagram" | "tiktok" | "google";
export type Source = { kind: SourceKind; url: string };

export const SOURCE_LABEL: Record<SourceKind, string> = { instagram: "Instagram", tiktok: "TikTok", google: "Google Maps" };

export function parseSourceUrl(input: string): Source | null {
  const raw = input.trim().replace(/[.,!?;:]+$/, "");
  const ig = normalizeInstagramUrl(raw);
  if (ig) return { kind: "instagram", url: ig };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // Share sheets sometimes provide a caption followed by the link, rather
    // than a URL item. Try every URL in the text, not just the first one.
    for (const match of raw.matchAll(/https?:\/\/[^\s<>]+/g)) {
      const link = match[0].replace(/[.,!?;:]+$/, "");
      if (link === raw) continue;
      const source = parseSourceUrl(link);
      if (source) return source;
    }
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");

  if (host === "tiktok.com") {
    const m = u.pathname.match(/^\/@([\w.-]+)\/(?:video|photo)\/(\d+)/);
    return m ? { kind: "tiktok", url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}` } : null;
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return u.pathname.length > 1 ? { kind: "tiktok", url: `https://${host}${u.pathname}` } : null;
  }
  if (host === "maps.app.goo.gl" || (host === "goo.gl" && u.pathname.startsWith("/maps"))) {
    return { kind: "google", url: u.toString() };
  }
  if (/^(maps\.)?google\.[a-z.]+$/.test(host) && (host.startsWith("maps.") || u.pathname.startsWith("/maps"))) {
    return { kind: "google", url: u.toString() };
  }
  return null;
}

export function sourceKind(url: string): SourceKind {
  return parseSourceUrl(url)?.kind ?? "instagram";
}
