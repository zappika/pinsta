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
type Visit = "want" | "been";

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
  const [visit, setVisit] = useState<Visit | null>(null);

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
  const setAll = (change: (r: Row) => Partial<Row>) =>
    setPreview((p) => p && { ...p, rows: p.rows.map((r) => (importable(r) && r.state === "idle" ? { ...r, ...change(r) } : r)) });

  const picked = useMemo(() => preview?.rows.filter((r) => r.picked && r.state !== "saved") ?? [], [preview]);
  const savedCount = preview?.rows.filter((r) => r.state === "saved").length ?? 0;

  async function runImport() {
    if (!preview || importing || !visit) return;
    setImporting(true);
    // Two at a time: each save is a Google details call plus a photo.
    const queue = [...picked];
    await Promise.all(
      [0, 1].map(async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          update(r.key, { state: "saving" });
          const ok = await save(r, { title: preview.title, owner: preview.owner }, visit === "been");
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
      <a href="/app" className="text-sm font-medium text-stone-500 active:text-stone-700">
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
        {!url && (
          <button type="button" onClick={paste} className="shrink-0 rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-700 active:bg-stone-50">
            Paste
          </button>
        )}
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

          {groups(preview.rows).map((g) => (
            <Group
              key={g.id}
              group={g}
              disabled={importing}
              onRow={update}
              onGroup={(change) => g.rows.forEach((r) => r.state === "idle" && update(r.key, change))}
            />
          ))}
        </>
      )}

      {preview && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          {picked.length === 0 && savedCount > 0 && !importing ? (
            <a href="/app" className="block rounded-2xl bg-stone-900 py-3.5 text-center text-sm font-semibold text-white shadow-lg active:bg-stone-800">
              Done · see {count(savedCount, "place")} in your list
            </a>
          ) : (
            <div className="flex gap-2">
              <VisitPick value={visit} disabled={importing} onChange={setVisit} />
              <button
                type="button"
                disabled={picked.length === 0 || importing || !visit}
                onClick={runImport}
                className="min-w-0 flex-1 rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white shadow-lg active:bg-stone-800 disabled:opacity-40"
              >
                {importing ? `Importing… ${savedCount} done`
                  : picked.length === 0 ? "Nothing selected"
                  : !visit ? "Want to go or been there?"
                  : `Import ${count(picked.length, "place")}`}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

/**
 * Want to go or Been there for the whole import, icons only (Sarp, 2026-10-11): a bookmark
 * and a check. Nothing is picked at first, so the import asks.
 */
function VisitPick({ value, disabled, onChange }: { value: Visit | null; disabled: boolean; onChange: (v: Visit) => void }) {
  const option = (v: Visit, label: string, path: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === v}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(v)}
      className={`flex w-12 items-center justify-center rounded-xl ${value === v ? "bg-stone-900 text-white" : "text-stone-500 active:bg-stone-100"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={path} />
      </svg>
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Import as" className="flex shrink-0 gap-1 rounded-2xl bg-white p-1 shadow-lg">
      {option("want", "Want to go", "M6 4h12v16l-6-4-6 4z")}
      {option("been", "Been there", "M5 12.5l4.5 4.5L19 7")}
    </div>
  );
}

type GroupT = { id: string; title: string; category: Category | null; rows: Row[] };

/**
 * The review, sorted the way a list is usually made ("Paris", "Tokyo bars"):
 * one section per category, in the app's category order, then what can't be
 * imported. A place imported just now stays where it was, marked done.
 */
function groups(rows: Row[]): GroupT[] {
  const byCategory = CATEGORIES.map((c) => ({
    id: c,
    title: c,
    category: c as Category,
    rows: rows.filter((r) => importable(r) && r.category === c),
  }));
  return [
    ...byCategory,
    { id: "saved", title: "Already in your list", category: null, rows: rows.filter((r) => r.savedId) },
    { id: "missing", title: "Google couldn’t find these", category: null, rows: rows.filter((r) => !r.match && !r.savedId) },
  ].filter((g) => g.rows.length > 0);
}

function Group({ group, disabled, onRow, onGroup }: { group: GroupT; disabled: boolean; onRow: (key: number, c: Partial<Row>) => void; onGroup: (c: Partial<Row>) => void }) {
  const open = group.rows.filter((r) => r.state === "idle");
  const allPicked = open.length > 0 && open.every((r) => r.picked);
  return (
    <section className="mt-5">
      <div className="flex items-center gap-3 px-4 pb-1.5">
        {group.category && (
          <input
            type="checkbox"
            aria-label={`Import every ${group.category}`}
            checked={allPicked}
            disabled={disabled || open.length === 0}
            onChange={(e) => onGroup({ picked: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-stone-900"
          />
        )}
        {group.category && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconFor(group.category)} alt="" className="-my-1 h-7 w-7 shrink-0 object-contain" />
        )}
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {group.title} <span className="font-normal text-stone-400">· {group.rows.length}</span>
        </h3>
        {group.category && open.length > 0 && (
          <Move label="Move all" current={group.category} disabled={disabled} onMove={(c) => onGroup({ category: c })} />
        )}
      </div>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
        {group.rows.map((r) => (
          <ImportRow key={r.key} row={r} disabled={disabled} onChange={(c) => onRow(r.key, c)} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A quiet "Move" pill over a native select: the system's own picker opens
 * (the wheel on a phone), and the place lands in the chosen section.
 */
function Move({ label, current, disabled, onMove }: { label: string; current: Category; disabled: boolean; onMove: (c: Category) => void }) {
  return (
    <span className={`relative shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 ${disabled ? "opacity-40" : "active:bg-stone-200"}`}>
      {label}
      <select
        aria-label={label}
        value=""
        disabled={disabled}
        onChange={(e) => e.target.value && onMove(e.target.value as Category)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Move to…
        </option>
        {CATEGORIES.filter((c) => c !== current).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </span>
  );
}

function ImportRow({ row, disabled, onChange }: { row: Row; disabled: boolean; onChange: (c: Partial<Row>) => void }) {
  const can = importable(row) && row.state !== "saved";
  const where = row.match?.city ?? row.address;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {importable(row) && (
        <input
          type="checkbox"
          aria-label={`Import ${row.name}`}
          checked={row.picked && can}
          disabled={!can || disabled || row.state === "saving"}
          onChange={(e) => onChange({ picked: e.target.checked })}
          className="mt-1 h-4 w-4 shrink-0 accent-stone-900"
        />
      )}
      <div className={`min-w-0 flex-1 ${importable(row) ? "" : "opacity-60"}`}>
        <p className="truncate text-sm font-medium">{row.match?.name ?? row.name}</p>
        {where && <p className="truncate text-xs text-stone-500">{where}</p>}
        {row.note && <p className="mt-0.5 line-clamp-2 text-xs italic text-stone-500">“{row.note}”</p>}
        {row.state === "failed" && <p className="mt-0.5 text-xs font-medium text-red-600">Couldn&apos;t save. Try again.</p>}
      </div>
      {row.state === "saved" ? (
        <span className="shrink-0 pt-0.5 text-xs font-medium text-stone-500">✓ Imported</span>
      ) : row.state === "saving" ? (
        <span className="shrink-0 pt-0.5 text-xs text-stone-400">Saving…</span>
      ) : (
        can && <Move label="Move" current={row.category} disabled={disabled} onMove={(c) => onChange({ category: c })} />
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
