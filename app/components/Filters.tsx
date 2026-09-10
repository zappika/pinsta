"use client";

import { useMemo } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { Place } from "./types";

type Props = {
  places: Place[];
  city: string | null;
  category: string | null;
  onCity: (c: string | null) => void;
  onCategory: (c: string | null) => void;
};

export default function Filters({ places, city, category, onCity, onCategory }: Props) {
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) if (p.city) counts.set(p.city, (counts.get(p.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [places]);

  const categories = useMemo(() => {
    const present = new Set(places.map((p) => p.category));
    return CATEGORIES.filter((c) => present.has(c));
  }, [places]);

  return (
    <div className="space-y-2">
      {cities.length > 1 && (
        <ChipRow
          items={cities}
          selected={city}
          onSelect={onCity}
          allLabel="Everywhere"
        />
      )}
      {categories.length > 1 && (
        <ChipRow
          items={categories}
          selected={category}
          onSelect={onCategory}
          allLabel="All types"
        />
      )}
    </div>
  );
}

function ChipRow({
  items,
  selected,
  onSelect,
  allLabel,
}: {
  items: readonly string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  allLabel: string;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5">
      <Chip active={selected === null} onClick={() => onSelect(null)}>
        {allLabel}
      </Chip>
      {items.map((it) => (
        <Chip key={it} active={selected === it} onClick={() => onSelect(selected === it ? null : it)}>
          {it}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-stone-900 text-white" : "bg-white text-stone-700 active:bg-stone-200"
      }`}
    >
      {children}
    </button>
  );
}
