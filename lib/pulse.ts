import type { Install, Save, Use } from "@/lib/db/schema";

/**
 * Pulse (backoffice home, Sarp 2026-10-18): four questions about the beta, answered from what
 * the phones already report (`saves`, `uses`) — no new data, apart from the retrieval counts
 * builds from RETRIEVAL_BUILD send. At beta size the unit is the phone, not a percentage:
 * every number here can be traced to a row in the Phones list.
 *
 *   Can people save what they want?        clean / rescued / missed saves
 *   Which posts break it?                  misses by kind of link (Saves page has the links)
 *   Do they come back to save more?        phones that saved on 2+ days; who went quiet
 *   Do they come back to find something?   days with a place opened, Directions or a post, and no save
 */

/** First build whose phones count place.open / directions / post.open / visited. */
export const RETRIEVAL_BUILD = 31;
/** A phone that was active before and not in this many days has gone quiet. */
export const QUIET_DAYS = 7;
const LOOK_EVENTS = ["place.open", "directions", "post.open"];

export type Band = "clean" | "rescued" | "missed";

/**
 * How a save sheet ended, in three bands. Clean: the app found it alone (saved by itself, the first
 * suggestion, a list post). Rescued: it worked, but the person had to dig (a lower suggestion, a
 * typed search). Missed: gave up. "Already in Vicolo" and later changes aren't tries.
 */
export function bandOf(s: Save): Band | null {
  switch (s.outcome) {
    case "auto":
    case "many":
      return "clean";
    case "picked":
      return (s.detail.rank ?? 0) > 0 ? "rescued" : "clean";
    case "searched":
      return "rescued";
    case "gave_up":
      return "missed";
    default:
      return null;
  }
}

/** What kind of link (or a typed name). */
export function sourceOf(url: string | null): string {
  if (!url) return "Typed a name";
  if (/tiktok\.com/.test(url)) return "TikTok";
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(url)) return "Google Maps";
  if (/instagram\.com\/(p|reel|reels|tv)\//.test(url)) return /\/(reel|reels|tv)\//.test(url) ? "Instagram reel" : "Instagram post";
  if (/instagram\.com|^@/.test(url)) return "Instagram profile";
  return /^https?:/.test(url) ? "Other link" : "Typed a name";
}

/** A save that is a case to open: gave up, or the post couldn't be read. */
export const isMiss = (s: Save) => s.outcome === "gave_up" || !!s.detail.readError;

export type Phone = {
  install: string;
  label: string | null;
  me: boolean;
  build: number | null;
  firstSeen: string;
  lastSeen: string;
  /** Days with an open or a save, last 14. */
  activeDays14: number;
  saves: number;
  savesThisWeek: number;
  /** Distinct days with a save. */
  saveDays: number;
  misses: number;
  /** Days a place was looked at (opened, Directions, post) without a save that day. */
  lookDays: number;
  directions: number;
  visited: number;
  /** On a build that counts looking things up. */
  counts: boolean;
  quiet: boolean;
};

