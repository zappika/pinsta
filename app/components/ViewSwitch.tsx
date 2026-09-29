"use client";

import type { ReactNode } from "react";

export type View = "map" | "list" | "cards" | "tiles";

/** Simple line glyphs, one per view. 20px, 1.75 stroke, currentColor. */
const glyph = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const VIEWS: { value: View; label: string; icon: ReactNode }[] = [
  {
    value: "map",
    label: "Map",
    icon: glyph(<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5" />),
  },
  {
    value: "list",
    label: "List",
    icon: glyph(
      <>
        <rect x="3" y="4.5" width="5" height="5" rx="1.25" />
        <rect x="3" y="14.5" width="5" height="5" rx="1.25" />
        <path d="M11 6h10M11 8.5h6M11 16h10M11 18.5h6" />
      </>,
    ),
  },
  {
    value: "cards",
    label: "Cards",
    icon: glyph(
      <>
        <rect x="4" y="3.5" width="16" height="12" rx="2" />
        <path d="M4 19.5h16" />
      </>,
    ),
  },
  {
    value: "tiles",
    label: "Tiles",
    icon: glyph(
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.25" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.25" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.25" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.25" />
      </>,
    ),
  },
];

/** Segmented pill of glyphs: how the current Where/What selection is shown. */
export default function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="tablist" className="pointer-events-auto mx-auto flex w-fit gap-0.5 rounded-full bg-white p-1 shadow-lg shadow-stone-900/10">
      {VIEWS.map((v) => {
        const active = v.value === view;
        return (
          <button
            key={v.value}
            role="tab"
            aria-selected={active}
            aria-label={v.label}
            title={v.label}
            type="button"
            onClick={() => onChange(v.value)}
            className={`flex h-10 w-12 items-center justify-center rounded-full transition-colors ${
              active ? "bg-stone-900 text-white" : "text-stone-500 active:bg-stone-100"
            }`}
          >
            {v.icon}
          </button>
        );
      })}
    </div>
  );
}
