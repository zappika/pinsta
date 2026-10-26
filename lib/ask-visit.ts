/**
 * "Been to any of these?" (Sarp, 2026-10-26): asked later, never at the save. A place saved where you
 * stood (`savedNearby`) is asked on the first open on a later day; one saved from a post or a share a
 * week on. Twice at most, a week apart, then never. Never list imports or places already marked.
 * Same rule as `Services/AskVisit.swift`. Change one, change the other.
 */
type Askable = {
  createdAt: Date | string;
  visitedAt: Date | string | null;
  fromList: unknown;
  savedNearby?: boolean;
  askedAt?: Date | string | null;
  askCount?: number;
};

export const ASK_AFTER_DAYS = 7;
export const ASK_AT_MOST = 2;
/** Rows in one sheet: nearby saves first, then the newest. */
export const ASK_ROWS = 4;

const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dueToAsk<P extends Askable>(places: P[], now = new Date()): P[] {
  return places
    .filter((p) => {
      if (p.visitedAt != null || p.fromList != null || (p.askCount ?? 0) >= ASK_AT_MOST) return false;
      if (p.askedAt && now.getTime() - new Date(p.askedAt).getTime() < ASK_AFTER_DAYS * DAY) return false;
      const saved = new Date(p.createdAt);
      return p.savedNearby ? startOfDay(saved) < startOfDay(now) : now.getTime() - saved.getTime() >= ASK_AFTER_DAYS * DAY;
    })
    .sort((a, b) => Number(!!b.savedNearby) - Number(!!a.savedNearby) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, ASK_ROWS);
}

/** A save this close to where you stood counts as saved there. */
export const SAVED_HERE_M = 150;
