"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const RAIL = 128; // two 48px round buttons + gaps
const FULL = 0.6; // past this fraction of the width, the swipe itself deletes

type Props = {
  children: ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Swipe right-to-left: the card slides over to reveal two round buttons,
 * edit and delete. Keep going, all the way, and the card flies off — deleted.
 */
export default function SwipeCard({ children, open, onOpen, onClose, onEdit, onDelete }: Props) {
  const [x, setXState] = useState(0);
  const xRef = useRef(0); // live position — state lags behind a fast swipe
  const setX = (v: number) => {
    xRef.current = v;
    setXState(v);
  };
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const justDragged = useRef(false); // the click that ends a drag is not a tap
  const ref = useRef<HTMLLIElement>(null);
  const start = useRef<{ x: number; y: number; base: number; axis: "h" | "v" | null } | null>(null);

  useEffect(() => {
    if (!dragging) setX(open ? -RAIL : 0);
  }, [open, dragging]);

  function width() {
    return ref.current?.offsetWidth ?? 360;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, base: open ? -RAIL : 0, axis: null };
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (s.axis === "h") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (s.axis !== "h") return;
    // Rubber-band past the closed position; free travel to the left.
    const raw = s.base + dx;
    setX(raw > 0 ? raw / 4 : Math.max(raw, -width()));
  }

  function onPointerUp() {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== "h") return;
    setDragging(false);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 300);
    const pos = xRef.current;
    if (pos < -width() * FULL) {
      fly();
    } else if (pos < -RAIL / 2) {
      setX(-RAIL);
      onOpen();
    } else {
      setX(0);
      onClose();
    }
  }

  function fly() {
    setGone(true);
    setX(-width() * 1.2);
    setTimeout(onDelete, 220);
  }

  return (
    <li ref={ref} className={`relative overflow-hidden rounded-2xl transition-[opacity,max-height] duration-200 ${gone ? "opacity-0" : ""}`}>
      <div className="absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-3" style={{ width: RAIL }} aria-hidden={!open}>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Change place"
          tabIndex={open ? 0 : -1}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-stone-700 active:bg-stone-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={fly}
          aria-label="Remove"
          tabIndex={open ? 0 : -1}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white active:bg-red-600"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (justDragged.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // A tap on an open card closes it instead of following links.
          if (open) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)", touchAction: "pan-y" }}
        className="relative select-none overflow-hidden rounded-2xl bg-white"
      >
        {children}
      </div>
    </li>
  );
}
