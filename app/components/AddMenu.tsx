"use client";

import { useEffect } from "react";
import type { AddMode } from "./AddPlace";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (mode: AddMode) => void;
};

/**
 * The + fans out what can be added, Path style but straight up from the button: a
 * radial fan from a corner loses half its circle off screen (Sarp, 2026-10-16).
 * Labelled pills, staggered, the + turning into × beneath them. Tap outside closes.
 */
export default function AddMenu({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items: { mode: AddMode; label: string; hint: string; icon: React.ReactNode }[] = [
    {
      mode: "here",
      label: "Where I am",
      hint: "The place you're at",
      // A shop front, not the locate arrow: the two read as one button on the map (Sarp, 2026-10-26).
      icon: (
        <>
          <path d="M4 9.5 5.5 4.5h13L20 9.5" />
          <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
          <path d="M5.5 12v7.5h13V12" />
          <path d="M10 19.5v-4.5h4v4.5" />
        </>
      ),
    },
    {
      mode: "google",
      label: "Google Maps",
      hint: "A place or a shared list",
      icon: (
        <>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </>
      ),
    },
    {
      mode: "post",
      label: "Instagram post",
      hint: "Paste its link",
      icon: (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
        </>
      ),
    },
  ];

  return (
    <div className={`fixed inset-0 z-20 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-stone-900/25 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col items-end gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem+3.5rem+1rem)]">
        {items.map((it, i) => {
          // The one nearest the + comes out first and goes back last.
          const order = items.length - 1 - i;
          return (
            <button
              key={it.mode}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => onPick(it.mode)}
              className="pointer-events-auto flex w-56 items-center justify-between gap-3 rounded-full bg-white py-2 pl-4 pr-2 text-left shadow-lg shadow-stone-900/15 active:scale-[0.97]"
              style={{
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0) scale(1)" : `translateY(${(order + 1) * 24}px) scale(0.6)`,
                transformOrigin: "100% 100%",
                transition: `transform 320ms cubic-bezier(.34,1.56,.64,1) ${(open ? order : i) * 45}ms, opacity 180ms ease ${(open ? order : i) * 45}ms`,
              }}
            >
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold text-stone-900">{it.label}</span>
                <span className="text-xs text-stone-500">{it.hint}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-800">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {it.icon}
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
