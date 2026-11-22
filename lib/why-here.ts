/**
 * The card's "why it's here" line: where a place came from, said the way you'd
 * remember it, not as metadata (Sarp, 2026-10-06). Built only from what the row
 * already has; imports from before from_list existed just say Google Maps.
 * Wording is a first draft: worth a pass with Sander.
 *
 *   Saved from @burro_cafe on Instagram · 3 Oct
 *   From Emilie's "Paris" list · 12 Sep
 *   Saved from a Google Maps link · 2 Oct 2025
 *   Saved when you were here · 22 Nov   (a typed name or a Check in, saved within 150 m)
 */
import { sourceKind } from "./sources";

type Row = {
  instagramUrl: string;
  ownerUsername: string | null;
  fromList?: { title: string | null; owner: string | null } | null;
  savedNearby?: boolean;
  createdAt: Date | string;
};

export function whyHere(p: Row, now = new Date()): string {
  return `${origin(p)} · ${when(new Date(p.createdAt), now)}`;
}

function origin(p: Row): string {
  const list = p.fromList;
  if (list?.owner || list?.title) {
    const who = list.owner ? `${list.owner.split(/\s+/)[0]}’s` : "a";
    return list.title ? `From ${who} “${list.title}” list` : `From ${who} Google Maps list`;
  }
  const by = p.ownerUsername ? `@${p.ownerUsername.replace(/^@/, "")}` : null;
  switch (sourceKind(p.instagramUrl)) {
    case "tiktok":
      return by ? `Saved from ${by} on TikTok` : "Saved from a TikTok";
    case "profile":
      return by ? `Saved from ${by} on Instagram` : "Saved from an Instagram profile";
    case "google":
      // Saved by typing its name: a maps/search link carrying the place id (AddPlace mapsLink).
      if (p.instagramUrl.includes("query_place_id=")) return p.savedNearby ? "Saved when you were here" : "Saved by name";
      // ImportPage saves imports as maps/search/?api=1 links; a shared Maps link never looks like that.
      return p.instagramUrl.includes("/maps/search/?api=1") ? "From a Google Maps list" : "Saved from a Google Maps link";
    default:
      return by ? `Saved from ${by} on Instagram` : "Saved from an Instagram post";
  }
}

/**
 * What the post said, as the card quotes it under where it came from (Sarp, 2026-11-22: the
 * caption is usually why you saved it). The first sentence or line that says something (and the next
 * ones while they fit), with
 * hashtags, @mentions, links and emoji taken out; about 90 characters at most, cut at a word.
 * null when nothing readable is left.
 */
export function captionSnippet(caption: string | null | undefined, max = 90): string | null {
  if (!caption) return null;
  const clean = (t: string) =>
    t
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[#@][\p{L}\p{N}_.]+/gu, "")
      .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—•·|:,.]+|[\s\-–—•·|:,]+$/g, "")
      .trim();
  // An emoji often ends a sentence on Instagram ("Slow mornings ☕️ Our rooms…"): it splits too.
  const pieces = caption.split(/\n+|(?<=[.!?])\s+|\s*\p{Extended_Pictographic}[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]*/u).map(clean);
  // An address line ("The Blue Moon, 55 Rue de la Roquette, 75011 Paris": a comma and a postcode) isn't what the post said.
  const said = (t: string) => (t.split(" ").length >= 3 || t.length >= 8) && !(t.includes(",") && /\b\d{4,5}\b/.test(t));
  const first = pieces.findIndex(said);
  if (first < 0) return null;
  // A short first sentence takes the next ones while they fit ("sixers the first of many. Pastrami, pickles…").
  let text = pieces[first];
  for (const t of pieces.slice(first + 1).filter(said)) {
    const joined = /[.!?…]$/.test(text) ? `${text} ${t}` : `${text}. ${t}`;
    if (joined.length > max) break;
    text = joined;
  }
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[\s,;:–—-]+$/, "") + "…";
}

/** "3 Oct", with the year once it isn't this year's. */
function when(d: Date, now: Date): string {
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

// Spelled out: the en-GB locale says "Sept".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * How the venue's own website reads on the card: its Instagram as "@handle",
 * anything else as the bare address. null when it isn't a usable link.
 */
export function websiteLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "instagram.com") {
      const handle = u.pathname.split("/").filter(Boolean)[0];
      return handle && !["p", "reel", "explore"].includes(handle) ? `@${handle}` : "Instagram";
    }
    return host;
  } catch {
    return null;
  }
}
