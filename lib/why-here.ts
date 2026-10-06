/**
 * The card's "why it's here" line: where a place came from, said the way you'd
 * remember it, not as metadata (Sarp, 2026-10-06). Built only from what the row
 * already has; imports from before from_list existed just say Google Maps.
 * Wording is a first draft: worth a pass with Sander.
 *
 *   Saved from @burro_cafe on Instagram · 3 Oct
 *   From Emilie's "Paris" list · 12 Sep
 *   Saved from a Google Maps link · 2 Oct 2025
 */
import { sourceKind } from "./sources";

type Row = {
  instagramUrl: string;
  ownerUsername: string | null;
  fromList?: { title: string | null; owner: string | null } | null;
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
    case "google":
      // ImportPage saves imports as maps/search/?api=1 links; a shared Maps link never looks like that.
      return p.instagramUrl.includes("/maps/search/?api=1") ? "From a Google Maps list" : "Saved from a Google Maps link";
    default:
      return by ? `Saved from ${by} on Instagram` : "Saved from an Instagram post";
  }
}

/** "3 Oct", with the year once it isn't this year's. */
function when(d: Date, now: Date): string {
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

// Spelled out: the en-GB locale says "Sept".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
