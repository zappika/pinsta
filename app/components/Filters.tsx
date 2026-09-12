"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { Place } from "./types";

type Props = {
  places: Place[];
  /** Destination label per place id (see lib/grouping). */
  labels: Map<string, string>;
  city: string | null;
  category: string | null;
  onCity: (c: string | null) => void;
  onCategory: (c: string | null) => void;
};

type Option = { value: string | null; label: string; count: number };

/**
 * The header *is* the filter: "Barcelona ▾  Everything ▾".
 * Each half opens an action-sheet picker with counts.
 */
export default function Filters({ places, labels, city, category, onCity, onCategory }: Props) {
  const [open, setOpen] = useState<"city" | "category" | null>(null);

  const cityOptions = useMemo<Option[]>(() => {
    const counts = new Map<string, number>();
    for (const p of places) {
      const l = labels.get(p.id);
      if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: null, label: "Everywhere", count: places.length },
      ...sorted.map(([c, n]) => ({ value: c, label: c, count: n })),
    ];
  }, [places, labels]);

  const categoryOptions = useMemo<Option[]>(() => {
    // Counts respect the chosen destination so the picker never offers an empty result.
    const scoped = city ? places.filter((p) => labels.get(p.id) === city) : places;
    const counts = new Map<string, number>();
    for (const p of scoped) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [
      { value: null, label: "Everything", count: scoped.length },
      ...CATEGORIES.filter((c) => counts.has(c)).map((c) => ({
        value: c,
        label: pluralize(c),
        count: counts.get(c)!,
      })),
    ];
  }, [places, labels, city]);

  return (
    <>
      <header className="flex items-baseline gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
        <Trigger
          label={city ?? "Everywhere"}
          onClick={() => setOpen("city")}
          className="text-2xl font-semibold tracking-tight"
        />
        <Trigger
          label={category ? pluralize(category) : "Everything"}
          onClick={() => setOpen("category")}
          className="text-2xl font-semibold tracking-tight text-stone-400"
        />
      </header>

      {open === "city" && (
        <Picker
          title="Where"
          options={cityOptions}
          selected={city}
          onSelect={(v) => {
            onCity(v);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "category" && (
        <Picker
          title="What"
          options={categoryOptions}
          selected={category}
          onSelect={(v) => {
            onCategory(v);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function Trigger({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mx-1 flex min-w-0 items-center gap-1 rounded-lg px-1 py-0.5 active:bg-stone-200 ${className ?? ""}`}
    >
      <span className="truncate">{label}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 opacity-60"
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}

function Picker({
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  title: string;
  options: Option[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] overflow-hidden rounded-2xl bg-white">
        <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-stone-400">{title}</p>
        <ul className="divide-y divide-stone-100">
          {options.map((o) => {
            const active = o.value === selected;
            return (
              <li key={o.label}>
                <button
                  type="button"
                  onClick={() => onSelect(o.value)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left text-base active:bg-stone-50"
                >
                  <span className={active ? "font-semibold" : "font-medium"}>{o.label}</span>
                  <span className="flex items-center gap-3 text-sm tabular-nums text-stone-400">
                    {o.count}
                    {active && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="text-stone-900" aria-hidden>
                        <path d="M3 8.5l3.5 3.5L13 5" />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function pluralize(category: string) {
  if (category === "Nature" || category === "Other") return category;
  return category.endsWith("y") ? `${category.slice(0, -1)}ies` : `${category}s`;
}
