"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { subtypeOf, subtypesOf, typeLabel } from "@/lib/subtypes";
import BuddyMenu from "./BuddyMenu";
import type { Place } from "./types";

type Props = {
  places: Place[];
  /** Destination label per place id (see lib/grouping). */
  labels: Map<string, string>;
  city: string | null;
  category: string | null;
  onCity: (c: string | null) => void;
  onCategory: (c: string | null) => void;
  /** Send what's shown to a friend; absent while there's nothing to send (no town picked). */
  onSend?: () => void;
};

type Option = { value: string | null; label: string; count: number | null; sub?: boolean };

/**
 * The header *is* the filter: "Barcelona ▾  Everything ▾".
 * Each half opens an action-sheet picker with counts.
 * Experiment (Sarp, 2026-10-19): the home shows only What; Where is the What picker's last row,
 * "In…", and shows in the header only while a town is picked ("Everything in Barcelona").
 */
export default function Filters({ places, labels, city, category, onCity, onCategory, onSend }: Props) {
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
      ...CATEGORIES.filter((c) => counts.has(c)).flatMap((c) => [
        { value: c, label: pluralize(c), count: counts.get(c)! },
        ...subtypesOf(scoped, c).map((s) => ({ ...s, sub: true })),
      ]),
    ];
  }, [places, labels, city]);

  return (
    <>
      <header className="flex items-baseline gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
        <Trigger
          label={category ? whatLabel(category) : "Everything"}
          onClick={() => setOpen("category")}
          className="shrink-0 text-2xl font-semibold tracking-tight"
        />
        {city && (
          <Trigger
            label={`in ${city}`}
            onClick={() => setOpen("city")}
            className="text-2xl font-semibold tracking-tight text-stone-400"
          />
        )}
        <div className="ml-auto flex items-center gap-2 self-center">
        {onSend && (
          <button
            type="button"
            aria-label="Send these to a friend"
            onClick={onSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-900 active:bg-stone-300"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 3 10.5 13.5" />
              <path d="M21 3 14.5 21l-4-7.5L3 9.5z" />
            </svg>
          </button>
        )}
        <BuddyMenu places={places} />
        </div>
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
          more={{ label: city ? `In ${city}…` : "In…", onClick: () => setOpen("city") }}
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
  more,
}: {
  title: string;
  options: Option[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  onClose: () => void;
  /** A last row that leads somewhere else (What → Where). */
  more?: { label: string; onClick: () => void };
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
              <li key={o.value ?? ""}>
                <button
                  type="button"
                  onClick={() => onSelect(o.value)}
                  aria-pressed={active}
                  className={`vicolo-picker-row flex w-full items-center justify-between text-left ${o.sub ? "py-2.5 pl-8 pr-4 text-[15px] text-stone-500" : "px-4 py-3.5 text-base"} active:bg-stone-50 ${active ? "vicolo-selected" : ""}`}
                >
                  <span className={`flex items-center gap-2 ${active ? "font-semibold" : "font-medium"}`}>
                    {o.label}
                  </span>
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
          {more && (
            <li>
              <button
                type="button"
                onClick={more.onClick}
                className="vicolo-picker-row flex w-full items-center justify-between px-4 py-3.5 text-left text-base font-medium text-stone-500 active:bg-stone-50"
              >
                {more.label}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400" aria-hidden>
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function pluralize(category: string) {
  if (category === "Nature" || category === "Culture" || category === "Other") return category;
  return category.endsWith("y") ? `${category.slice(0, -1)}ies` : `${category}s`;
}

function whatLabel(what: string) {
  const sub = subtypeOf(what);
  return sub ? `${typeLabel(sub)}s` : pluralize(what);
}
