"use client";

import { useEffect, useRef, useState } from "react";
import PlaceCard from "./PlaceCard";
import type { Place } from "./types";

/**
 * One place, as a pull-up sheet over the map, list or tile grid (Apple Maps
 * style). Opens short: photo strip, name, actions. Drag up → the full card;
 * drag down → back to short, or away. The map behind stays live; tapping it closes.
 */
type Props = { place: Place; onClose: () => void; onEdit: () => void; onDelete: () => void };

export default function PeekCard({ place, onClose, onEdit, onDelete }: Props) {
  const [full, setFull] = useState(false);
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

  // A different place opens short again.
  useEffect(() => setFull(false), [place.id]);

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
    setDy(0);
    if (!moved) {
      setFull((f) => !f); // a tap on the handle toggles
      return;
    }
    if (d < -50) setFull(true);
    else if (d > 80) full ? setFull(false) : onClose();
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label={place.name}>
      <div
        className="pinsta-rise pointer-events-auto relative flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(0_0_0/0.12)]"
        style={{
          transform: `translateY(${Math.max(dy, full ? -20 : -120)}px)`,
          transition: drag.current ? "none" : "transform 280ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          aria-label={full ? "Show less" : "Show more"}
          role="button"
        >
          <span className="h-1.5 w-10 rounded-full bg-stone-300" />
        </div>
        <div className={full ? "overflow-y-auto" : "overflow-hidden"}>
          <PlaceCard key={full ? "full" : "short"} place={place} compact={!full} expanded={full} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
