/**
 * Finer types in the What menu (Sarp, 2026-10-15): when 2+ places in a category share a
 * Google `primaryType` ("wine_bar" among Bars), that type gets its own indented row under
 * the category. One place never does, nor a type that is the whole category, nor the
 * category's plain type ("restaurant", "bar"). The label copies Google's English name for
 * the type, which is the type id in words ("wine_bar" → "Wine bar").
 * A What value is "Bar" (the category) or "Bar/wine_bar" (one of its types).
 */

/** Types that only restate the bucket; never a row of their own. */
const PLAIN = new Set(["restaurant", "food", "bar", "cafe", "hotel", "lodging", "museum", "bakery", "store", "point_of_interest", "establishment", "tourist_attraction"]);
const MAX_PER_CATEGORY = 3;

type Typed = { category: string | null; primaryType?: string | null };

export type Subtype = { value: string; label: string; count: number };

/** The subtype rows under `category`, biggest first. */
export function subtypesOf(places: Typed[], category: string): Subtype[] {
  const inCategory = places.filter((p) => p.category === category);
  const counts = new Map<string, number>();
  for (const p of inCategory) {
    const t = p.primaryType;
    if (t && !PLAIN.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2 && n < inCategory.length)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_PER_CATEGORY)
    .map(([t, n]) => ({ value: `${category}/${t}`, label: typeLabel(t), count: n }));
}

/** Does a place belong to a What value ("Bar" or "Bar/wine_bar")? */
export function matchesWhat(p: Typed, what: string): boolean {
  const [category, type] = what.split("/");
  return p.category === category && (!type || p.primaryType === type);
}

/** Google's English name for a type id. */
export function typeLabel(type: string): string {
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The subtype in a What value, or null for a whole category. */
export function subtypeOf(what: string): string | null {
  return what.split("/")[1] ?? null;
}
