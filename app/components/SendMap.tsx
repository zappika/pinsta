"use client";

import { useEffect, useRef } from "react";
import type * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { placeIcon, tintFor } from "@/lib/categories";
import { isDark } from "@/lib/theme";
import type { SendKind, SendStop } from "@/lib/sends";

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
/** A walk's stops can sit on one block; still show the streets around them. */
const MIN_FRAME_KM = 1.2;

type Props = {
  kind: SendKind;
  stops: SendStop[];
  selected: number | null;
  onSelect: (i: number | null) => void;
};

/**
 * The map on a sent page (`/w/<id>`). A walk: numbered white pins joined by a dotted line, straight
 * from stop to stop: a suggestion of an order, not turn-by-turn (Sarp, 2026-10-26). A list: each
 * place's photo, no line, no numbers.
 */
export default function SendMap({ kind, stops, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef<HTMLDivElement[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const lib = await import("maplibre-gl").catch(() => null);
      if (!lib || cancelled || !container.current) return;
      lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const bounds = new lib.LngLatBounds();
      for (const s of stops) bounds.extend([s.lng, s.lat]);
      const c = bounds.getCenter();
      const dLat = MIN_FRAME_KM / 2 / 111.32, dLng = dLat / Math.cos((c.lat * Math.PI) / 180);
      bounds.extend([c.lng - dLng, c.lat - dLat]).extend([c.lng + dLng, c.lat + dLat]);
      const m = new lib.Map({
        container: container.current,
        style: isDark() ? STYLE_DARK : STYLE_LIGHT,
        bounds,
        // A little room for the names under the pins; a name that would leave the map moves aside.
        fitBoundsOptions: { padding: { top: 40, bottom: 52, left: 48, right: 48 } },
        attributionControl: { compact: true },
      });
      map.current = m;
      m.on("click", () => onSelectRef.current(null));

      // The dotted line goes back on with every style (light ↔ dark replaces the layers).
      const line = () => {
        if (kind !== "walk" || stops.length < 2 || m.getSource("walk")) return;
        m.addSource("walk", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops.map((s) => [s.lng, s.lat]) } },
        });
        m.addLayer({
          id: "walk",
          type: "line",
          source: "walk",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": isDark() ? "#e7e5e4" : "#44403c", "line-width": 2, "line-dasharray": [0.1, 2], "line-opacity": 0.55 },
        });
      };
      m.on("style.load", line);
      const restyle = () => m.setStyle(isDark() ? STYLE_DARK : STYLE_LIGHT);
      const mq = matchMedia("(prefers-color-scheme: dark)");
      window.addEventListener("pinsta:theme", restyle);
      mq.addEventListener("change", restyle);
      cleanup = () => {
        window.removeEventListener("pinsta:theme", restyle);
        mq.removeEventListener("change", restyle);
      };

      pins.current = stops.map((s, i) => {
        // The marker element is moved by MapLibre's own transform: the look lives on its children.
        const el = document.createElement("div");
        el.className = "vicolo-stop";
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", kind === "walk" ? `${i + 1}. ${s.name}` : s.name);
        const mark = document.createElement("div");
        if (kind === "walk") {
          mark.className = "vicolo-stop-mark num";
          mark.textContent = String(i + 1);
        } else {
          mark.className = "vicolo-stop-mark photo";
          const img = document.createElement("span");
          Object.assign(img.style, {
            backgroundColor: tintFor(s.category),
            backgroundImage: `url("${s.imageUrl ?? placeIcon({ category: s.category, primaryType: s.primaryType, name: s.name })}")`,
            backgroundSize: s.imageUrl ? "cover" : "70%",
          });
          mark.append(img);
        }
        const label = document.createElement("div");
        label.className = "vicolo-stop-label";
        label.textContent = s.name;
        el.append(mark, label);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(i);
        });
        new lib.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(m);
        return el;
      });
      m.on("moveend", () => fitLabels(pins.current, selectedRef.current));
      m.once("load", () => fitLabels(pins.current, selectedRef.current));
    })();
    return () => {
      cancelled = true;
      cleanup();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a send never changes
  }, []);

  // The picked stop goes dark and comes into view.
  useEffect(() => {
    pins.current.forEach((el, i) => el.classList.toggle("is-picked", i === selected));
    fitLabels(pins.current, selected);
    const m = map.current, s = selected !== null ? stops[selected] : null;
    if (m && s && !m.getBounds().contains([s.lng, s.lat])) m.easeTo({ center: [s.lng, s.lat] });
  }, [selected, stops]);

  return <div ref={container} className="h-full w-full" />;
}

/**
 * Names only where they fit: two stops on one block would print over each other (Voo Store and
 * Hasir, 2026-10-26). The picked stop's name first, then in order; each tries below its pin, then
 * right, then left, and stays hidden when it would touch a shown name, another pin or the edge.
 */
const SIDES = ["", "at-right", "at-left"] as const;
function fitLabels(pins: HTMLDivElement[], selected: number | null) {
  if (!pins.length) return;
  const order = pins.map((_, i) => i).sort((a, b) => (a === selected ? -1 : b === selected ? 1 : a - b));
  const marks = pins.map((p) => p.firstElementChild!.getBoundingClientRect());
  const box = pins[0].closest(".maplibregl-map")?.getBoundingClientRect();
  const shown: DOMRect[] = [];
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right + 3 && b.left < a.right + 3 && a.top < b.bottom + 1 && b.top < a.bottom + 1;
  const inside = (r: DOMRect) => !box || (r.left >= box.left + 4 && r.right <= box.right - 4 && r.bottom <= box.bottom - 4);
  for (const i of order) {
    const label = pins[i].lastElementChild as HTMLElement;
    let placed = false;
    for (const side of SIDES) {
      label.classList.remove("at-right", "at-left");
      if (side) label.classList.add(side);
      const r = label.getBoundingClientRect();
      if (inside(r) && !shown.some((x) => hit(r, x)) && !marks.some((m, j) => j !== i && hit(r, m))) {
        shown.push(r);
        placed = true;
        break;
      }
    }
    label.style.visibility = placed ? "" : "hidden";
  }
}
