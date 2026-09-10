"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeInstagramUrl } from "@/lib/instagram";
import type { Place, PlaceCandidate } from "./types";

type Props = {
  onClose: () => void;
  onSaved: (place: Place) => void;
};

export default function AddPlace({ onClose, onSaved }: Props) {
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  const validUrl = normalizeInstagramUrl(url);
  const urlTouched = url.trim().length > 0;

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  // Jump to the place field once a valid link is in.
  useEffect(() => {
    if (validUrl) queryRef.current?.focus();
  }, [validUrl]);

  // Debounced place search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          candidates?: PlaceCandidate[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setCandidates(data.candidates ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Search failed");
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function save(c: PlaceCandidate) {
    if (!validUrl || saving) return;
    setSaving(c.placeId);
    setError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUrl: validUrl, placeId: c.placeId }),
      });
      const data = (await res.json()) as { place?: Place; error?: string };
      if (!res.ok || !data.place) throw new Error(data.error ?? "Could not save");
      onSaved(data.place);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(null);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      urlRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-md flex-col bg-stone-100">
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <h2 className="text-lg font-semibold">Save a place</h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 rounded-full px-3 py-1.5 text-sm font-medium text-stone-500 active:bg-stone-200"
        >
          Cancel
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
            Instagram post
          </span>
          <div className="flex gap-2">
            <input
              ref={urlRef}
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://www.instagram.com/p/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-base outline-none placeholder:text-stone-400 ${
                urlTouched && !validUrl
                  ? "border-red-300 focus:border-red-400"
                  : "border-stone-200 focus:border-stone-400"
              }`}
            />
            {!url && (
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="shrink-0 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 active:bg-stone-50"
              >
                Paste
              </button>
            )}
          </div>
          {urlTouched && !validUrl && (
            <p className="mt-1.5 text-xs text-red-600">
              Needs to be an Instagram post or reel link.
            </p>
          )}
        </label>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
            Which place is it?
          </span>
          <input
            ref={queryRef}
            type="search"
            enterKeyHint="search"
            autoCorrect="off"
            placeholder="e.g. Septime Paris"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!validUrl}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base outline-none placeholder:text-stone-400 focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white empty:hidden">
          {candidates.map((c) => {
            const busy = saving === c.placeId;
            return (
              <li key={c.placeId}>
                <button
                  type="button"
                  onClick={() => save(c)}
                  disabled={saving !== null}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-stone-50 disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="mt-0.5 truncate text-sm text-stone-500">
                      {c.formattedAddress}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {busy ? "Saving…" : c.category}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {searching && candidates.length === 0 && (
          <p className="mt-4 text-center text-sm text-stone-400">Searching…</p>
        )}
        {!searching && query.trim().length >= 2 && candidates.length === 0 && !error && (
          <p className="mt-4 text-center text-sm text-stone-400">No matches. Try adding the city.</p>
        )}
      </div>
    </div>
  );
}
