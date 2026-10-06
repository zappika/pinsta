"use client";

import { useEffect, useMemo, useState } from "react";
import { api, setOwnerKey } from "@/lib/api";
import { CATEGORIES, emojiFor, type Category } from "@/lib/categories";
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
type Preview = { title: string | null; total: number; rows: Row[] };

/**
 * /import: a shared Google Maps list becomes Vicolo places. Paste the list's
 * link, check what came back (untick, fix a category, or set one for the whole
 * list), then import. Already-saved places and ones Google can't place are
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

  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener("pinsta:locked", onLocked);
    return () => window.removeEventListener("pinsta:locked", onLocked);
  }, []);

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
        if (res.status !== 401) setError(data.error ?? "Couldn't read that list.");
        return;
      }
      setPreview({
        title: data.title,
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
  const setAll = (change: (r: Row) => Partial<Row>) =>
    setPreview((p) => p && { ...p, rows: p.rows.map((r) => (importable(r) && r.state === "idle" ? { ...r, ...change(r) } : r)) });

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
          const ok = await save(r);
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

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-32">
      <a href="/" className="text-sm font-medium text-stone-500 active:text-stone-700">
        ← Vicolo
      </a>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Import from Google Maps</h1>
      <p className="mt-1 text-sm text-stone-500">
        In Google Maps, open Saved, pick a list, and tap Share. Paste that link here. The list has to be shared, not private.
      </p>

      <form
        className="mt-4 flex gap-2"
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
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-base outline-none focus:border-stone-400"
        />
        <button
          type="submit"
          disabled={!url.trim() || reading}
          className="rounded-xl bg-stone-900 px-4 text-sm font-medium text-white active:bg-stone-800 disabled:opacity-40"
        >
          {reading ? "Reading…" : "Read list"}
        </button>
      </form>
      {reading && <p className="mt-3 text-sm text-stone-500">Reading the list and finding each place. A long list takes a little while.</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {preview && (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{preview.title ?? "Your list"}</h2>
              <p className="text-sm text-stone-500">
                {count(preview.rows.length, "place")}
                {preview.total > preview.rows.length && ` (the first ${preview.rows.length} of ${preview.total})`}
                {savedCount > 0 && ` · ${savedCount} imported`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* A list is often one kind of place ("Coffee in Lisbon"): set them all at once. */}
              <select
                aria-label="Set every category"
                value=""
                disabled={importing}
                onChange={(e) => e.target.value && setAll(() => ({ category: e.target.value as Category }))}
                className="rounded-lg bg-white px-2.5 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200"
              >
                <option value="">All as…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  const on = preview.rows.some((r) => importable(r) && r.state === "idle" && !r.picked);
                  setAll(() => ({ picked: on }));
                }}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 active:bg-stone-200"
              >
                {preview.rows.some((r) => importable(r) && r.state === "idle" && !r.picked) ? "Select all" : "Select none"}
              </button>
            </div>
          </div>

          <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
            {preview.rows.map((r) => (
              <ImportRow key={r.key} row={r} disabled={importing} onChange={(c) => update(r.key, c)} />
            ))}
          </ul>
        </>
      )}

      {preview && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          {picked.length === 0 && savedCount > 0 && !importing ? (
            <a href="/" className="block rounded-2xl bg-stone-900 py-3.5 text-center text-sm font-semibold text-white shadow-lg active:bg-stone-800">
              Done · see {count(savedCount, "place")} in your list
            </a>
          ) : (
            <button
              type="button"
              disabled={picked.length === 0 || importing}
              onClick={runImport}
              className="w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white shadow-lg active:bg-stone-800 disabled:opacity-40"
            >
              {importing ? `Importing… ${savedCount} done` : picked.length === 0 ? "Nothing selected" : `Import ${count(picked.length, "place")}`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function ImportRow({ row, disabled, onChange }: { row: Row; disabled: boolean; onChange: (c: Partial<Row>) => void }) {
  const can = importable(row) && row.state !== "saved";
  const where = row.match?.city ?? row.address;
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${can ? "" : "opacity-60"}`}>
      <input
        type="checkbox"
        aria-label={`Import ${row.name}`}
        checked={row.picked && can}
        disabled={!can || disabled || row.state === "saving"}
        onChange={(e) => onChange({ picked: e.target.checked })}
        className="mt-1 h-4 w-4 shrink-0 accent-stone-900"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.match?.name ?? row.name}</p>
        {where && <p className="truncate text-xs text-stone-500">{where}</p>}
        {row.note && <p className="mt-0.5 line-clamp-2 text-xs italic text-stone-500">“{row.note}”</p>}
        {row.savedId && <p className="mt-0.5 text-xs font-medium text-stone-500">Already in your list</p>}
        {!row.match && <p className="mt-0.5 text-xs font-medium text-amber-700">Google couldn&apos;t find this place</p>}
        {row.state === "failed" && <p className="mt-0.5 text-xs font-medium text-red-600">Couldn&apos;t save. Try again.</p>}
      </div>
      {row.state === "saved" ? (
        <span className="shrink-0 pt-0.5 text-xs font-medium text-stone-500">✓ Imported</span>
      ) : row.state === "saving" ? (
        <span className="shrink-0 pt-0.5 text-xs text-stone-400">Saving…</span>
      ) : (
        can && (
          <select
            aria-label={`Category for ${row.name}`}
            value={row.category}
            disabled={disabled}
            onChange={(e) => onChange({ category: e.target.value as Category })}
            className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-700"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {emojiFor(c)} {c}
              </option>
            ))}
          </select>
        )
      )}
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
async function save(r: Row): Promise<boolean> {
  if (!r.match) return false;
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.match.name)}&query_place_id=${r.match.placeId}`;
  try {
    const res = await api("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramUrl: link, placeId: r.match.placeId, category: r.category }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
