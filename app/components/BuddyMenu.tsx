"use client";

import { useEffect, useRef, useState } from "react";
import { MAPS_LABEL, chooseMaps, defaultMaps } from "@/lib/directions";
import { setTheme, storedTheme, type Theme } from "@/lib/theme";

/**
 * The round "you" button, top right. A home for account-ish things later;
 * today: appearance, the directions app, and locking this browser (forgets the owner key).
 */
export default function BuddyMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => setThemeState(storedTheme()), [open]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto self-center">
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-stone-600 active:bg-stone-300"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-60 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
          <div className="px-4 py-3">
            <p className="mb-2 text-sm font-medium">Appearance</p>
            <div role="radiogroup" aria-label="Appearance" className="flex rounded-full bg-stone-100 p-0.5">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={theme === t}
                  onClick={() => {
                    setTheme(t);
                    setThemeState(t);
                  }}
                  className={`flex-1 rounded-full py-1.5 text-xs font-medium capitalize transition-colors ${
                    theme === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              chooseMaps();
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium active:bg-stone-50"
          >
            Directions
            <span className="text-stone-400">{(() => { const d = defaultMaps(); return d ? MAPS_LABEL[d] : "Ask each time"; })()}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem("pinsta-owner-key");
              } catch {}
              location.reload();
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium active:bg-stone-50"
          >
            Lock this browser
          </button>
        </div>
      )}
    </div>
  );
}
