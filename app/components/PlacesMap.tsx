"use client";

import { useEffect, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { placeIcon, tintFor } from "@/lib/categories";
import { NEAR_KM, kmBetween } from "@/lib/geo";
import { isDark } from "@/lib/theme";
import type { Place } from "./types";

// OpenFreeMap: vector tiles, no key, no quota. Positron is the quiet grey style; "dark" its night twin.
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
/**
 * Loud and quiet pins (Sarp, 2026-10-16: seventy imported pins drowned the few saved from posts,
 * most of them the same gilda). A place saved from a post is loud: its photo, bigger as you zoom
 * in. Everything else (list imports, Maps links, typed names) is quiet: a small dot in its type's
 * tint, the type icon only at street level. Sizes by zoom tier; pins group only when they'd
 * really overlap, and names show only where they fit.
 */
type Tier = "city" | "hood" | "street";
const tierAt = (z: number): Tier => (z < 13.5 ? "city" : z < NO_CLUSTER_ZOOM ? "hood" : "street");
const LOUD_PX: Record<Tier, number> = { city: 30, hood: 36, street: 44 };
const QUIET_PX: Record<Tier, number> = { city: 12, hood: 12, street: 32 };
/** Exploring (Sarp, 2026-10-16): "tiers" as above, or "text": zoomed out, a post's place is its
 * name on a small dark dot, the photo from neighbourhood level. Temporary switch on the map. */
type PinStyle = "tiers" | "text";
/** This few places on screen: no reason to shrink anything, every pin at full size (Sarp: "not much
 * point of showing things very small where there are only 2–3–4 pins"). */
const ROOMY = 8;
/** Post places that would overlap sit side by side, up to this many; more become a count. A photo
 * with a "2" on it read as one place with two photos (Sarp, 2026-10-16). */
const FAN_MAX = 4;

/** A type's pastel tint, deeper, for a dot with no icon: the pastels vanished on the grey map. */
function deepen(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  const s = d ? Math.min(0.62, Math.max(0.42, d / (1 - Math.abs(max + min - 1)))) : 0;
  const l = 0.62;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = l - c / 2;
  [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m0) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
const PIN_STYLE_KEY = "vicolo.pinStyle";
/** From street level on, never group — two entries at one address would never split. */
const NO_CLUSTER_ZOOM = 16;
/** A frame is never narrower than this: a town's places in two neighbourhoods still show
 * a piece of the city around them (Sarp, 2026-10-15: "too tight"). ↔ `PlacesMapView.minFrameKm`. */
const MIN_FRAME_KM = 4.5;
const FRAME_PADDING = { top: 60, bottom: 180, left: 50, right: 50 };

/** `bounds` grown around its centre to at least MIN_FRAME_KM across, both ways. */
function atLeastMinFrame(lib: typeof maplibregl, bounds: maplibregl.LngLatBounds) {
  const c = bounds.getCenter();
  const dLat = MIN_FRAME_KM / 2 / 111.32;
  const dLng = dLat / Math.cos((c.lat * Math.PI) / 180);
  return new lib.LngLatBounds(bounds.getSouthWest(), bounds.getNorthEast())
    .extend([c.lng - dLng, c.lat - dLat])
    .extend([c.lng + dLng, c.lat + dLat]);
}

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place | null) => void;
  /** The base map could not load (bad connection): the app falls back to the list. */
  onFail?: () => void;
  /** What to frame, when not all of `places` (Everywhere: one country, see PinstaApp). */
  focus?: Place[];
  /** Where you are, when location is allowed: a blue dot, like Google Maps (Sarp, 2026-10-09). */
  here?: { lat: number; lng: number } | null;
  /** Bumped by the locate button: frame the blue dot (`here`) at town size. */
  goHere?: number;
  /** The person moved the map after a locate: the button goes back to its outline. */
  onAway?: () => void;
};

/**
 * The current Where/What selection on a map, framed to fit it (or to `focus`).
 * Loud pins (saved from a post: its photo) over quiet ones (a tinted dot); see Tier.
 * Tap a pin → PeekCard; tap a group → zoom in until it splits.
 */
/** A map that has not drawn by then is treated as offline. */
const LOAD_TIMEOUT_MS = 12_000;

/** The photo of a place picked one at a time (a post, a name, a Maps link): loud. Null for a list
 * import (quiet) or a place with no photo. Sarp, 2026-10-16: places saved by name count too. */
