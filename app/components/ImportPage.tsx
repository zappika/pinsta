"use client";

import { useEffect, useMemo, useState } from "react";
import { api, setOwnerKey } from "@/lib/api";
import { CATEGORIES, iconFor, type Category } from "@/lib/categories";
import Locked from "./Locked";

type Match = { placeId: string; name: string; city: string | null; category: Category };
type Item = {
  name: string;
  note: string | null;
  address: string | null;
  lat: number;
  lng: number;
  match: Match | null;
  savedId: string | null;
};
type Row = Item & { key: number; picked: boolean; category: Category; state: "idle" | "saving" | "saved" | "failed" };
type Preview = { title: string | null; owner: string | null; total: number; rows: Row[] };
/** The whole list goes in as one or the other (Sarp, 2026-10-11): sixty unsorted places would never get sorted. */

/**
 * /import: a shared Google Maps list becomes Vicolo places. Paste the list's
 * link, check what came back, grouped by category (untick, move a place or a
 * whole group to another category), then import. Already-saved places and ones Google can't place are
 * shown but not importable. MVP on the web (Sarp, 2026-10-06); iOS later.
 */
export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [keyTried, setKeyTried] = useState(false);
  const [been, setBeen] = useState(false);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener("pinsta:locked", onLocked);
    return () => window.removeEventListener("pinsta:locked", onLocked);
  }, []);

  // Sent here by the + menu's Google Maps entry with a list link: read it straight away.
  const [fromMenu, setFromMenu] = useState<string | null>(null);
  useEffect(() => {
    const u = new URLSearchParams(location.search).get("url");
    if (u) {
      setUrl(u);
      setFromMenu(u);
    }
  }, []);
  useEffect(() => {
    if (fromMenu && url === fromMenu) {
      setFromMenu(null);
      void read();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromMenu, url]);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {}
  }

  async function read() {
    if (!url.trim() || reading) return;
    setReading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await api("/api/import/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A private list reads as nothing: say so (Sarp, 2026-10-16).
        const msg: string = data.error ?? "Couldn't read that list.";
        if (res.status !== 401) setError(/private/i.test(msg) ? msg : `${msg.replace(/\.?$/, ".")} If it's private, share it in Google Maps first.`);
        return;
      }
      setPreview({
        title: data.title,
        owner: data.owner ?? null,
        total: data.total,
        rows: (data.items as Item[]).map((it, key) => ({
          ...it,
          key,
          picked: importable(it),
          category: it.match?.category ?? "Other",
          state: "idle",
        })),
      });
    } catch {
      setError("Couldn't reach Vicolo. Check the connection and try again.");
    } finally {
      setReading(false);
    }
  }

  const update = (key: number, change: Partial<Row>) =>
    setPreview((p) => p && { ...p, rows: p.rows.map((r) => (r.key === key ? { ...r, ...change } : r)) });

  const picked = useMemo(() => preview?.rows.filter((r) => r.picked && r.state !== "saved") ?? [], [preview]);
  const savedCount = preview?.rows.filter((r) => r.state === "saved").length ?? 0;

  async function runImport() {
    if (!preview || importing) return;
    setImporting(true);
    // Two at a time: each save is a Google details call plus a photo.
    const queue = [...picked];
    await Promise.all(
      [0, 1].map(async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          update(r.key, { state: "saving" });
          const ok = await save(r, { title: preview.title, owner: preview.owner }, been);
          update(r.key, { state: ok ? "saved" : "failed", picked: !ok });
        }
      }),
    );
    setImporting(false);
  }

  if (locked) {
    return (
      <Locked
        rejected={keyTried}
        onKey={(k) => {
          setKeyTried(true);
          setOwnerKey(k);
          setLocked(false);
        }}
      />
    );
  }

  const missing = preview?.rows.filter((r) => !r.match && !r.savedId) ?? [];
  const already = preview?.rows.filter((r) => r.savedId).length ?? 0;
  const done = !!preview && savedCount > 0 && picked.length === 0 && !importing;
  const total = savedCount + picked.length;
  const cancel = () => {
    if (confirm("Cancel this import? Nothing from this list is added.")) {
      setPreview(null);
      setUrl("");
      setChoosing(false);
    }
  };

  // One mode at a time (Sarp, 2026-10-19): paste; then the list until Import or Cancel import.
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-48">
      {choosing ? (
        <button type="button" onClick={() => setChoosing(false)} className="text-sm font-medium text-stone-500 active:text-stone-700">
          ← Back
        </button>
      ) : (
        <a href="/app" className="text-sm font-medium text-stone-500 active:text-stone-700">
          ← {preview && !done ? "Later" : "Vicolo"}
        </a>
      )}

      {!preview ? (
        <>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Import from Google Maps</h1>
          <p className="mt-1 text-sm text-stone-500">
            In Google Maps, open Saved, pick a list, and tap Share. Paste that link here. The list has to be shared, not private.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              read();
            }}
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-base outline-none focus:border-stone-400"
            />
            {url ? (
              <button type="submit" disabled={reading} className="w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white active:bg-stone-800 disabled:opacity-40">
                {reading ? "Reading the list…" : "Read list"}
              </button>
            ) : (
              <button type="button" onClick={paste} className="w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white active:bg-stone-800">
                Paste
              </button>
            )}
          </form>
          {reading && <p className="mt-3 text-sm text-stone-500">Reading the list and finding each place. A long list takes a little while.</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </>
      ) : choosing ? (
        <>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Choose what to import</h1>
          <p className="mt-1 text-sm text-stone-500">Tap a place to leave it out. Tap its type to change it.</p>
          {CATEGORIES.map((c) => {
            const rows = preview.rows.filter((r) => importable(r) && r.category === c);
            return rows.length === 0 ? null : (
              <section key={c} className="mt-6">
                <h2 className="px-4 pb-1.5 text-sm text-stone-500">
                  {c} · {rows.length}
                </h2>
                <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
                  {rows.map((r) => (
                    <ChooseRow key={r.key} row={r} disabled={importing} onChange={(change) => update(r.key, change)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      ) : (
        <>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{preview.title ?? "Your list"}</h1>
          {preview.owner && <p className="text-sm text-stone-500">From {preview.owner}</p>}
          {preview.total > preview.rows.length && (
            <p className="mt-1 text-sm text-stone-500">The first {preview.rows.length} of {preview.total} places.</p>
          )}
          <ul className="mt-5 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
            {CATEGORIES.map((c) => {
              const n = picked.filter((r) => r.category === c).length;
              return n === 0 ? null : (
                <li key={c} className="flex items-center gap-3 px-4 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconFor(c)} alt="" className="h-8 w-8 object-contain" />
                  <span className="flex-1">{c}</span>
                  <span className="tabular-nums text-stone-500">{n}</span>
                </li>
              );
            })}
            {picked.length === 0 && <li className="px-4 py-3 text-stone-500">{done ? `${count(savedCount, "place")} imported` : "Nothing chosen"}</li>}
            {!done && (
              <li>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => setChoosing(true)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-stone-50 disabled:opacity-40"
                >
                  Choose what to import <span className="text-stone-400">›</span>
                </button>
              </li>
            )}
          </ul>
          {already > 0 && <p className="mt-2.5 px-4 text-xs text-stone-500">{count(already, "place")} already in your list.</p>}
          {missing.length > 0 && (
            <section className="mt-7">
              <h2 className="px-4 text-sm font-semibold">Couldn’t find {missing.length}</h2>
              <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
                {missing.map((r) => (
                  <li key={r.key} className="px-4 py-3">
                    <p className="truncate text-sm">{r.name}</p>
                    {r.address && <p className="truncate text-xs text-stone-500">{r.address}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!importing && !done && (
            <button type="button" onClick={cancel} className="mt-8 w-full text-center text-sm text-red-600 active:text-red-700">
              Cancel import
            </button>
          )}
        </>
      )}

      {preview && (
        // A solid bar of its own, not floating over the list.
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-stone-100">
          <div className="mx-auto max-w-xl space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
            {done ? (
              <a href="/app" className="block rounded-2xl bg-stone-900 py-3.5 text-center text-sm font-semibold text-white active:bg-stone-800">
                Done · see {count(savedCount, "place")} in your list
              </a>
            ) : (
              <>
                {importing ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
                    <div className="h-full bg-stone-900 transition-all" style={{ width: `${(savedCount / Math.max(total, 1)) * 100}%` }} />
                  </div>
                ) : (
                  <BeenSwitch on={been} disabled={importing} onChange={setBeen} />
                )}
                <button
                  type="button"
                  disabled={picked.length === 0 || importing}
                  onClick={choosing ? () => setChoosing(false) : runImport}
                  className="w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white active:bg-stone-800 disabled:opacity-40"
                >
                  {importing ? `Importing ${savedCount} of ${total}…`
                    : picked.length === 0 ? "Nothing chosen"
                    : choosing ? `Done · ${count(picked.length, "place")} chosen`
                    : `Import ${count(picked.length, "place")}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Imports are Want to go unless this says you have been to them all (Sarp, 2026-10-19:
 * the bookmark/check pair in front of a greyed button was too confusing).
 */
function BeenSwitch({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm text-stone-700">
      I’ve been to these
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-stone-900" : "bg-stone-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/** Tap to leave it out or put it back; the type under the name is a quiet select (no Move pills). */
function ChooseRow({ row, disabled, onChange }: { row: Row; disabled: boolean; onChange: (c: Partial<Row>) => void }) {
  const where = row.match?.city ?? row.address;
  const done = row.state === "saved";
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${row.picked || done ? "" : "opacity-50"}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={row.picked}
        disabled={disabled || done}
        onClick={() => onChange({ picked: !row.picked })}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium">{row.match?.name ?? row.name}</p>
        {where && <p className="truncate text-xs text-stone-500">{where}</p>}
        {row.note && <p className="mt-0.5 line-clamp-2 text-xs italic text-stone-500">“{row.note}”</p>}
      </button>
      <select
        aria-label={`Type of ${row.name}`}
        value={row.category}
        disabled={disabled || done}
        onChange={(e) => onChange({ category: e.target.value as Category })}
        className="shrink-0 appearance-none bg-transparent pt-0.5 text-right text-xs text-stone-500"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${row.picked ? "bg-stone-900 text-white" : "border border-stone-300"}`}>
        {row.picked && "✓"}
      </span>
    </li>
  );
}

const importable = (it: Item) => !!it.match && !it.savedId;
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Saved like any other place (POST /api/places), with a Maps link that names
 * the place as its source: the card's "post" is the Google place itself, and
 * importing the same list again finds the link and adds nothing.
 */
async function save(r: Row, fromList: { title: string | null; owner: string | null }, visited: boolean): Promise<boolean> {
  if (!r.match) return false;
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.match.name)}&query_place_id=${r.match.placeId}`;
  try {
    const res = await api("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramUrl: link, placeId: r.match.placeId, category: r.category, fromList, visited }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
