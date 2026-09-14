"use client";

import { useEffect, useRef } from "react";
import type * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { emojiFor } from "@/lib/categories";
import type { Place } from "./types";

// OpenFreeMap: vector tiles, no key, no quota. Positron is the quiet grey style.
const STYLE = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place | null) => void;
};

/**
 * The current Where/What selection on a map, framed to fit it. Pins are the
 * post photo, or the category glyph when there is none. Tap a pin → PeekCard.
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placesRef = useRef(places);
  placesRef.current = places;

  function setPlaces(lib: typeof maplibregl, m: maplibregl.Map) {
    for (const { marker } of markers.current.values()) marker.remove();
    markers.current.clear();
    const list = placesRef.current;
    if (list.length === 0) return;

    const bounds = new lib.LngLatBounds();
    for (const p of list) {
      const el = document.createElement("div");
      el.style.cssText = "width:44px;height:44px;cursor:pointer";
      const pin = document.createElement("div");
      pin.className = "pinsta-pin";
      if (p.imageUrl) pin.style.backgroundImage = `url(${p.imageUrl})`;
      else pin.textContent = emojiFor(p.category);
      const label = document.createElement("div");
      label.className = "pinsta-pin-label";
      label.textContent = p.name;
      el.append(pin, label);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(p);
        // Nudge the pin up so the PeekCard doesn't sit on top of it.
        m.easeTo({ center: [p.lng, p.lat], offset: [0, -140] });
      });
      const marker = new lib.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
      markers.current.set(p.id, { marker, pin });
      bounds.extend([p.lng, p.lat]);
    }
    // One place → a neighbourhood, not a dot at max zoom.
    m.fitBounds(bounds, { padding: { top: 60, bottom: 180, left: 50, right: 50 }, maxZoom: 15, duration: 600 });
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
