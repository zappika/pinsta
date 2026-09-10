/**
 * Accept post / reel / tv links, strip tracking params, return a canonical URL.
 * Returns null for anything that isn't an Instagram post link.
 */
const IG_PATH = /^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)\/?$/;

export function normalizeInstagramUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "instagram.com" && host !== "instagr.am") return null;
  const m = url.pathname.match(IG_PATH);
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  return `https://www.instagram.com/${kind}/${m[2]}/`;
}
