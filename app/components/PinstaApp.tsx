"use client";

import BrandIllustration from "./BrandIllustration";
import { matchesWhat, typeLabel } from "@/lib/subtypes";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, setOwnerKey } from "@/lib/api";
import type { Place } from "./types";
import AddPlace, { type AddMode } from "./AddPlace";
import AddMenu from "./AddMenu";
import Locked from "./Locked";
import Filters from "./Filters";
import PlaceCard, { type VisitChange } from "./PlaceCard";
import SwipeCard from "./SwipeCard";
import PlacesMap from "./PlacesMap";
import PlaceTiles from "./PlaceTiles";
import PeekCard from "./PeekCard";
import PlaceList from "./PlaceList";
import MapsChooser from "./MapsChooser";
import BuddyMenu from "./BuddyMenu";
import VisitAsk from "./VisitAsk";
import SendSheet, { type SendStart } from "./SendSheet";
import { askedRecently, dueToAsk, markAsked } from "@/lib/ask-visit";
import { MAPS_LABEL, defaultMaps, openIn, setDefaultMaps, type MapsApp } from "@/lib/directions";
import ViewSwitch, { type View } from "./ViewSwitch";
import { destinationLabels } from "@/lib/grouping";
import { NEAR_KM, currentPosition, kmBetween, SPREAD_KM, spreadKm, locationOnOpen } from "@/lib/geo";

/** Wide enough for the map with a floating list panel: iPad mini portrait (768) and up. */
const WIDE = "(min-width: 768px)";
const PANEL_WIDTH = 400;
/** Where the panel ends: its 12 px inset + its width. Sheets line up with it (globals.css). */
const PANEL_RIGHT = 12 + PANEL_WIDTH;

function useWide() {
  return useSyncExternalStore(
    (on) => {
      const mq = matchMedia(WIDE);
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    },
    () => matchMedia(WIDE).matches,
    () => false,
  );
}

