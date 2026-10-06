"use client";

import { useEffect, useRef, useState } from "react";
import PlaceCard from "./PlaceCard";
import type { Place } from "./types";

/**
 * One place, as a pull-up sheet over the map, list or tile grid (Apple Maps
 * style). Opens short: photo strip, name, actions. Drag up → the full card;
 * drag down → back to short, or away. The map behind stays live; tapping it closes.
 *
 * Motion (Sarp, 2026-10-06: it felt abrupt): it slides up from the edge, slides
 * back down when closed (however it was closed), and the photo grows between
 * short and full instead of the card being swapped.
 */
type Props = { place: Place | null; onClose: () => void; onEdit: (p: Place) => void; onDelete: (p: Place) => void };

const EXIT_MS = 260;

export default function PeekCard({ place, ...rest }: Props) {
  // The last place stays on screen while it slides away.
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
  return <Sheet place={shown} leaving={leaving} {...rest} />;
}

function Sheet({ place, leaving, onClose, onEdit, onDelete }: Omit<Props, "place"> & { place: Place; leaving: boolean }) {
  const [full, setFull] = useState(false);
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

  // A different place opens short again.
  useEffect(() => {
    setFull(false);
    setDy(0);
  }, [place.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function down(e: React.PointerEvent) {
    drag.current = { y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = e.clientY - drag.current.y;
    if (Math.abs(d) > 4) drag.current.moved = true;
    // Resist dragging past the top; follow freely downward.
    setDy(d < 0 ? d / (full ? 4 : 1.5) : d);
  }
  function up() {
    const d = dy;
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved) {
      setDy(0);
      setFull((f) => !f); // a tap on the handle toggles
      return;
    }
    // Dragged away: keep the offset, so it leaves from where the finger let go.
    if (d > 80 && !full) return onClose();
    setDy(0);
    if (d < -50) setFull(true);
    else if (d > 80) setFull(false);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label={place.name}>
      <div
        className={`pinsta-sheet relative flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(0_0_0/0.12)] ${leaving ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{
          transform: leaving ? `translateY(calc(100% + ${Math.max(dy, 0) + 24}px))` : `translateY(${Math.max(dy, full ? -20 : -120)}px)`,
          transition: drag.current
            ? "none"
            : leaving
              ? `transform ${EXIT_MS}ms cubic-bezier(.4,0,1,1)`
              : "transform 420ms cubic-bezier(.32,.72,0,1)",
        }}
      >
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            setFull((f) => !f);
          }}
          aria-label={full ? "Show less" : "Show more"}
          aria-expanded={full}
          role="button"
          tabIndex={0}
        >
          <span className="h-1.5 w-10 rounded-full bg-stone-300" />
        </div>
        <div className={full ? "overflow-y-auto" : "overflow-hidden"}>
          {/* Not re-keyed by size: the same card stays, so its photo can grow (PlaceCard). */}
          <PlaceCard place={place} compact={!full} expanded={full} onEdit={() => onEdit(place)} onDelete={() => onDelete(place)} />
        </div>
      </div>
    </div>
  );
}
