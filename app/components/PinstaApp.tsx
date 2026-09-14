"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "./types";
import AddPlace from "./AddPlace";
import Filters from "./Filters";
import PlaceCard from "./PlaceCard";
import SwipeCard from "./SwipeCard";
import PlacesMap from "./PlacesMap";
import PlaceTiles from "./PlaceTiles";
import PeekCard from "./PeekCard";
import ViewSwitch, { type View } from "./ViewSwitch";
import { destinationLabels } from "@/lib/grouping";

export default function PinstaApp() {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  // Deletes are deferred a few seconds so "Undo" can pull them back. Only the
  // latest removal is undoable; older pending ones commit when a new one starts.
  const [toast, setToast] = useState<{ place: Place; index: number } | null>(null);
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const commitDelete = useCallback((id: string) => {
    pending.current.delete(id);
    fetch(`/api/places/${id}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Leaving the page commits whatever is still pending.
    const flush = () => {
      for (const [id, t] of pending.current) {
        clearTimeout(t);
        commitDelete(id);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [commitDelete]);

  function remove(p: Place) {
    const index = places?.findIndex((x) => x.id === p.id) ?? 0;
    setPlaces((ps) => ps?.filter((x) => x.id !== p.id) ?? null);
    setOpenSwipe(null);
    pending.current.set(p.id, setTimeout(() => commitDelete(p.id), 5000));
    setToast({ place: p, index });
  }

  function undo() {
    if (!toast) return;
    const t = pending.current.get(toast.place.id);
    if (t) clearTimeout(t);
    pending.current.delete(toast.place.id);
    setPlaces((ps) => {
      const next = [...(ps ?? [])];
      next.splice(Math.min(toast.index, next.length), 0, toast.place);
      return next;
    });
    setToast(null);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // How the selection is shown. Remembered across visits; the filters are not.
  const [view, setViewState] = useState<View>("cards");
  const [peek, setPeek] = useState<Place | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("pinsta.view");
      if (v === "map" || v === "cards" || v === "tiles") setViewState(v);
    } catch {}
  }, []);
  function setView(v: View) {
    setViewState(v);
    setPeek(null);
    try {
      localStorage.setItem("pinsta.view", v);
    } catch {}
  }

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

  function onUpdated(p: Place) {
    setPlaces((prev) => prev?.map((x) => (x.id === p.id ? p : x)) ?? null);
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
            setPeek(null);
          }}
          onCategory={(c) => {
            setCategory(c);
            setPeek(null);
          }}
        />
      ) : (
        <header className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Pinsta</h1>
        </header>
      )}

      <section
        className={
          view === "map" && places && places.length > 0
            ? "relative flex-1"
            : view === "tiles"
              ? "flex-1 pb-40" // the grid bleeds to the edges
              : "flex-1 px-5 pb-40"
        }
      >
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

        {places && places.length > 0 && visible.length === 0 && view !== "map" && (
          <p className="mt-12 text-center text-sm text-stone-500">
            No places match these filters.
          </p>
        )}

        {places && places.length > 0 && view === "map" && (
          <PlacesMap places={visible} selected={peek?.id ?? null} onSelect={setPeek} />
        )}

        {view === "tiles" && (
          <PlaceTiles places={visible} selected={peek?.id ?? null} onSelect={(p) => setPeek((c) => (c?.id === p.id ? null : p))} />
        )}

        <ul className={view === "cards" ? "space-y-3" : "hidden"}>
          {visible.map((p) => (
            <SwipeCard
              key={p.id}
              open={openSwipe === p.id}
              onOpen={() => setOpenSwipe(p.id)}
              onClose={() => setOpenSwipe((o) => (o === p.id ? null : o))}
              onEdit={() => {
                setOpenSwipe(null);
                setEditing(p);
              }}
              onDelete={() => remove(p)}
            >
              <PlaceCard
                place={p}
                hideCategory={category !== null}
                // A region row ("Halland") still wants the town on the card.
                hideCity={city !== null && p.city === city}
              />
            </SwipeCard>
          ))}
        </ul>
      </section>

      {peek && view !== "cards" && <PeekCard place={peek} onClose={() => setPeek(null)} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 mx-auto max-w-md px-5">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-stone-800 px-4 py-3 text-sm text-white shadow-lg">
            <span className="truncate">Removed {toast.place.name}</span>
            <button type="button" onClick={undo} className="shrink-0 font-semibold text-amber-300 active:text-amber-200">
              Undo
            </button>
          </div>
        </div>
      )}

      <div className={`pointer-events-none fixed inset-x-0 bottom-0 mx-auto max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6 ${
        view === "map" ? "" : "bg-gradient-to-t from-stone-100 via-stone-100/90 to-transparent"
      }`}>
        {places && places.length > 0 && (
          <div className="mb-3">
            <ViewSwitch view={view} onChange={setView} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pointer-events-auto w-full rounded-2xl bg-stone-900 py-4 text-base font-medium text-white shadow-lg shadow-stone-900/10 active:scale-[0.98] transition-transform"
        >
          Save a place
        </button>
      </div>

      {(adding || editing) && (
        <AddPlace
          places={places ?? []}
          editing={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={onSaved}
          onUpdated={onUpdated}
          onRemoved={(id) => setPlaces((ps) => ps?.filter((p) => p.id !== id) ?? null)}
        />
      )}
    </main>
  );
}
