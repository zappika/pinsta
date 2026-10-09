import type { Place } from "@/lib/db/schema";

const PLURAL: Record<string, string> = { Bakery: "bakery", Cafe: "café", Nature: "nature spot", Other: "place" };

/**
 * The line above the name on the success card, from the list as it was before this save
 * (Sarp, 2026-10-09): new towns and new types only (the very first save is a new town).
 * The town wins over the type; nothing otherwise. Same rules in ios/Pinsta/Services/Milestone.swift.
 */
export function milestoneFor(saved: Pick<Place, "id" | "city" | "category">, before: Pick<Place, "id" | "city" | "category">[]): string | null {
  const others = before.filter((p) => p.id !== saved.id);
  const town = saved.city?.trim();
  if (town && !others.some((p) => p.city?.trim().toLowerCase() === town.toLowerCase())) return `Your first save in ${town}`;
  const type = saved.category;
  if (type && type !== "Other" && !others.some((p) => p.category === type)) return `Your first ${PLURAL[type] ?? type.toLowerCase()}`;
  return null;
}
