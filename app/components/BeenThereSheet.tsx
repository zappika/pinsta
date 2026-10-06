"use client";

import { useEffect } from "react";
import { iconFor, tintFor } from "@/lib/categories";
import { FACES, Face } from "./PlaceCard";
import type { Place } from "./types";

/**
 * The places marked Been there, from the buddy menu: a plain list, the latest
 * marked first, each with its face. No dates and no sorting controls (Sarp,
 * 2026-10-06: today's dates are the day of marking, not of the visit; this is
 * built for later). Same floating card as Settings and Usage.
 */
export default function BeenThereSheet({ places, onClose }: { places: Place[]; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const been = places
    .filter((p) => p.visitedAt != null)
    .sort((a, b) => new Date(b.visitedAt!).getTime() - new Date(a.visitedAt!).getTime());

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Been there">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Been there{been.length > 0 && ` · ${been.length}`}</p>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
            Done
          </button>
        </div>

        {been.length === 0 ? (
          <p className="px-4 pt-2 pb-6 text-sm text-stone-500">Nothing yet. Open a place and tap Been there.</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-y-auto overscroll-contain pb-2">
            {been.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tintFor(p.category) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconFor(p.category)} alt="" draggable={false} className="h-6 w-6 object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-stone-500">{[p.category, p.city].filter(Boolean).join(" · ")}</p>
                </div>
                {p.rating != null && (
                  <span className="shrink-0 text-stone-700" title={FACES[p.rating - 1]} aria-label={FACES[p.rating - 1]} role="img">
                    <Face kind={p.rating} size={24} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
