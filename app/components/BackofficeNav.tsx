"use client";

import { usePathname } from "next/navigation";

/**
 * The backoffice's tab bar, on every backoffice page (Sarp, 2026-10-18: one place for the beta's
 * numbers, kept on the phone's Home Screen; 2026-10-19: every page in it, nothing reached only
 * through another page). Pulse is home: is Vicolo working for people. Saves: every save sheet,
 * misses first. Usage: what the paid services cost. Parity: web vs iOS. Library: the art.
 * Sandbox: the save flow's design sandbox (/success).
 */
const TABS = [
  { href: "/pulse", label: "Pulse" },
  { href: "/saves", label: "Saves" },
  { href: "/usage", label: "Usage" },
  { href: "/parity", label: "Parity" },
  { href: "/library", label: "Library" },
  { href: "/success", label: "Sandbox" },
];

export default function BackofficeNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-stone-100/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const on = path === t.href || path.startsWith(t.href + "/");
          return (
            <a
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`flex-1 py-3 text-center text-[13px] font-medium ${on ? "text-stone-900" : "text-stone-400 active:text-stone-600"}`}
            >
              {t.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
