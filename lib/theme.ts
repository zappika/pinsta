"use client";

/**
 * Appearance: "system" follows the phone; "light"/"dark" pin it. The choice is
 * stored in this browser and applied as <html data-theme>, which globals.css
 * reads (an inline script in layout.tsx applies it before first paint).
 */
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "pinsta.theme";

export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {}
  applyTheme(t);
  window.dispatchEvent(new Event("pinsta:theme"));
}

function applyTheme(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

/** What is actually showing right now. */
export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Runs inline in <head> before paint, so a pinned theme never flashes. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
