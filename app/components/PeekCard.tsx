"use client";

import { useEffect, useRef, useState } from "react";
import PlaceCard, { type VisitChange } from "./PlaceCard";
import type { Place } from "./types";

/**
 * One place, as a card floating over the map, list or tiles: the big photo,
 * name and actions, and why it's here. One size (Sarp, 2026-10-06: the full
 * state looked best, and the short sheet glued to the edge felt cut off). It
 * fades up in, fades down out, follows a swipe down on the photo and leaves
 * from there. Tapping the map behind, the ×, or Escape closes it.
 */
type Props = { place: Place | null; onClose: () => void; onEdit: (p: Place) => void; onDelete: (p: Place) => void; onVisit: (p: Place, c: VisitChange) => void };

const EXIT_MS = 200;

export default function PeekCard({ place, ...rest }: Props) {
  // The last place stays on screen while it fades away.
  const [shown, setShown] = useState(place);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (place) {
      setShown(place);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const t = setTimeout(() => setShown(null), EXIT_MS);
    return () => clearTimeout(t);
  }, [place]);
  if (!shown) return null;
  return <Card place={shown} leaving={leaving} {...rest} />;
}

function Card({ place, leaving, onClose, onEdit, onDelete, onVisit }: Omit<Props, "place"> & { place: Place; leaving: boolean }) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number } | null>(null);

  useEffect(() => setDy(0), [place.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function down(e: React.PointerEvent) {
    drag.current = { y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = e.clientY - drag.current.y;
    // Follows a pull down; resists a pull up.
    setDy(d < 0 ? d / 5 : d);
  }
  function up() {
    drag.current = null;
    // Swiped away: keep the offset, so it leaves from where the finger let go.
    if (dy > 80) return onClose();
    setDy(0);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 mx-auto flex max-w-md flex-col justify-end px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" role="dialog" aria-label={place.name}>
      <div
        className={`pinsta-card relative max-h-[82dvh] overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-[0_12px_40px_rgb(0_0_0/0.18)] ${leaving ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{
          transform: leaving ? `translateY(${Math.max(dy, 0) + 24}px) scale(0.97)` : `translateY(${dy}px)`,
          opacity: leaving ? 0 : 1,
          transition: drag.current
            ? "none"
            : leaving
              ? `transform ${EXIT_MS}ms cubic-bezier(.4,0,1,1), opacity ${EXIT_MS}ms ease-in`
              : "transform 360ms cubic-bezier(.32,.72,0,1)",
        }}
      >
        {/* The photo is the handle: a swipe down on it closes the card. */}
        <div
          aria-hidden
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="absolute inset-x-0 top-0 z-10 h-56 cursor-grab touch-none active:cursor-grabbing"
        />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur active:bg-black/50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <PlaceCard place={place} expanded onEdit={() => onEdit(place)} onDelete={() => onDelete(place)} onVisit={(c) => onVisit(place, c)} />
      </div>
    </div>
  );
}
