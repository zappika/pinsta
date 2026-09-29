"use client";

import { useEffect, useRef } from "react";
import type * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { emojiFor, tintFor } from "@/lib/categories";
import type { Place } from "./types";

// OpenFreeMap: vector tiles, no key, no quota. Positron is the quiet grey style.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
/** Pins closer than this on screen are shown as one numbered circle. */
const CLUSTER_PX = 44;
/** From street level on, never group — two entries at one address would never split. */
const NO_CLUSTER_ZOOM = 16;

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place | null) => void;
};

/**
 * The current Where/What selection on a map, framed to fit it. Pins are the
 * category emoji on a soft type tint; overlapping pins group into a count.
 * Tap a pin → PeekCard; tap a group → zoom in until it splits.
 */
export default function PlacesMap({ places, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, { marker: maplibregl.Marker; pin: HTMLDivElement }>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // maplibre touches `window` on import, so it only loads in the browser.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      // See scripts/copy-maplibre-worker.sh.
      lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new lib.Map({
        container: container.current,
        style: STYLE,
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
      m.once("load", () => setPlaces(lib, m));
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
      clusterMarkers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placesRef = useRef(places);
  placesRef.current = places;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const clusterMarkers = useRef<maplibregl.Marker[]>([]);

  /** New selection: frame it, then draw. */
  function setPlaces(lib: typeof maplibregl, m: maplibregl.Map) {
    const list = placesRef.current;
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
        // Emoji only: a photo shrunk to 44px is unreadable; the type glyph reads at a glance.
        pin.textContent = emojiFor(p.category);
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
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(p);
          // Nudge the pin up so the PeekCard doesn't sit on top of it.
          m.easeTo({ center: [p.lng, p.lat], offset: [0, -140] });
        });
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
      el.setAttribute("aria-label", `${g.members.length} places`);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const b = new lib.LngLatBounds();
        for (const p of g.members) b.extend([p.lng, p.lat]);
        m.fitBounds(b, { padding: 90, maxZoom: Math.max(m.getZoom() + 2, 17), duration: 500 });
      });
      const at = m.unproject([g.x, g.y]);
      clusterMarkers.current.push(new lib.Marker({ element: el }).setLngLat(at).addTo(m));
    }
  }

  // Re-pin when the selection changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    (async () => {
      const lib = await import("maplibre-gl");
      if (map.current !== m) return;
      if (m.loaded()) setPlaces(lib, m);
      else m.once("load", () => setPlaces(lib, m));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  useEffect(() => {
    for (const [id, { pin }] of markers.current) pin.classList.toggle("active", id === selected);
  }, [selected, places]);

  // maplibre's own CSS forces `position: relative` on its container, which would
  // beat Tailwind's `absolute` — so the ref goes on a full-size child instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