const dayOf = (at: Date | string) => new Date(at).toISOString().slice(0, 10);
export const daysAgo = (day: string) => Math.floor((Date.now() - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);

export function phones(saves: Save[], uses: Use[], labels: Install[]): Phone[] {
  const ids = new Set([...saves.map((s) => s.install), ...uses.map((u) => u.install)]);
  const named = new Map(labels.map((l) => [l.install, l]));
  return [...ids]
    .map((install) => {
      const mySaves = saves.filter((s) => s.install === install);
      const myUses = uses.filter((u) => u.install === install && u.count > 0);
      const saveDays = new Set(mySaves.filter((s) => bandOf(s) !== "missed").map((s) => dayOf(s.at)));
      const days = new Set([...myUses.map((u) => u.day), ...mySaves.map((s) => dayOf(s.at))]);
      const sorted = [...days].sort();
      const lookedOn = new Set(myUses.filter((u) => LOOK_EVENTS.includes(u.event)).map((u) => u.day));
      const sum = (event: string) => myUses.filter((u) => u.event === event).reduce((n, u) => n + u.count, 0);
      const build = Math.max(0, ...mySaves.map((s) => s.build ?? 0), ...myUses.map((u) => u.build ?? 0)) || null;
      const lastSeen = sorted[sorted.length - 1];
      const tries = mySaves.filter((s) => bandOf(s));
      return {
        install,
        label: named.get(install)?.label ?? null,
        me: named.get(install)?.me ?? false,
        build,
        firstSeen: sorted[0],
        lastSeen,
        activeDays14: sorted.filter((d) => daysAgo(d) < 14).length,
        saves: tries.filter((s) => bandOf(s) !== "missed").length,
        savesThisWeek: tries.filter((s) => bandOf(s) !== "missed" && daysAgo(dayOf(s.at)) < 7).length,
        saveDays: saveDays.size,
        misses: mySaves.filter(isMiss).length,
        lookDays: [...lookedOn].filter((d) => !saveDays.has(d)).length,
        directions: sum("directions"),
        visited: sum("visited"),
        counts: (build ?? 0) >= RETRIEVAL_BUILD,
        quiet: daysAgo(lastSeen) >= QUIET_DAYS,
      };
    })
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}

export type Pulse = {
  tries: number;
  bands: Record<Band, number>;
  /** Saves re-picked later: most likely a wrong automatic save. */
  changed: number;
  missesByKind: [string, number][];
  phones: Phone[];
  /** Phones with a save at all, and of those, saved on 2+ days. */
  savers: number;
  returners: number;
  quiet: Phone[];
  /** Phones on a build that counts looking up, and of those, looked something up on a day without saving. */
  counting: number;
  lookers: number;
  byBuild: { build: number; tries: number; clean: number; missed: number }[];
};

/** Saves are the last 30 days for the rates; phones use everything given (90 days). */
export function pulse(saves: Save[], uses: Use[], labels: Install[], { includeMe }: { includeMe: boolean }): Pulse {
  const me = new Set(labels.filter((l) => l.me).map((l) => l.install));
  const keep = <T extends { install: string }>(rows: T[]) => (includeMe ? rows : rows.filter((r) => !me.has(r.install)));
  const s = keep(saves);
  const u = keep(uses);
  const recent = s.filter((r) => daysAgo(dayOf(r.at)) < 30);
  const tried = recent.filter((r) => bandOf(r));
  const bands: Record<Band, number> = { clean: 0, rescued: 0, missed: 0 };
  for (const r of tried) bands[bandOf(r)!]++;

  const kinds = new Map<string, number>();
  for (const r of recent.filter(isMiss)) kinds.set(sourceOf(r.url), (kinds.get(sourceOf(r.url)) ?? 0) + 1);

  const builds = new Map<number, { build: number; tries: number; clean: number; missed: number }>();
  for (const r of tried) {
    if (r.build == null) continue;
    const b = builds.get(r.build) ?? { build: r.build, tries: 0, clean: 0, missed: 0 };
    b.tries++;
    if (bandOf(r) === "clean") b.clean++;
    if (bandOf(r) === "missed") b.missed++;
    builds.set(r.build, b);
  }

  const list = phones(s, u, labels);
  const savers = list.filter((p) => p.saves > 0);
  const counting = list.filter((p) => p.counts);
  return {
    tries: tried.length,
    bands,
    changed: recent.filter((r) => r.outcome === "changed").length,
    missesByKind: [...kinds.entries()].sort((a, b) => b[1] - a[1]),
    phones: list,
    savers: savers.length,
    returners: savers.filter((p) => p.saveDays >= 2).length,
    quiet: list.filter((p) => p.quiet && daysAgo(p.firstSeen) >= QUIET_DAYS),
    counting: counting.length,
    lookers: counting.filter((p) => p.lookDays > 0).length,
    byBuild: [...builds.values()].sort((a, b) => b.build - a.build),
  };
}

export const phoneName = (p: { install: string; label: string | null }) => p.label ?? p.install.slice(0, 8);
