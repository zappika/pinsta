"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { tintFor } from "@/lib/categories";
import { isDark } from "@/lib/theme";

type Pin = { lat: number; lng: number; category: string; icon: string };

/**
 * The list import's visual summary (Sarp, 2026-10-19): where the list is, each place its type
 * icon on its tint, framed to fit, not interactive. ↔ iOS `ListMap` in ImportView.swift.
 */
export default function ListMap({ pins }: { pins: Pin[] }) {
  const box = useRef<HTMLDivElement>(null);
  const key = pins.map((p) => `${p.lat},${p.lng},${p.icon}`).join("|");

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const lib = await import("maplibre-gl").catch(() => null);
      if (!lib || cancelled || !box.current || pins.length === 0) return;
      lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const bounds = new lib.LngLatBounds();
      for (const p of pins) bounds.extend([p.lng, p.lat]);
      map = new lib.Map({
        container: box.current,
        style: `https://tiles.openfreemap.org/styles/${isDark() ? "dark" : "positron"}`,
        bounds,
        fitBoundsOptions: { padding: 36, maxZoom: 15 },
        interactive: false,
        attributionControl: { compact: true },
      });
      for (const p of pins) {
        const el = document.createElement("div");
        el.style.cssText = `width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;background:${tintFor(p.category)}`;
        const img = document.createElement("img");
        img.src = p.icon;
        img.alt = "";
        img.style.cssText = "width:18px;height:18px;object-fit:contain";
        el.append(img);
        new lib.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={box} className="h-56 w-full overflow-hidden rounded-2xl bg-stone-200" />;
}
