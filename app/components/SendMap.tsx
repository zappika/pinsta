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
 * The map on a sent page (`/w/<id>`). A walk: numbered dark pins joined by a dotted line, straight
 * from stop to stop: a suggestion of an order, not turn-by-turn (Sarp, 2026-10-26). A list: each
 * place's photo, no line, no numbers.
 */
export default function SendMap({ kind, stops, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef<HTMLDivElement[]>([]);
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
        fitBoundsOptions: { padding: { top: 48, bottom: 48, left: 40, right: 40 } },
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
          paint: { "line-color": isDark() ? "#e7e5e4" : "#1c1917", "line-width": 2.5, "line-dasharray": [0.1, 2.2], "line-opacity": 0.75 },
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
        const el = document.createElement("div");
        el.className = "vicolo-send-pin";
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", s.name);
        if (kind === "walk") {
          el.textContent = String(i + 1);
          Object.assign(el.style, {
            width: "30px", height: "30px", borderRadius: "999px", background: "#1c1917", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center", font: "600 14px system-ui",
            border: "2.5px solid white", boxShadow: "0 2px 8px rgba(0,0,0,.25)", cursor: "pointer",
            transition: "transform 160ms ease",
          });
        } else {
          Object.assign(el.style, {
            width: "40px", height: "40px", borderRadius: "999px", overflow: "hidden", cursor: "pointer",
            border: "2.5px solid white", boxShadow: "0 2px 8px rgba(0,0,0,.25)", background: tintFor(s.category),
            backgroundImage: `url("${s.imageUrl ?? placeIcon({ category: s.category, primaryType: s.primaryType, name: s.name })}")`,
            backgroundSize: s.imageUrl ? "cover" : "70%", backgroundPosition: "center", backgroundRepeat: "no-repeat",
            transition: "transform 160ms ease",
          });
        }
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(i);
        });
        new lib.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(m);
        return el;
      });
    })();
    return () => {
      cancelled = true;
      cleanup();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a send never changes
  }, []);

  // The picked stop grows and comes into view.
  useEffect(() => {
    pins.current.forEach((el, i) => {
      el.style.transform = i === selected ? "scale(1.3)" : "";
      el.style.zIndex = i === selected ? "2" : "";
    });
    const m = map.current, s = selected !== null ? stops[selected] : null;
    if (m && s && !m.getBounds().contains([s.lng, s.lat])) m.easeTo({ center: [s.lng, s.lat] });
  }, [selected, stops]);

  return <div ref={container} className="h-full w-full" />;
}
