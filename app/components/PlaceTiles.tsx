"use client";

import { emojiFor } from "@/lib/categories";
import type { Place } from "./types";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place) => void;
};

/**
 * The Instagram profile grid: three across, edge to edge, portrait crops,
 * hairline gaps, no words. The name lives in the PeekCard a tap opens.
 * No photo → a quiet tile with the category glyph.
 */
export default function PlaceTiles({ places, selected, onSelect }: Props) {
  return (
    <ul className="grid grid-cols-3 gap-0.5">
      {places.map((p) => {
        const active = selected === p.id;
        return (
          <li key={p.id} className="relative aspect-[3/4]">
            <button
              type="button"
              aria-label={p.name}
              onClick={() => onSelect(p)}
              className="block h-full w-full overflow-hidden bg-stone-200"
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl">{emojiFor(p.category)}</span>
              )}
              {active && <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-stone-900" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
