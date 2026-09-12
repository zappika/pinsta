"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Place } from "./types";
import AddPlace from "./AddPlace";
import Filters from "./Filters";
import PlaceCard from "./PlaceCard";
import { destinationLabels } from "@/lib/grouping";

export default function PinstaApp() {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/places", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { places: Place[] };
      setPlaces(data.places);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load places");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const labels = useMemo(() => destinationLabels(places ?? []), [places]);

  const visible = useMemo(() => {
    if (!places) return [];
    return places.filter(
      (p) =>
        (city === null || labels.get(p.id) === city) &&
        (category === null || p.category === category),
    );
  }, [places, labels, city, category]);

  function onSaved(p: Place) {
    setPlaces((prev) => [p, ...(prev ?? [])]);
  }

  async function onDelete(id: string) {
    const prev = places;
    setPlaces((ps) => ps?.filter((p) => p.id !== id) ?? null);
    const res = await fetch(`/api/places/${id}`, { method: "DELETE" });
    if (!res.ok) setPlaces(prev);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      {places && places.length > 0 ? (
        <Filters
          places={places}
          labels={labels}
          city={city}
          category={category}
          onCity={(c) => {
            setCity(c);
            setCategory(null);
          }}
          onCategory={setCategory}
        />
      ) : (
        <header className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Pinsta</h1>
        </header>
      )}

      <section className="flex-1 px-5 pb-32">
        {error && (
          <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        {places === null && !error && (
          <ul className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
            ))}
          </ul>
        )}

        {places && places.length === 0 && (
          <div className="mt-24 text-center">
            <p className="text-lg font-medium">Nothing saved yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Paste an Instagram post and pin the place it shows.
            </p>
          </div>
        )}

        {places && places.length > 0 && visible.length === 0 && (
          <p className="mt-12 text-center text-sm text-stone-500">
            No places match these filters.
          </p>
        )}

        <ul className="space-y-3">
          {visible.map((p) => (
            <PlaceCard key={p.id} place={p} onDelete={() => onDelete(p.id)} />
          ))}
        </ul>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 mx-auto max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6 bg-gradient-to-t from-stone-100 via-stone-100/90 to-transparent">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pointer-events-auto w-full rounded-2xl bg-stone-900 py-4 text-base font-medium text-white shadow-lg shadow-stone-900/10 active:scale-[0.98] transition-transform"
        >
          Save a place
        </button>
      </div>

      {adding && (
        <AddPlace
          places={places ?? []}
          onClose={() => setAdding(false)}
          onSaved={onSaved}
          onRemoved={(id) => setPlaces((ps) => ps?.filter((p) => p.id !== id) ?? null)}
        />
      )}
    </main>
  );
}
