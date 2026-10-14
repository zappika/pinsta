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

// Paths that aren't accounts.
const NOT_HANDLES = new Set(["p", "reel", "reels", "tv", "explore", "accounts", "stories", "direct", "about", "legal", "developer", "web"]);

/**
 * A profile link (instagram.com/restaurangvra/?hl=en) or a bare "@restaurangvra" →
 * https://www.instagram.com/restaurangvra/. A venue's own account is the venue
 * (Mert, 2026-10-14: "save places directly from the IG account"). Same rule in PostReader.swift.
 */
export function normalizeInstagramProfile(input: string): string | null {
  const s = input.trim();
  const at = s.match(/^@([\w.]{3,30})$/);
  if (at) return `https://www.instagram.com/${at[1].toLowerCase()}/`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host !== "instagram.com") return null;
  const m = url.pathname.match(/^\/([\w.]{2,30})\/?$/);
  if (!m || NOT_HANDLES.has(m[1].toLowerCase())) return null;
  return `https://www.instagram.com/${m[1].toLowerCase()}/`;
}
