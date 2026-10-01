"use client";

import { appleMapsUrl, googleMapsUrl } from "./maps";

/**
 * One Directions button. The first tap asks Apple Maps or Google Maps; the
 * answer is remembered in this browser and can be changed in Settings (buddy menu).
 */
export type MapsApp = "apple" | "google";
const KEY = "pinsta.maps";

export const MAPS_LABEL: Record<MapsApp, string> = { apple: "Apple Maps", google: "Google Maps" };

export function defaultMaps(): MapsApp | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "apple" || v === "google" ? v : null;
  } catch {
    return null;
  }
}

export function setDefaultMaps(app: MapsApp) {
  try {
    localStorage.setItem(KEY, app);
  } catch {}
}

/** Back to asking on the next Directions tap (Settings → Directions → Ask). */
export function clearDefaultMaps() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

type Target = { name: string; placeId: string; lat: number; lng: number };

export function openIn(app: MapsApp, p: Target) {
  const url = app === "google" ? googleMapsUrl(p.name, p.placeId) : appleMapsUrl(p.name, p.lat, p.lng);
  window.open(url, "_blank", "noopener");
}

/** Called by the card button: open straight away, or ask first (the app shell listens). */
export function directions(p: Target) {
  const app = defaultMaps();
  if (app) openIn(app, p);
  else window.dispatchEvent(new CustomEvent("pinsta:choose-maps", { detail: p }));
}