export default function PinstaApp() {
  const wide = useWide();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** The + fans out its choices first; the sheet opens on one (Sarp, 2026-10-16). */
  const [fan, setFan] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("post");
  // Send to a friend (Sarp, 2026-10-26): from the + (paste a list) or from the header (what's shown).
  const [sending, setSending] = useState<SendStart | null>(null);
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

  // Where you are, once the browser shares it: the blue dot, row distances, and the opening city.
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const wherePick = useRef(0);

  // The locate button on the map (Sarp, 2026-10-15, like Google Maps): you at town size.
  // Not allowed yet → this is the ask, at any list size (the person asked for it).
  const [goHere, setGoHere] = useState(0);
  const [onYou, setOnYou] = useState(false);
  const [locating, setLocating] = useState(false);
  async function locate() {
    if (locating) return;
    setLocating(true);
    wherePick.current++; // a late opening fix mustn't move the map away from you
    try {
      const pos = await currentPosition();
      setHere(pos);
      setGoHere((n) => n + 1);
      setOnYou(true);
    } catch (e) {
      setNotice(
        (e as GeolocationPositionError)?.code === 1
          ? "Location is off for Vicolo. Allow it in your browser's site settings to see where you are."
          : "Couldn't find where you are. Try again in a moment.",
      );
    } finally {
      setLocating(false);
    }
  }

  // Opening screen: the map of the town you're in (Sarp, 2026-10-09: no "Near me" row;
  // it just opens on Barcelona when you're in Barcelona). The town is the Where row of your
  // nearest place within NEAR_KM. Offline or a map that does not load → the list of
  // everything. No location, or nothing within reach → the map of everything. Whatever was picked
  // meanwhile wins. Below ASK_AFTER places, a browser that hasn't been asked yet opens on
  // the map of everything, without a prompt.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !places || places.length === 0) return;
    started.current = true;
    const toList = () => setViewState((v) => (v === "map" ? "list" : v));
    if (!navigator.onLine) return toList();
    locationOnOpen(places.length)
      .then(async (may) => {
        // Not asked yet and the list is still small, or refused: the map of everything.
        if (may !== "locate") return;
        const pos = await currentPosition();
        setHere(pos);
        if (wherePick.current > 0) return; // a pick (even "everywhere") came first
        const nearest = places
          .map((p) => ({ p, km: kmBetween(pos, p) }))
          .filter((x) => x.km <= NEAR_KM)
          .sort((a, b) => a.km - b.km)[0];
        const town = nearest && labels.get(nearest.p.id);
        if (town) setCity((c) => c ?? town);
      })
      .catch(() => undefined); // no fix: the map of everything
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the list first arrives
  }, [places]);

  // "Been to any of these?", once per open (lib/ask-visit.ts). Showing it is the ask: each row is
  // stamped then, answered or not. `?ask=demo` shows the newest three and writes nothing, answers neither.
  const [asking, setAsking] = useState<{ places: Place[]; demo: boolean } | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !places || places.length === 0) return;
    asked.current = true;
    const demo = new URLSearchParams(window.location.search).get("ask") === "demo";
    if (!demo && askedRecently()) return;
    const due = demo ? places.filter((p) => p.visitedAt == null).slice(0, 3) : dueToAsk(places);
    if (due.length === 0) return;
    setAsking({ places: due, demo });
    if (demo) return;
    markAsked();
    for (const p of due) {
      api(`/api/places/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ asked: true }) })
        .then(async (res) => res.ok && onUpdated((await res.json()).place))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the list first arrives
  }, [places]);

  const visible = useMemo(() => {
    if (!places) return [];
    return places.filter(
      (p) =>
        (city === null || labels.get(p.id) === city) &&
        (category === null || matchesWhat(p, category)),
    );
  }, [places, labels, city, category]);

  // Everywhere on the map frames every place, like a saved map in Google Maps (Sarp, 2026-10-15:
  // a tester in Copenhagen with places in Lisbon, Paris and Oslo was opened on the nearest
  // country, Norway, one bakery, and read it as random). Only when the places are worlds apart
  // (wider than SPREAD_KM, Japan and Spain) one country: the one with most places, as Japan and
  // Spain in one frame showed neither (2026-10-06). The others are a zoom out away.
  const countries = useMemo(() => {
    const by = new Map<string, Place[]>();
    for (const p of visible) {
      const c = p.country ?? "Elsewhere";
      by.set(c, [...(by.get(c) ?? []), p]);
    }
    return [...by].map(([name, ps]) => ({ name, places: ps })).sort((a, b) => b.places.length - a.places.length);
  }, [visible]);
  const framed = useMemo(() => {
    if (city !== null || countries.length < 2 || spreadKm(visible) <= SPREAD_KM) return null;
    return countries[0];
  }, [countries, city, visible]);

  function onSaved(p: Place) {
    setPlaces((prev) => [p, ...(prev ?? [])]);
  }

  function onUpdated(p: Place) {
    setPlaces((prev) => prev?.map((x) => (x.id === p.id ? p : x)) ?? null);
  }

  // Want to go ↔ Been there, and how it was: shown at once, put back if the server says no.
  async function visit(p: Place, c: VisitChange) {
    const shown: Place = {
      ...p,
      ...(c.visited !== undefined ? { visitedAt: c.visited ? (p.visitedAt ?? new Date()) : null } : {}),
      ...(c.rating !== undefined ? { rating: c.rating } : {}),
    };
    onUpdated(shown);
    const res = await api(`/api/places/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(c) }).catch(() => null);
    if (res?.ok) return onUpdated((await res.json()).place);
    onUpdated(p);
    setNotice("Couldn't save that. Try again.");
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

  // Wide screens (iPad, Mac): the map always fills the window and the list floats on it in a
  // panel at the left, like Flighty (Sarp, 2026-10-27). The panel shows List, Cards or Tiles.
  const body: View = wide && view === "map" ? "list" : view;
  const hasPlaces = places !== null && places.length > 0;

  const header = hasPlaces ? (
    <Filters
      places={places}
      labels={labels}
      city={city}
      category={category}
      onCity={(c) => {
        // Locating can take seconds on open; a Where picked meanwhile wins over a late fix.
        wherePick.current++;
        setCity(c);
        setCategory(null);
        setPeek(null);
      }}
      onCategory={(c) => {
        setCategory(c);
        setPeek(null);
      }}
      // What's shown, as a list for a friend: only once a town is picked ("my Helsinki tips").
      onSend={
        city !== null && visible.length > 0
          ? () => setSending({ from: "selection", places: visible, title: category ? `${whatTitle(category)} in ${city}` : `My ${city}` })
          : undefined
      }
    />
  ) : (
    // Settings are reachable before the first save too.
    <header className="flex items-center px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
      <h1 className="text-2xl font-semibold tracking-tight">Vicolo</h1>
      <BuddyMenu places={places ?? []} />
    </header>
  );

  const map = hasPlaces && (wide || view === "map") && (
    <PlacesMap
      places={visible}
      focus={framed?.places}
      here={here}
      goHere={goHere}
      onAway={() => setOnYou(false)}
      selected={peekId}
      onSelect={setPeek}
      padLeft={wide ? PANEL_RIGHT : 0}
      onFail={() => {
        if (wide) return setNotice("The map didn't load.");
        setView("list");
        setNotice("The map didn't load, so here is the list.");
      }}
    />
  );

  const listed = (
    <>
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
          <button type="button" onClick={() => setFan(true)} className="mt-5 min-h-11 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white active:opacity-80">Save your first place</button>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">Paste a link from Instagram, TikTok, or Google Maps.</p>
        </div>
      )}

      {hasPlaces && visible.length === 0 && body !== "map" && (
        <div className="mx-auto mt-10 max-w-[280px] text-center">
          <BrandIllustration coffee={category?.startsWith("Cafe") ?? false} />
          <h2 className="mt-4 text-base font-medium">No places here yet</h2>
          <p className="mt-2 text-sm text-stone-500">Try another area or clear your filters.</p>
          <button type="button" onClick={() => { setCity(null); setCategory(null); }} className="mt-3 min-h-11 rounded-full px-4 text-sm font-medium underline underline-offset-4">Show all places</button>
        </div>
      )}

      {body === "tiles" && (
        <PlaceTiles places={visible} selected={peekId} onSelect={(p) => setPeekId((c) => (c === p.id ? null : p.id))} />
      )}

      {body === "list" && (
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
      {body === "cards" && (
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
    </>
  );

  // Not over the Undo toast, which it covered (2026-10-17).
  const locateButton = (wide || view === "map") && hasPlaces && !adding && !fan && !(peekId && !wide) && !toast && (
    <button
      type="button"
      aria-label="Show where I am"
      aria-pressed={onYou}
      onClick={locate}
      className={`pointer-events-auto absolute flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1a73e8] shadow-lg shadow-stone-900/10 active:scale-95 transition-transform ${
        wide ? "right-4 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]" : "right-1.5 bottom-[calc(100%+0.75rem)]"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className={locating ? "animate-pulse" : ""}
        fill={onYou ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M20.5 3.5 3.5 10.6l7.1 2.8 2.8 7.1z" />
      </svg>
    </button>
  );

  const plus = (
    <button
      type="button"
      aria-label={adding || fan ? "Close" : "Save a place"}
      aria-expanded={fan}
      onClick={() => (adding ? setAdding(false) : setFan((o) => !o))}
      className="pinsta-fab pointer-events-auto absolute right-0 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg shadow-stone-900/20"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden
        className="transition-transform duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)]"
        style={{ transform: adding || fan ? "rotate(135deg)" : "rotate(0deg)" }}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );

  const overlays = (
    <>
      {/* Always mounted: given null it slides the last place away instead of vanishing. */}
      <PeekCard
        place={body !== "cards" ? peek : null}
        onClose={() => setPeek(null)}
        onEdit={(p) => {
          setPeek(null);
          setEditing(p);
        }}
        onDelete={(p) => {
          setPeek(null);
          remove(p);
        }}
        onVisit={visit}
      />

      {notice && !toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 mx-auto max-w-md px-5">
          <div className="pinsta-rise rounded-2xl bg-stone-800 px-4 py-3 text-sm leading-snug text-white shadow-lg">{notice}</div>
        </div>
      )}

      {asking && !adding && <VisitAsk places={asking.places} onVisit={asking.demo ? () => undefined : visit} onClose={() => setAsking(null)} />}

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

      <AddMenu
        open={fan}
        onClose={() => setFan(false)}
        onPick={(m) => {
          setFan(false);
          if (m === "send") return setSending({ from: "paste" });
          setAddMode(m);
          setAdding(true);
        }}
      />

      {sending && (
        <SendSheet start={sending} places={places ?? []} near={city} here={here} onClose={() => setSending(null)} onSaved={onSaved} />
      )}

      {(adding || editing) && (
        <AddPlace
          mode={addMode}
          here={here}
          places={places ?? []}
          editing={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={onSaved}
          onUpdated={onUpdated}
        />
      )}
    </>
  );

  if (wide) {
    return (
      // data-wide moves every phone-width sheet (`mx-auto max-w-md`) onto the panel: globals.css.
      <main data-wide className="fixed inset-0 overflow-hidden">
        {map}
        {locateButton}
        <aside
          className="absolute left-3 top-3 bottom-3 flex flex-col overflow-hidden rounded-[28px] bg-stone-100 shadow-[0_8px_40px_rgb(0_0_0/0.16)]"
          style={{ width: PANEL_WIDTH }}
        >
          {header}
          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 ${body === "tiles" ? "" : "px-5"}`}>{listed}</div>
          {/* z-0 keeps the + under the place card; z-30 lifts it over a sheet, where it is the ×. */}
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 ${adding || fan ? "z-30" : "z-0"} bg-gradient-to-t from-stone-100 via-stone-100/90 to-transparent px-5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-6`}>
            <div className="relative flex h-14 items-center">
              {hasPlaces && (
                <div className={`transition-opacity duration-200 ${adding || fan ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                  <ViewSwitch view={body} onChange={setView} views={["list", "cards", "tiles"]} />
                </div>
              )}
              {plus}
            </div>
          </div>
        </aside>
        {overlays}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      {header}

      <section
        className={
          view === "map" && hasPlaces
            ? "relative flex-1"
            : view === "tiles"
              ? "flex-1 pb-28" // the grid bleeds to the edges
              : "flex-1 px-5 pb-28"
        }
      >
        {map}
        {listed}
      </section>

      <div className={`pointer-events-none fixed inset-x-0 bottom-0 mx-auto max-w-md ${adding || fan ? "z-30" : ""} px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6 ${
        view === "map" || adding ? "" : "bg-gradient-to-t from-stone-100 via-stone-100/90 to-transparent"
      }`}>
        {/* One row: the view pill centered, a round + at the right edge. */}
        <div className="relative flex h-14 items-center justify-center">
          {hasPlaces && (
            <div className={`transition-opacity duration-200 ${adding || fan ? "pointer-events-none opacity-0" : "opacity-100"}`}>
              <ViewSwitch view={view} onChange={setView} />
            </div>
          )}
          {locateButton}
          {plus}
        </div>
      </div>

      {overlays}
    </main>
  );
}


/** "Restaurants" / "Wine bars" for a send's title, like the What header. */
function whatTitle(what: string): string {
  const [category, type] = what.split("/");
  if (type) return `${typeLabel(type)}s`;
  if (category === "Nature" || category === "Culture" || category === "Other") return category;
  return category.endsWith("y") ? `${category.slice(0, -1)}ies` : `${category}s`;
}
