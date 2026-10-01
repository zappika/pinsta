"use client";

import { useEffect, useState } from "react";
import { MAPS_LABEL, clearDefaultMaps, defaultMaps, setDefaultMaps, type MapsApp } from "@/lib/directions";
import { setTheme, storedTheme, type Theme } from "@/lib/theme";

/**
 * Per-device settings, opened from the buddy menu. Same floating card as the
 * save sheet. Everything here lives in this browser (localStorage).
 */
export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [maps, setMaps] = useState<MapsApp | null>(null);
  useEffect(() => {
    setThemeState(storedTheme());
    setMaps(defaultMaps());
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Settings">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Settings</p>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
            Done
          </button>
        </div>

        <div className="divide-y divide-stone-100 px-4 pb-2">
          <Row label="Appearance" hint="System follows your phone.">
            <Segments
              value={theme}
              options={[
                ["system", "System"],
                ["light", "Light"],
                ["dark", "Dark"],
              ]}
              onChange={(t) => {
                setTheme(t);
                setThemeState(t);
              }}
            />
          </Row>
          <Row label="Directions" hint="Which app opens when you tap Directions on a place.">
            <Segments
              value={maps ?? "ask"}
              options={[
                ["ask", "Ask"],
                ["apple", MAPS_LABEL.apple],
                ["google", MAPS_LABEL.google],
              ]}
              onChange={(v) => {
                if (v === "ask") clearDefaultMaps();
                else setDefaultMaps(v);
                setMaps(v === "ask" ? null : v);
              }}
            />
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="py-3.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="mb-2.5 text-xs text-stone-400">{hint}</p>
      {children}
    </div>
  );
}

function Segments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex rounded-full bg-stone-100 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex-1 whitespace-nowrap rounded-full py-1.5 text-xs font-medium transition-colors ${
            value === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
