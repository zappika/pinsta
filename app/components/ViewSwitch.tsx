"use client";

export type View = "map" | "cards" | "tiles";

const VIEWS: { value: View; label: string }[] = [
  { value: "map", label: "Map" },
  { value: "cards", label: "Cards" },
  { value: "tiles", label: "Tiles" },
];

/** Segmented pill: how the current Where/What selection is shown. */
export default function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="tablist" className="pointer-events-auto mx-auto flex w-fit rounded-full bg-white p-1 shadow-lg shadow-stone-900/10">
      {VIEWS.map((v) => {
        const active = v.value === view;
        return (
          <button
            key={v.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(v.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-stone-900 text-white" : "text-stone-600 active:bg-stone-100"
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
