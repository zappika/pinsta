// Post → places, on the server: what /api/extract runs for the web, and what the search review
// replays (`scripts/review/replay-server.mts`) to see whether the server can do the phone's job too.
import { languageCountries, lifted } from "@/lib/language";
import { areaOfTag, getPlace, handleWithKind, locate, namesTag, profileMatches, resolveTag, resolveUntagged, searchPlaces, streetOfTag, type PlaceCandidate } from "@/lib/google-places";
import type { SourceKind } from "@/lib/sources";

export type PostClues = {
  locationName: string | null;
  caption: string | null;
  ownerFullName: string | null;
  ownerUsername: string | null;
  coauthors?: string[] | null;
  hashtags?: string[];
  category?: string | null;
  /** TikTok's location tag names its city. */
  city?: string | null;
  /** A Google Maps link's place id and pin. */
  placeId?: string | null;
  near?: { lat: number; lng: number } | null;
};

export type Resolved = {
  candidates: PlaceCandidate[];
  /** "tag": sure enough to save a lone match by itself; "account"/"link": offered; null: nothing found. */
  source: "tag" | "account" | "link" | null;
};

export async function resolvePost(kind: SourceKind, post: PostClues, cityHints: string[] = []): Promise<Resolved> {
  // A tag naming a town ("Ostuni, Puglia, Italy") or a street ("Vattugatan") says where, not what:
  // the venue is read off the post and searched there.
  const town = areaOfTag(post.locationName);
  const street = town ? null : streetOfTag(post.locationName);
  const source = kind === "google" ? "link" : post.locationName && !town && !street ? "tag" : "account";

  let pinned = false;
  let fellBack = false;
  const find = async (): Promise<PlaceCandidate[]> => {
    if (source === "link") {
      // An id Google won't resolve (stale, or a legacy CID) still has the name and pin to search by.
      if (post.placeId) {
        const byId = await getPlace(post.placeId).catch((e) => {
          console.warn("extract: link's place id failed, searching by name", e instanceof Error ? e.message : e);
          return null;
        });
        if (byId) return [byId];
      }
      return post.locationName ? (await searchPlaces(post.locationName, post.near)).slice(0, 3) : [];
    }
    if (source === "tag") {
      const tagged = (
        await resolveTag({
          tag: post.locationName!,
          ownerFullName: post.ownerFullName,
          ownerUsername: post.ownerUsername,
          coauthors: post.coauthors ?? [],
          caption: post.caption,
          hashtags: post.hashtags,
          cityHints,
          extraQueries: post.city ? [`${post.locationName} ${post.city}`] : [],
        })
      ).slice(0, 5);
      if (tagged.length) return tagged;
      // The tag found nothing ("VRÅ" on Broth Boy x Vrå, Mert 2026-10-14): read the post as if untagged.
      fellBack = true;
    }
    const near = street ? await locate(post.locationName!) : null;
    const r = await resolveUntagged({
      caption: post.caption,
      ownerFullName: post.ownerFullName,
      ownerUsername: post.ownerUsername,
      coauthors: post.coauthors ?? [],
      town,
      near,
      hint: fellBack ? post.locationName : null,
      hashtags: post.hashtags,
    });
    pinned = r.pinned;
    return r.candidates;
  };

  const found = await find();
  // A Google link names one place: the candidate nearest its pin comes first.
  const candidates =
    source === "link" && post.near && found.length > 1
      ? nearestFirst(found, post.near)
      : kind === "profile"
        ? profileMatches(found, { fullName: post.ownerFullName, username: post.ownerUsername, category: post.category ?? null })
        : // A Swedish caption: the Stockholm Liebling before the Viennese one.
          lifted(found, languageCountries(post.caption, handleWithKind(post.ownerUsername)));

  return {
    candidates: source === "link" && candidates.length > 1 && isClear(candidates, post.near ?? null) ? candidates.slice(0, 1) : candidates,
    // The caption's 📍 line names the place as surely as a tag does.
    // A profile is the venue: its match is trusted like a tag.
    // A tag's lone result that doesn't carry the tag's name is a guess, offered, not saved ("Bar Sagarra", 2026-11-08).
    source: candidates.length
      ? pinned || kind === "profile" ? "tag"
      : fellBack || (source === "tag" && candidates.length === 1 && !namesTag(candidates[0], post.locationName!)) ? "account"
      : source
      : null,
  };
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