function fromPost(p: Place): string | null {
  return p.fromList ? null : p.imageUrl;
}

export default function PlacesMap({ places, selected, onSelect, onFail, focus, here = null, goHere = 0, onAway }: Props) {
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
  const onAwayRef = useRef(onAway);
  onAwayRef.current = onAway;

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
      // A drag or pinch by the person (not our own flyTo/fitBounds, which have no originalEvent).
      const away = (e: { originalEvent?: unknown }) => {
        if (e.originalEvent) onAwayRef.current?.();
      };
      m.on("dragstart", away);
      m.on("zoomstart", away);
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
        libRef.current = lib;
        setPlaces(lib, m);
        showHere();
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
      hereMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const libRef = useRef<typeof maplibregl | null>(null);
  const hereRef = useRef(here);
  hereRef.current = here;
  const hereMarker = useRef<maplibregl.Marker | null>(null);

  /** The blue dot: drawn under the pins, moved when the fix changes. */
  function showHere() {
    const lib = libRef.current, m = map.current, at = hereRef.current;
    if (!lib || !m || !ready.current) return;
    if (!at) {
      hereMarker.current?.remove();
      hereMarker.current = null;
      return;
    }
    if (!hereMarker.current) {
      const dot = document.createElement("div");
      dot.className = "pinsta-here";
      dot.setAttribute("aria-label", "You are here");
      hereMarker.current = new lib.Marker({ element: dot }).setLngLat([at.lng, at.lat]).addTo(m);
    } else {
      hereMarker.current.setLngLat([at.lng, at.lat]);
    }
  }
  useEffect(showHere, [here]);
  // A fix that arrives after the map drew: frame again so the dot is in view.
  const hadHere = useRef(false);
  useEffect(() => {
    if (!here || hadHere.current) return;
    hadHere.current = true;
    if (libRef.current && map.current && ready.current) setPlaces(libRef.current, map.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);
  // The locate button: you at town size, whatever the selection (like Google Maps).
  // Declared after the effect above, so a first fix's reframe is overridden by this.
  useEffect(() => {
    const lib = libRef.current, m = map.current;
    if (!goHere || !here || !lib || !m || !ready.current) return;
    const box = atLeastMinFrame(lib, new lib.LngLatBounds([here.lng, here.lat], [here.lng, here.lat]));
    m.fitBounds(box, { padding: FRAME_PADDING, duration: 600 });
  }, [goHere, here]);

  const placesRef = useRef(places);
  placesRef.current = places;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const clusterMarkers = useRef<maplibregl.Marker[]>([]);
  const [pinStyle, setPinStyle] = useState<PinStyle>("tiers");
  const styleRef = useRef<PinStyle>("tiers");
  useEffect(() => {
    try {
      if (localStorage.getItem(PIN_STYLE_KEY) === "text") setPinStyle("text");
    } catch {}
  }, []);
  useEffect(() => {
    styleRef.current = pinStyle;
    try {
      localStorage.setItem(PIN_STYLE_KEY, pinStyle);
    } catch {}
    if (libRef.current && map.current && ready.current) draw(libRef.current, map.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinStyle]);

  /** New selection: frame it, then draw. */
  function setPlaces(lib: typeof maplibregl, m: maplibregl.Map) {
    const list = focusRef.current?.length ? focusRef.current : placesRef.current;
    draw(lib, m);
    if (list.length === 0) return;
    const bounds = new lib.LngLatBounds();
    for (const p of list) bounds.extend([p.lng, p.lat]);
    // You're among these places: the frame takes you in too, so the dot shows.
    const at = hereRef.current;
    if (at && list.some((p) => kmBetween(at, p) <= NEAR_KM)) bounds.extend([at.lng, at.lat]);
    // Never tighter than a piece of the city (MIN_FRAME_KM), so one place isn't a dot at max zoom either.
    m.fitBounds(atLeastMinFrame(lib, bounds), { padding: FRAME_PADDING, maxZoom: 15, duration: 600 });
    // Pins that overlap at this zoom are grouped; regroup whenever the map settles.
    m.off("moveend", redraw.current);
    redraw.current = () => draw(lib, m);
    m.on("moveend", redraw.current);
  }
  const redraw = useRef<() => void>(() => {});

  /**
   * Greedy screen-space grouping, loud and quiet apart: a pin joins a group it would overlap.
   * Then names, loud first, each only where it hits no pin and no name already placed.
   */
  function draw(lib: typeof maplibregl, m: maplibregl.Map) {
    for (const { marker } of markers.current.values()) marker.remove();
    markers.current.clear();
    for (const c of clusterMarkers.current) c.remove();
    clusterMarkers.current = [];

    const z = m.getZoom();
    const view = m.getBounds();
    const onScreen = placesRef.current.filter((p) => view.contains([p.lng, p.lat])).length;
    const tier: Tier = onScreen <= ROOMY ? "street" : tierAt(z);
    const text = styleRef.current === "text" && z < 15;
    const loudPx = text ? 10 : LOUD_PX[tier];
    const quietPx = QUIET_PX[tier];
    type Group = { x: number; y: number; members: Place[]; loud: boolean; fanBy?: number; fanned?: boolean };
    const groups: Group[] = [];
    for (const p of placesRef.current) {
      const loud = fromPost(p) !== null;
      const pt = m.project([p.lng, p.lat]);
      // Dots barely overlap at 12 px: they group only when nearly on top of each other.
      const near = loud ? loudPx + 2 : Math.max(quietPx - 2, 8);
      const g = z < NO_CLUSTER_ZOOM ? groups.find((g) => g.loud === loud && Math.hypot(g.x - pt.x, g.y - pt.y) < near) : undefined;
      if (g) g.members.push(p);
      else groups.push({ x: pt.x, y: pt.y, members: [p], loud });
    }

    // What names mustn't cover: post photos, groups and other names. A faint dot under a name's
    // white halo is fine; counting the dots left no room for any name in central Barcelona.
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const taken: Box[] = [];
    const hit = (b: Box) => taken.some((t) => b.x0 < t.x1 && b.x1 > t.x0 && b.y0 < t.y1 && b.y1 > t.y0);
    const named: { el: HTMLElement; x: number; y: number; size: number; name: string; loud: boolean }[] = [];

    // A few post places together sit side by side, centred on the group, each its own photo.
    const drawn: Group[] = groups.flatMap((g) =>
      g.loud && g.members.length > 1 && g.members.length <= FAN_MAX
        ? g.members.map((p, i) => ({ ...g, members: [p], fanBy: i - (g.members.length - 1) / 2, fanned: true }))
        : [{ ...g, fanBy: 0 }],
    );

    // Pins that would overlap (only at street level, where grouping stops) fan out sideways.
    const seen: { x: number; y: number; n: number }[] = [];
    for (const g of drawn) {
      const size = g.loud ? loudPx : quietPx;
      if (g.members.length === 1) {
        const p = g.members[0];
        const twin = g.loud && !g.fanned ? seen.find((q) => Math.hypot(q.x - g.x, q.y - g.y) < size) : undefined;
        // The middle of an odd fan has fanBy 0 and still belongs to the fan (it sat on its neighbour).
        const fan = g.fanned ? g.fanBy! : twin ? ++twin.n : 0;
        if (g.loud && !twin) seen.push({ x: g.x + fan * (size + 4), y: g.y, n: 0 });
        const el = document.createElement("div");
        el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;z-index:${g.loud ? 2 : 1}`;
        const pin = document.createElement("div");
        pin.className = `pinsta-pin ${g.loud ? (text ? "pinsta-pin-text" : "pinsta-pin-loud") : tier === "street" ? "pinsta-pin-quiet" : "pinsta-pin-dot"}`;
        pin.style.width = pin.style.height = `${size}px`;
        const photo = fromPost(p);
        if (g.loud && !text) {
          const img = document.createElement("img");
          img.src = photo!;
          img.alt = "";
          img.draggable = false;
          img.className = "pinsta-pin-photo";
          // A picture that won't load: the type's tint, as a dot would have.
          img.onerror = () => { img.remove(); pin.style.backgroundColor = tintFor(p.category); };
          pin.append(img);
        } else if (!g.loud) {
          pin.style.backgroundColor = tier === "street" ? tintFor(p.category) : deepen(tintFor(p.category));
          pin.style.setProperty("--glow", deepen(tintFor(p.category)));
          if (tier === "street") {
            const icon = document.createElement("img");
            icon.src = placeIcon(p);
            icon.alt = "";
            icon.draggable = false;
            icon.className = "pinsta-pin-icon";
            pin.append(icon);
          }
        }
        pin.classList.toggle("active", p.id === selectedRef.current);
        const label = document.createElement("div");
        label.className = `pinsta-pin-label${g.loud ? "" : " quiet"}`;
        label.style.left = `${size + 5}px`;
        label.textContent = p.name;
        el.append(pin, label);
        // A small dot is hard to hit: the tap target is bigger than what's drawn.
        if (size < 24) el.classList.add("pinsta-pin-tap");
        const x = g.x + fan * (size + 4);
        if (g.loud) taken.push({ x0: x - size / 2, y0: g.y - size / 2, x1: x + size / 2, y1: g.y + size / 2 });
        if (!twin) named.push({ el, x, y: g.y, size, name: p.name, loud: g.loud });
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
        // Fanned from the group's middle (fanBy), or sideways from a twin at street level.
        const marker = new lib.Marker({ element: el, offset: [fan * (size + 4) + (g.fanned ? g.x - m.project([p.lng, p.lat]).x : 0), g.fanned ? g.y - m.project([p.lng, p.lat]).y : 0] }).setLngLat([p.lng, p.lat]).addTo(m);
        markers.current.set(p.id, { marker, pin });
        continue;
      }
      // More picked places than fit side by side: a mosaic of up to four of their photos in one circle
      // (a dark count read as a black dot from afar, Venice and Tokyo, 2026-10-16). "Text" style: a
      // dark count. Quiet ones: a slightly bigger dot and no number; counts shouted as loud as the photos.
      const el = document.createElement("div");
      const counts = new Map<string, number>();
      for (const p of g.members) counts.set(p.category ?? "Other", (counts.get(p.category ?? "Other") ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const photos = g.loud && !text ? g.members.map(fromPost).filter((u): u is string => !!u).slice(0, 4) : [];
      const csize = photos.length ? Math.max(size, 40) : g.loud ? 24 : tier === "street" ? quietPx : 16;
      el.className = `pinsta-pin pinsta-cluster${photos.length ? " pinsta-mosaic" : g.loud ? " pinsta-pin-text" : " pinsta-cluster-quiet"}`;
      if (photos.length) {
        el.dataset.n = String(Math.min(photos.length, 4));
        for (const u of photos) {
          const img = document.createElement("img");
          img.src = u;
          img.alt = "";
          img.draggable = false;
          el.append(img);
        }
      }
      el.style.cssText = `width:${csize}px;height:${csize}px;z-index:${g.loud ? 3 : 1}`;
      if (!g.loud) {
        el.style.backgroundColor = tier === "street" ? tintFor(top) : deepen(tintFor(top));
        el.style.setProperty("--glow", deepen(tintFor(top)));
      }
      if ((g.loud && !photos.length) || (!g.loud && tier === "street")) {
        el.textContent = String(g.members.length);
      }
      taken.push({ x0: g.x - csize / 2, y0: g.y - csize / 2, x1: g.x + csize / 2, y1: g.y + csize / 2 });
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

    // Names: a post's place from city level in "text", from 12.5 in "tiers" (a phone shows all of
    // central Barcelona at ~12.5); the rest from 14.5.
    // With few places on screen, every name.
    const roomy = onScreen <= ROOMY;
    const wants = (n: (typeof named)[number]) => roomy || (n.loud ? text || z >= 12.5 : z >= 14.5);
    for (const n of named.filter(wants).sort((a, b) => Number(b.loud) - Number(a.loud))) {
      const w = n.name.length * (n.loud ? 7.2 : 6.4) + 4;
      const box = { x0: n.x + n.size / 2 + 3, y0: n.y - 9, x1: n.x + n.size / 2 + 5 + w, y1: n.y + 9 };
      if (hit(box)) continue;
      taken.push(box);
      n.el.classList.add("labelled");
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
      {/* Temporary: compare the two pin styles on the real list (Sarp, 2026-10-16). */}
      <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+5.5rem)] z-10 flex rounded-full bg-white/90 p-0.5 text-xs font-medium shadow-sm backdrop-blur">
        {(["tiers", "text"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setPinStyle(s)}
            className={`rounded-full px-2.5 py-1 capitalize ${pinStyle === s ? "bg-stone-900 text-white" : "text-stone-500"}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A stable dependency for the framed set: the same places frame the same way. */
const focusKey = (f: Place[] | undefined) => f?.map((p) => p.id).join(",") ?? "";
