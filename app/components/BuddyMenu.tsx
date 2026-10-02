"use client";

import { useEffect, useRef, useState } from "react";
import SettingsSheet from "./SettingsSheet";
import UsageSheet from "./UsageSheet";

/**
 * The round "you" button, top right: a short menu. Settings (appearance,
 * directions) and Usage (what the paid APIs cost this month) open as their own sheets; imports are placeholders for the
 * roadmap (plan.md: Menu, Settings and Imports); Lock forgets the owner key.
 */
export default function BuddyMenu() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [usage, setUsage] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto self-center">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-stone-600 active:bg-stone-300"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/5">
          <Item
            icon={<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />}
            label="Settings"
            onClick={() => {
              setOpen(false);
              setSettings(true);
            }}
          />
          <Item
            icon={<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>}
            label="Usage"
            onClick={() => {
              setOpen(false);
              setUsage(true);
            }}
          />
          <Item
            icon={<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>}
            label="Import from Google"
            soon
          />
          <div className="my-1 h-px bg-stone-100" />
          <Item
            icon={<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>}
            label="Lock this browser"
            onClick={() => {
              try {
                localStorage.removeItem("pinsta-owner-key");
              } catch {}
              location.reload();
            }}
          />
        </div>
      )}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
      {usage && <UsageSheet onClose={() => setUsage(false)} />}
    </div>
  );
}

/** A menu row. `soon` = roadmap placeholder: shown, labelled, not tappable. */
function Item({ icon, label, onClick, soon }: { icon: React.ReactNode; label: string; onClick?: () => void; soon?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={soon}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium ${soon ? "text-stone-400" : "active:bg-stone-50"}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-stone-500">
        {icon}
      </svg>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {soon && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Soon</span>}
    </button>
  );
}
