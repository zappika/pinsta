"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Send } from "@/lib/db/schema";
import { countLabel } from "@/lib/sends";
import { sendUrl } from "./SendSheet";

/**
 * Sent, from the buddy menu: every walk and list sent to a friend, newest first. A send never
 * shows on the map (Sarp, 2026-10-26: "I don't want this to hold on in my lists forever"); this
 * is where its link is found again, or deleted (then the link stops working).
 */
export default function SentSheet({ onClose }: { onClose: () => void }) {
  const [sends, setSends] = useState<Send[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api("/api/sends", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sends: [] }))
      .then((d: { sends: Send[] }) => setSends(d.sends))
      .catch(() => setSends([]));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function remove(s: Send) {
    if (!confirm(`Delete “${s.title}”? The link stops working.`)) return;
    setSends((xs) => xs?.filter((x) => x.id !== s.id) ?? null);
    await api(`/api/sends/${s.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Sent">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Sent{sends && sends.length > 0 && ` · ${sends.length}`}</p>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
            Done
          </button>
        </div>
        {sends === null ? (
          <p className="px-4 pt-2 pb-6 text-sm text-stone-400">Loading…</p>
        ) : sends.length === 0 ? (
          <p className="px-4 pt-2 pb-6 text-sm text-stone-500">Nothing sent yet. Tap + and Send to a friend.</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-y-auto overscroll-contain pb-2">
            {sends.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <a href={sendUrl(s.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="truncate text-sm text-stone-500">
                    {countLabel(s.kind, s.stops.length)} · {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </p>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(sendUrl(s.id)).catch(() => undefined);
                    setCopied(s.id);
                  }}
                  className="min-h-9 rounded-full bg-stone-100 px-3 text-sm font-medium active:bg-stone-200"
                >
                  {copied === s.id ? "Copied" : "Copy link"}
                </button>
                <button type="button" aria-label={`Delete ${s.title}`} onClick={() => remove(s)} className="h-9 w-7 text-lg text-stone-400">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
