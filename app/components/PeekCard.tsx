"use client";

import PlaceCard from "./PlaceCard";
import type { Place } from "./types";

/**
 * One place, floated above the map or tile grid. Sits just above the
 * bottom controls; tap outside or the × to dismiss.
 */
export default function PeekCard({ place, onClose }: { place: Place; onClose: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] z-10 mx-auto max-w-md px-5">
      <div className="pointer-events-auto relative overflow-hidden rounded-2xl bg-white shadow-xl shadow-stone-900/15">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <PlaceCard place={place} compact />
      </div>
    </div>
  );
}
