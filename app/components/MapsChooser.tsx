"use client";

import { useEffect } from "react";
import { MAPS_LABEL, type MapsApp } from "@/lib/directions";

/** "Open directions in…" — asked once, same sheet style as the Where/What pickers. */
export default function MapsChooser({ current, onPick, onClose }: { current: MapsApp | null; onPick: (a: MapsApp) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Open directions in">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] overflow-hidden rounded-2xl bg-white">
        <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-stone-400">Open directions in</p>
        <ul className="divide-y divide-stone-100">
          {(["apple", "google"] as const).map((a) => (
            <li key={a}>
              <button type="button" onClick={() => onPick(a)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-base font-medium active:bg-stone-50">
                {MAPS_LABEL[a]}
                {current === a && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
