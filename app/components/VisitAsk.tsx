"use client";

import { useEffect, useState } from "react";
import { placeIcon, tintFor } from "@/lib/categories";
import { FACES, Face, type VisitChange } from "./PlaceCard";
import type { Place } from "./types";

/**
 * "Been to any of these?" on open (Sarp, 2026-10-26; who is asked when: lib/ask-visit.ts). One row a
 * place; Yes folds that row open into the faces, so two questions feel like one. Rows left alone stay
 * Want to go. One button closes it all: nobody answers place by place unless they want to.
 */
export default function VisitAsk({
  places,
  onVisit,
  onClose,
}: {
  places: Place[];
  onVisit: (p: Place, c: VisitChange) => void;
  onClose: () => void;
}) {
  // The rows as they were asked: marking one doesn't drop it from the sheet.
  const [rows] = useState(places);
  const [yes, setYes] = useState<Set<string>>(new Set());
  const [rated, setRated] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const label = rows.length === 1 ? `Been to ${rows[0].name}?` : "Been to any of these?";

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label={label}>
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
        <ul className="divide-y divide-stone-100 overflow-y-auto overscroll-contain">
          {rows.map((p) => {
            const open = yes.has(p.id);
            return (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Thumb place={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-sm text-stone-500">{[p.category, p.city].filter(Boolean).join(" · ")}</p>
                  </div>
                  {!open && (
                    <button
                      type="button"
                      onClick={() => {
                        setYes((s) => new Set(s).add(p.id));
                        onVisit(p, { visited: true });
                      }}
                      className="h-9 shrink-0 rounded-full bg-stone-100 px-4 text-sm font-medium text-stone-800 active:bg-stone-200"
                    >
                      Yes
                    </button>
                  )}
                </div>
                {open && (
                  <div className="pinsta-fade mt-3">
                    <p className="mb-2 text-sm text-stone-500">How was it?</p>
                    <div role="radiogroup" aria-label={`How was ${p.name}`} className="flex gap-2">
                      {FACES.map((name, i) => {
                        const on = rated.get(p.id) === i + 1;
                        return (
                          <button
                            key={name}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-label={name}
                            title={name}
                            onClick={() => {
                              setRated((m) => new Map(m).set(p.id, i + 1));
                              onVisit(p, { rating: i + 1 });
                            }}
                            className={`flex h-12 flex-1 items-center justify-center rounded-2xl transition-colors ${
                              on ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 active:bg-stone-200"
                            }`}
                          >
                            <Face kind={i + 1} size={26} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="px-4 pt-2 pb-4">
          <button type="button" onClick={onClose} className="h-12 w-full rounded-2xl bg-stone-900 text-sm font-semibold text-white active:opacity-80">
            {yes.size > 0 ? "Done" : "Not yet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Thumb({ place }: { place: Place }) {
  if (place.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={place.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-stone-100 object-cover" />;
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tintFor(place.category) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={placeIcon(place)} alt="" className="h-7 w-7 object-contain" />
    </span>
  );
}
