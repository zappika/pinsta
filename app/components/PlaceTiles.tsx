"use client";

import { emojiFor } from "@/lib/categories";
import type { Place } from "./types";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place) => void;
};

/** Photo grid, two across. Tap a tile → PeekCard. */
export default function PlaceTiles({ places, selected, onSelect }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {places.map((p) => {
        const active = selected === p.id;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className={`block w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-2 transition-[box-shadow] ${
                active ? "ring-stone-900" : "ring-transparent"
              }`}
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" draggable={false} className="aspect-square w-full bg-stone-100 object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-stone-100 text-4xl">
                  {emojiFor(p.category)}
                </div>
              )}
              <div className="px-3 py-2.5">
                <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                <p className="truncate text-xs text-stone-500">{[p.category, p.city].filter(Boolean).join(" · ")}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
