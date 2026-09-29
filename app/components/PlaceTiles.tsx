"use client";

import { emojiFor, tintFor } from "@/lib/categories";
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
 * Short grid → empty placeholder tiles fill out the first two rows, like an
 * Instagram profile with few posts, with a nudge in the first free cell.
 */
const MIN_TILES = 6;
export default function PlaceTiles({ places, selected, onSelect }: Props) {
  const fill = Math.max(0, MIN_TILES - places.length);
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
              className="block h-full w-full overflow-hidden"
              style={{ backgroundColor: tintFor(p.category) }}
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
      {Array.from({ length: fill }, (_, i) => (
        <li key={`empty-${i}`} aria-hidden className="aspect-[3/4] bg-stone-200/50">
          {i === 0 && (
            <span className="flex h-full w-full items-center justify-center px-3 text-center text-xs leading-snug text-stone-400">
              Share posts from Instagram to fill your grid
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
