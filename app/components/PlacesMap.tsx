"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { iconFor, tintFor } from "@/lib/categories";
import { isDark } from "@/lib/theme";
import type { Place } from "./types";

// OpenFreeMap: vector tiles, no key, no quota. Positron is the quiet grey style; "dark" its night twin.
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
/** Pins closer than this on screen are shown as one numbered circle. */
const CLUSTER_PX = 44;
/** From street level on, never group — two entries at one address would never split. */
const NO_CLUSTER_ZOOM = 16;

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place | null) => void;
  /** The base map could not load (bad connection): the app falls back to the list. */
  onFail?: () => void;
  /** What to frame, when not all of `places` (Everywhere: one country, see PinstaApp). */
  focus?: Place[];
  /** Drawn over the map (the country chips). */
  overlay?: ReactNode;
};

/**
 * The current Where/What selection on a map, framed to fit it (or to `focus`).
 * Pins are the type icon on a soft type tint; overlapping pins group into a count.
 * Tap a pin → PeekCard; tap a group → zoom in until it splits.
 */
/** A map that has not drawn by then is treated as offline. */
const LOAD_TIMEOUT_MS = 12_000;

export default function PlacesMap({ places, selected, onSelect, onFail, focus, overlay }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, { marker: maplibregl.Marker; pin: HTMLDivElement }>>(new Map());
  const unsubscribe = useRef<() => void>(() => {});
  /** The first "load" has fired. m.loaded() can't say this: it's false again whenever tiles are fetching. */
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  // maplibre touches `window` on import, so it only loads in the browser.
  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    const fail = () => {
      if (!cancelled && !loaded) onFailRef.current?.();
    };
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS);
    (async () => {
      const lib = await import("maplibre-gl").catch(() => null);
      if (!lib) return fail();
      if (cancelled || !container.current) return;
      // See scripts/copy-maplibre-worker.sh.
      lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new lib.Map({
        container: container.current,
        style: isDark() ? STYLE_DARK : STYLE_LIGHT,
        center: [10, 50],
        zoom: 3,
        attributionControl: { compact: true },
      });
      m.on("click", () => onSelectRef.current(null));
      // Names only once the pins have room; zoomed out they'd pile up.
      const labels = () => container.current?.classList.toggle("show-labels", m.getZoom() > 9);
      m.on("zoom", labels);
      labels();
      map.current = m;
      // Appearance changed (menu or system): swap the base map; DOM pins stay put.
      const restyle = () => m.setStyle(isDark() ? STYLE_DARK : STYLE_LIGHT);
      const mq = matchMedia("(prefers-color-scheme: dark)");
      window.addEventListener("pinsta:theme", restyle);
      mq.addEventListener("change", restyle);
      unsubscribe.current = () => {
        window.removeEventListener("pinsta:theme", restyle);
        mq.removeEventListener("change", restyle);
      };
      // An error before the style is in (OpenFreeMap unreachable) means no map.
      m.on("error", () => {
        if (!m.isStyleLoaded()) fail();
      });
      m.once("load", () => {
        loaded = true;
        ready.current = true;
        clearTimeout(timer);
        setPlaces(lib, m);
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe.current();
      map.current?.remove();
      map.current = null;
      ready.current = false;
      markers.current.clear();
      clusterMarkers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placesRef = useRef(places);
  placesRef.current = places;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const clusterMarkers = useRef<maplibregl.Marker[]>([]);

  /** New selection: frame it, then draw. */
  function setPlaces(lib: typeof maplibregl, m: maplibregl.Map) {
    const list = focusRef.current?.length ? focusRef.current : placesRef.current;
    draw(lib, m);
    if (list.length === 0) return;
    const bounds = new lib.LngLatBounds();
    for (const p of list) bounds.extend([p.lng, p.lat]);
    // One place → a neighbourhood, not a dot at max zoom.
    m.fitBounds(bounds, { padding: { top: 60, bottom: 180, left: 50, right: 50 }, maxZoom: 15, duration: 600 });
    // Pins that overlap at this zoom are grouped; regroup whenever the map settles.
    m.off("moveend", redraw.current);
    redraw.current = () => draw(lib, m);
    m.on("moveend", redraw.current);
  }
  const redraw = useRef<() => void>(() => {});

  /**
   * Greedy screen-space grouping: a pin within one pin-width of a group joins it.
   * A group shows its count on the tint of its most common type; tap zooms in.
   */
  function draw(lib: typeof maplibregl, m: maplibregl.Map) {
    for (const { marker } of markers.current.values()) marker.remove();
    markers.current.clear();
    for (const c of clusterMarkers.current) c.remove();
    clusterMarkers.current = [];

    const groups: { x: number; y: number; members: Place[] }[] = [];
    for (const p of placesRef.current) {
      const pt = m.project([p.lng, p.lat]);
      const g = m.getZoom() < NO_CLUSTER_ZOOM ? groups.find((g) => Math.hypot(g.x - pt.x, g.y - pt.y) < CLUSTER_PX) : undefined;
      if (g) g.members.push(p);
      else groups.push({ x: pt.x, y: pt.y, members: [p] });
    }

    // Pins that would overlap (only possible at street level, where grouping stops) fan out sideways.
    const seen: { x: number; y: number; n: number; els: HTMLElement[] }[] = [];
    for (const g of groups) {
      if (g.members.length === 1) {
        const twin = seen.find((q) => Math.hypot(q.x - g.x, q.y - g.y) < CLUSTER_PX);
        const fan = twin ? ++twin.n : 0;
        const p = g.members[0];
        const el = document.createElement("div");
        el.style.cssText = "width:44px;height:44px;cursor:pointer";
        const pin = document.createElement("div");
        pin.className = "pinsta-pin";
        // The type icon only: a photo shrunk to 44px is unreadable; the type reads at a glance.
        const icon = document.createElement("img");
        icon.src = iconFor(p.category);
        icon.alt = "";
        icon.draggable = false;
        icon.className = "pinsta-pin-icon";
        pin.append(icon);
        pin.style.backgroundColor = tintFor(p.category);
        pin.classList.toggle("active", p.id === selectedRef.current);
        const label = document.createElement("div");
        label.className = "pinsta-pin-label";
        label.textContent = p.name;
        el.append(pin, label);
        if (twin) {
          // Fanned pins: names would overlap, so they show in the PeekCard instead.
          twin.els.push(el);
          for (const e of twin.els) e.classList.add("no-label");
        } else {
          seen.push({ x: g.x, y: g.y, n: 0, els: [el] });
        }
        const open = () => {
          onSelectRef.current(p);
          // Nudge the pin up so the PeekCard doesn't sit on top of it.
          m.easeTo({ center: [p.lng, p.lat], offset: [0, -140] });
        };
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          open();
        });
        keyboardButton(el, p.name, open);
        const marker = new lib.Marker({ element: el, offset: [fan * 48, 0] }).setLngLat([p.lng, p.lat]).addTo(m);
        markers.current.set(p.id, { marker, pin });
        continue;
      }
      const counts = new Map<string, number>();
      for (const p of g.members) counts.set(p.category ?? "Other", (counts.get(p.category ?? "Other") ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const el = document.createElement("div");
      el.className = "pinsta-pin pinsta-cluster";
      el.style.backgroundColor = tintFor(top);
      el.textContent = String(g.members.length);
      const zoomIn = () => {
        const b = new lib.LngLatBounds();
        for (const p of g.members) b.extend([p.lng, p.lat]);
        m.fitBounds(b, { padding: 90, maxZoom: Math.max(m.getZoom() + 2, 17), duration: 500 });
      };
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        zoomIn();
      });
      keyboardButton(el, `${g.members.length} places`, zoomIn);
      const at = m.unproject([g.x, g.y]);
      clusterMarkers.current.push(new lib.Marker({ element: el }).setLngLat(at).addTo(m));
    }
  }

  // Re-pin when the selection changes. Before the first load the init handler
  // draws whatever placesRef holds by then, so nothing is waited on here.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (async () => {
      const lib = await import("maplibre-gl");
      if (map.current === m) setPlaces(lib, m);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, focusKey(focus)]);

  useEffect(() => {
    for (const [id, { pin }] of markers.current) pin.classList.toggle("active", id === selected);
  }, [selected, places]);

  /** Pins are plain divs: give them a button's role, focus and keys. */
  function keyboardButton(el: HTMLElement, label: string, act: () => void) {
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", label);
    el.tabIndex = 0;
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation(); // maplibre's keyboard handler would pan or zoom too
      act();
    });
  }

  // maplibre's own CSS forces `position: relative` on its container, which would
  // beat Tailwind's `absolute` — so the ref goes on a full-size child instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
      {overlay}
    </div>
  );
}

/** A stable dependency for the framed set: the same places frame the same way. */
const focusKey = (f: Place[] | undefined) => f?.map((p) => p.id).join(",") ?? "";
