"use client";

import { emojiFor } from "@/lib/categories";
import { kmBetween } from "@/lib/geo";
import type { Place } from "./types";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place) => void;
  /** Known only after "Near me" was used; then each row shows its distance. */
  here: { lat: number; lng: number } | null;
  hideCategory?: boolean;
  hideCity?: (p: Place) => boolean;
};

/**
 * A directory list: rounded square photo on the left, name, type, then
 * "distance · town". Dense enough to scan twenty places without scrolling far.
 * Same card rules as everywhere: what the header already says is left out.
 */
export default function PlaceList({ places, selected, onSelect, here, hideCategory, hideCity }: Props) {
  return (
    <ul className="-mx-5 divide-y divide-stone-200/70">
      {places.map((p) => {
        const km = here ? kmBetween(here, p) : null;
        const where = [km !== null ? formatKm(km) : null, hideCity?.(p) ? null : p.city].filter(Boolean).join(" · ");
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className={`flex w-full items-center gap-4 px-5 py-3 text-left active:bg-stone-200/50 ${
                selected === p.id ? "bg-stone-200/50" : ""
              }`}
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-stone-200">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl">{emojiFor(p.category)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{p.name}</p>
                {!hideCategory && p.category && <p className="truncate text-sm text-stone-500">{p.category}</p>}
                {where && <p className="truncate text-sm text-stone-500">{where}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatKm(km: number) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
