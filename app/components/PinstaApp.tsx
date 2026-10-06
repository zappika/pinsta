"use client";

import BrandIllustration from "./BrandIllustration";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, setOwnerKey } from "@/lib/api";
import type { Place } from "./types";
import AddPlace from "./AddPlace";
import Locked from "./Locked";
import Filters from "./Filters";
import PlaceCard from "./PlaceCard";
import SwipeCard from "./SwipeCard";
import PlacesMap from "./PlacesMap";
import PlaceTiles from "./PlaceTiles";
import PeekCard from "./PeekCard";
import PlaceList from "./PlaceList";
import MapsChooser from "./MapsChooser";
import BuddyMenu from "./BuddyMenu";
import { MAPS_LABEL, defaultMaps, openIn, setDefaultMaps, type MapsApp } from "@/lib/directions";
import ViewSwitch, { type View } from "./ViewSwitch";
import { destinationLabels } from "@/lib/grouping";
import { NEAR, NEAR_KM, currentPosition, kmBetween, locationOnOpen } from "@/lib/geo";

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

  // A delete that did not go through brings the place back with the next load.
  const reload = useRef<() => void>(() => {});
  const commitDelete = useCallback((id: string) => {
    pending.current.delete(id);
    api(`/api/places/${id}`, { method: "DELETE", keepalive: true })
      .then((res) => {
        if (!res.ok && res.status !== 404) reload.current();
      })
      .catch(() => reload.current());
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
    // Already sent (the timer or a page hide beat the tap): bringing it back would show a ghost.
    if (!t) return setToast(null);
    clearTimeout(t);
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
  const [locked, setLocked] = useState(false);
  // Directions: the chooser (with the place to open next, or null from the menu) and the confirmation.
  const [choosing, setChoosing] = useState<{ target: Parameters<typeof openIn>[1] | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyTried, setKeyTried] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // How the selection is shown. Every visit opens on the map of what is near (see below).
  const [view, setViewState] = useState<View>("map");
  // The id, not a copy: the sheet then shows the place as it is now (changed, merged, removed).
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = useMemo(() => places?.find((p) => p.id === peekId) ?? null, [places, peekId]);
  const setPeek = (p: Place | null) => setPeekId(p?.id ?? null);
  function setView(v: View) {
    setViewState(v);
    setPeek(null);
  }

  const load = useCallback(async () => {
    try {
      const res = await api("/api/places", { cache: "no-store" });
      if (res.status === 401) {
        setLocked(true);
        return;
      }
      // Not res.text(): a Vercel timeout is an HTML page.
      if (!res.ok) throw new Error(`Could not load places (${res.status})`);
      setLocked(false);
      const data = (await res.json()) as { places: Place[] };
      // A removal still in its Undo window is not back just because the server has it.
      setPlaces(data.places.filter((p) => !pending.current.has(p.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load places");
    }
  }, []);

  reload.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onChoose = (e: Event) => setChoosing({ target: (e as CustomEvent).detail ?? null });
    window.addEventListener("pinsta:choose-maps", onChoose);
    return () => window.removeEventListener("pinsta:choose-maps", onChoose);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  function pickMaps(app: MapsApp) {
    setDefaultMaps(app);
    if (choosing?.target) openIn(app, choosing.target);
    setChoosing(null);
    setNotice(`Saved ${MAPS_LABEL[app]} as your default. You can change it anytime in Settings, top right.`);
  }

  // Any API call that comes back 401 (key missing or changed) shows the key screen.
  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener("pinsta:locked", onLocked);
    return () => window.removeEventListener("pinsta:locked", onLocked);
  }, []);

  const labels = useMemo(() => destinationLabels(places ?? []), [places]);

  // "Near me": asked for only when chosen, never on load.
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const wherePick = useRef(0);
  const nearIds = useMemo(
    () => (here ? new Set((places ?? []).filter((p) => kmBetween(here, p) <= NEAR_KM).map((p) => p.id)) : null),
    [here, places],
  );

  // Opening screen: the map, Near me. Offline, no location, or a map that does not
  // load → the list of everything. Nothing within reach → the map of everything.
  // Whatever was picked meanwhile wins. Below ASK_AFTER places, a browser that
  // hasn't been asked yet opens on the map of everything, without a prompt.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !places || places.length === 0) return;
    started.current = true;
    const toList = () => setViewState((v) => (v === "map" ? "list" : v));
    if (!navigator.onLine) return toList();
    locationOnOpen(places.length)
      .then(async (may) => {
        if (may === "wait") return; // not asked yet and the list is still small: no prompt
        if (may === "refused") return toList();
        const pos = await currentPosition();
        setHere(pos);
        if (wherePick.current > 0) return; // a pick (even "everywhere") came first
        if (places.some((p) => kmBetween(pos, p) <= NEAR_KM)) setCity((c) => c ?? NEAR);
        else setNotice(`Nothing saved within ${NEAR_KM} km, so here is everything.`);
      })
      .catch(toList);
  }, [places]);

  const visible = useMemo(() => {
    if (!places) return [];
    return places.filter(
      (p) =>
        (city === null || (city === NEAR ? nearIds?.has(p.id) : labels.get(p.id) === city)) &&
        (category === null || p.category === category),
    );
  }, [places, labels, nearIds, city, category]);

  function onSaved(p: Place) {
    setPlaces((prev) => [p, ...(prev ?? [])]);
  }

  function onUpdated(p: Place) {
    setPlaces((prev) => prev?.map((x) => (x.id === p.id ? p : x)) ?? null);
  }

  if (locked) {
    return (
      <Locked
        rejected={keyTried}
        onKey={(k) => {
          setKeyTried(true);
          setOwnerKey(k);
          setError(null);
          load();
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      {places && places.length > 0 ? (
        <Filters
          places={places}
          labels={labels}
          nearIds={nearIds}
          city={city}
          category={category}
          onCity={async (c) => {
            // Locating can take seconds; a Where picked meanwhile wins over a late fix.
            const pick = ++wherePick.current;
            setLocError(null);
            if (c === NEAR) {
              try {
                const pos = await currentPosition();
                if (pick !== wherePick.current) return;
                setHere(pos);
              } catch {
                if (pick === wherePick.current) setLocError("Location is off. Allow it for this site to use Near me.");
                return;
              }
            }
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
        // Settings are reachable before the first save too.
        <header className="flex items-center px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Vicolo</h1>
          <BuddyMenu />
        </header>
      )}

      <section
        className={
          view === "map" && places && places.length > 0
            ? "relative flex-1"
            : view === "tiles"
              ? "flex-1 pb-28" // the grid bleeds to the edges
              : "flex-1 px-5 pb-28"
        }
      >
        {locError && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{locError}</p>}
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
          <div className="mx-auto mt-10 max-w-[300px] text-center">
            <BrandIllustration />
            <h2 className="mt-5 text-xl font-semibold">Your next favorite starts here</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">Save a place you want to try. Keep it for when you’re nearby.</p>
            <button type="button" onClick={() => setAdding(true)} className="mt-5 min-h-11 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white active:opacity-80">Save your first place</button>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">Paste a link from Instagram, TikTok, or Google Maps.</p>
          </div>
        )}

        {places && places.length > 0 && visible.length === 0 && view !== "map" && (
          <div className="mx-auto mt-10 max-w-[280px] text-center">
            <BrandIllustration coffee={category === "Cafe"} />
            <h2 className="mt-4 text-base font-medium">No places here yet</h2>
            <p className="mt-2 text-sm text-stone-500">Try another area or clear your filters.</p>
            <button type="button" onClick={() => { setCity(null); setCategory(null); }} className="mt-3 min-h-11 rounded-full px-4 text-sm font-medium underline underline-offset-4">Show all places</button>
          </div>
        )}

        {places && places.length > 0 && view === "map" && (
          <PlacesMap
            places={visible}
            selected={peekId}
            onSelect={setPeek}
            onFail={() => {
              setView("list");
              setNotice("The map didn't load, so here is the list.");
            }}
          />
        )}

        {view === "tiles" && (
          <PlaceTiles places={visible} selected={peekId} onSelect={(p) => setPeekId((c) => (c === p.id ? null : p.id))} />
        )}

        {view === "list" && (
          <PlaceList
            places={visible}
            selected={peekId}
            onSelect={(p) => setPeekId((c) => (c === p.id ? null : p.id))}
            here={here}
            hideCategory={category !== null}
            hideCity={(p) => city !== null && p.city === city}
          />
        )}

        {/* Only in Cards: a hidden list still downloads every photo. */}
        {view === "cards" && (
          <ul className="space-y-3">
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
        )}
      </section>

      {peek && view !== "cards" && (
        <PeekCard
          place={peek}
          onClose={() => setPeek(null)}
          onEdit={() => {
            setPeek(null);
            setEditing(peek);
          }}
          onDelete={() => {
            setPeek(null);
            remove(peek);
          }}
        />
      )}

      {notice && !toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 mx-auto max-w-md px-5">
          <div className="pinsta-rise rounded-2xl bg-stone-800 px-4 py-3 text-sm leading-snug text-white shadow-lg">{notice}</div>
        </div>
      )}

      {choosing && (
        <MapsChooser current={defaultMaps()} onPick={pickMaps} onClose={() => setChoosing(null)} />
      )}

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

      <div className={`pointer-events-none fixed inset-x-0 bottom-0 mx-auto max-w-md ${adding ? "z-30" : ""} px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6 ${
        view === "map" || adding ? "" : "bg-gradient-to-t from-stone-100 via-stone-100/90 to-transparent"
      }`}>
        {/* One row: the view pill centered, a round + at the right edge. */}
        <div className="relative flex h-14 items-center justify-center">
          {places && places.length > 0 && (
            <div className={`transition-opacity duration-200 ${adding ? "pointer-events-none opacity-0" : "opacity-100"}`}>
              <ViewSwitch view={view} onChange={setView} />
            </div>
          )}
          <button
            type="button"
            aria-label={adding ? "Close" : "Save a place"}
            onClick={() => setAdding((o) => !o)}
            className="pinsta-fab pointer-events-auto absolute right-0 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg shadow-stone-900/20"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden
              className="transition-transform duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)]"
              style={{ transform: adding ? "rotate(135deg)" : "rotate(0deg)" }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
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
