"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeInstagramUrl } from "@/lib/instagram";
import type { Place, PlaceCandidate } from "./types";

type Props = {
  places: Place[];
  onClose: () => void;
  /** The place is in the list from this moment; the sheet stays to show the receipt. */
  onSaved: (place: Place) => void;
  /** "Wrong place?" — the save is taken back. */
  onRemoved: (id: string) => void;
};

type PostInfo = {
  url: string;
  caption: string | null;
  locationName: string | null;
  imageUrl: string | null;
  ownerUsername: string | null;
};

type Source = "tag" | "account" | null;

type Extract =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; post: PostInfo; source: Source }
  | { status: "error"; message: string };

type Saved = { place: Place; automatic: boolean; already: boolean };

/**
 * A small sheet at the bottom, sized like the "Where" picker. Paste a link →
 * the post is read → the tag becomes a place. One match saves itself; several
 * ask for a tap; none hands over to search.
 */
export default function AddPlace({ places, onClose, onSaved, onRemoved }: Props) {
  const [url, setUrl] = useState("");
  const [extract, setExtract] = useState<Extract>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [autoSaveDeclined, setAutoSaveDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  const validUrl = normalizeInstagramUrl(url);
  const urlTouched = url.trim().length > 0;
  const post = extract.status === "done" ? extract.post : null;

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Link valid → read the post → tag → candidates → (one match) save.
  useEffect(() => {
    if (!validUrl) {
      setExtract({ status: "idle" });
      setCandidates([]);
      return;
    }
    const existing = places.find((p) => p.instagramUrl === validUrl);
    if (existing) {
      setSaved({ place: existing, automatic: false, already: true });
      return;
    }
    const ctrl = new AbortController();
    setExtract({ status: "loading" });
    setCandidates([]);
    setQuery("");
    setError(null);
    // Debounce: every prefix of a URL being typed is itself a "valid" link.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instagramUrl: validUrl,
            cityHints: [...new Set(places.map((p) => p.city).filter(Boolean))],
          }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          post?: PostInfo;
          candidates?: PlaceCandidate[];
          source?: Source;
          error?: string;
        };
        if (!res.ok || !data.post) throw new Error(data.error ?? "Could not read post");
        const found = data.candidates ?? [];
        setExtract({ status: "done", post: data.post, source: data.source ?? null });
        setCandidates(found);
        // Only a location tag is trusted enough to save without a tap.
        if (found.length === 1 && data.source === "tag" && !autoSaveDeclined) {
          void save(found[0], data.post, true);
        } else if (found.length === 0) {
          queryRef.current?.focus();
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setExtract({ status: "error", message: e instanceof Error ? e.message : "Could not read post" });
        queryRef.current?.focus();
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validUrl]);

  // Manual search (debounced) — overrides the extracted candidates while typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
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
        const data = (await res.json()) as { candidates?: PlaceCandidate[]; error?: string };
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

  // The receipt closes itself — unless it's telling you nothing new was saved.
  useEffect(() => {
    if (!saved || saved.already) return;
    const t = setTimeout(onClose, saved.automatic ? 3000 : 1500);
    return () => clearTimeout(t);
  }, [saved, onClose]);

  async function save(c: PlaceCandidate, p: PostInfo | null = post, automatic = false) {
    if (!validUrl || saving) return;
    setSaving(c.placeId);
    setError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramUrl: validUrl,
          placeId: c.placeId,
          imageUrl: p?.imageUrl ?? null,
          caption: p?.caption ?? null,
          igLocationName: p?.locationName ?? null,
          ownerUsername: p?.ownerUsername ?? null,
        }),
      });
      const data = (await res.json()) as { place?: Place; error?: string };
      if (!res.ok || !data.place) throw new Error(data.error ?? "Could not save");
      onSaved(data.place);
      setSaved({ place: data.place, automatic, already: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(null);
    }
  }

  async function undo() {
    if (!saved) return;
    const id = saved.place.id;
    setSaved(null);
    setAutoSaveDeclined(true);
    onRemoved(id);
    await fetch(`/api/places/${id}`, { method: "DELETE" }).catch(() => undefined);
    queryRef.current?.focus();
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      urlRef.current?.focus();
    }
  }

  const source = extract.status === "done" ? extract.source : null;
  const showTaggedFirst = candidates.length > 0 && source !== null && query.trim().length < 2;
  const manualMode =
    extract.status === "error" || (extract.status === "done" && extract.source === null);

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Save a place">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-white">
        {saved ? (
          <Receipt saved={saved} onUndo={undo} onDone={onClose} />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Save a place</p>
              <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
                Cancel
              </button>
            </div>

            <div className="overflow-y-auto px-4 pb-4">
              <div className="flex gap-2">
                <input
                  ref={urlRef}
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Paste an Instagram link"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={`min-w-0 flex-1 rounded-xl border bg-stone-50 px-3.5 py-2.5 text-base outline-none placeholder:text-stone-400 ${
                    urlTouched && !validUrl ? "border-red-300 focus:border-red-400" : "border-stone-200 focus:border-stone-400"
                  }`}
                />
                {!url && (
                  <button type="button" onClick={pasteFromClipboard} className="shrink-0 rounded-xl border border-stone-200 px-3.5 text-sm font-medium text-stone-700 active:bg-stone-50">
                    Paste
                  </button>
                )}
              </div>
              {urlTouched && !validUrl && (
                <p className="mt-1.5 text-xs text-red-600">Needs to be an Instagram post or reel link.</p>
              )}

              {extract.status === "loading" && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-stone-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-stone-100" />
                    <p className="text-xs text-stone-400">Reading post…</p>
                  </div>
                </div>
              )}

              {post && <PostRow post={post} />}

              {extract.status === "error" && (
                <p className="mt-3 text-sm text-stone-500">Couldn&apos;t read that post ({extract.message}). Type the place below.</p>
              )}

              {saving && showTaggedFirst && candidates.length === 1 && (
                <p className="mt-3 text-sm text-stone-500">Saving {candidates[0].name}…</p>
              )}

              {showTaggedFirst && !saving && (
                <>
                  <p className="mt-3 mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                    {source === "account"
                      ? `No location tag — is it @${post?.ownerUsername}'s place?`
                      : `Tagged “${post?.locationName}” — ${candidates.length > 1 ? "which one?" : "tap to save"}`}
                  </p>
                  <CandidateList candidates={candidates} saving={saving} onPick={(c) => save(c)} />
                </>
              )}

              {validUrl && extract.status !== "loading" && extract.status !== "idle" && !saving && (
                <input
                  ref={queryRef}
                  type="search"
                  enterKeyHint="search"
                  autoCorrect="off"
                  placeholder={manualMode ? "Which place is it? e.g. Septime Paris" : "Not the right place? Search"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-base outline-none placeholder:text-stone-400 focus:border-stone-400"
                />
              )}

              {error && <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

              {!showTaggedFirst && <CandidateList candidates={candidates} saving={saving} onPick={(c) => save(c)} />}

              {searching && candidates.length === 0 && (
                <p className="mt-3 text-center text-sm text-stone-400">Searching…</p>
              )}
              {!searching && query.trim().length >= 2 && candidates.length === 0 && !error && (
                <p className="mt-3 text-center text-sm text-stone-400">No matches. Try adding the city.</p>
              )}
              {manualMode && extract.status === "done" && query.trim().length < 2 && (
                <p className="mt-2 text-xs text-stone-400">No location tag on this post, and the account didn&apos;t match a place.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The moment after a save: what it is, where it went, and a way to say "not that one". */
function Receipt({ saved, onUndo, onDone }: { saved: Saved; onUndo: () => void; onDone: () => void }) {
  const { place, automatic, already } = saved;
  const where = [place.category, place.city ?? place.country].filter(Boolean).join(" · ");
  return (
    <div className="px-4 pt-3 pb-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{already ? "Already saved" : "Saved"}</p>
      <div className="mt-2 flex items-center gap-3">
        {place.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-stone-100 object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8.5l3.5 3.5L13 5" /></svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{place.name}</p>
          <p className="truncate text-sm text-stone-500">{where}</p>
        </div>
        {!already && (
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-600" aria-hidden>
            <path d="M3 8.5l3.5 3.5L13 5" />
          </svg>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {automatic && (
          <button type="button" onClick={onUndo} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 active:bg-stone-50">
            Wrong place?
          </button>
        )}
        <button type="button" onClick={onDone} className="flex-1 rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white active:bg-stone-800">
          Done
        </button>
      </div>
    </div>
  );
}

function PostRow({ post }: { post: PostInfo }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-stone-100 object-cover" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-lg bg-stone-100" />
      )}
      <div className="min-w-0 flex-1">
        {post.ownerUsername && <p className="truncate text-xs font-medium text-stone-500">@{post.ownerUsername}</p>}
        {post.caption && <p className="truncate text-sm text-stone-600">{post.caption}</p>}
      </div>
    </div>
  );
}

/**
 * Candidates read "Name — City". Country appears only when the list spans
 * countries; the street address only when two rows would otherwise be identical.
 */
function CandidateList({
  candidates,
  saving,
  onPick,
}: {
  candidates: PlaceCandidate[];
  saving: string | null;
  onPick: (c: PlaceCandidate) => void;
}) {
  if (candidates.length === 0) return null;
  const countries = new Set(candidates.map((c) => c.country).filter(Boolean));
  const multiCountry = countries.size > 1;
  const keyOf = (c: PlaceCandidate) => `${c.name}|${c.city}`.toLowerCase();
  const dupes = new Set(candidates.map(keyOf).filter((k, i, arr) => arr.indexOf(k) !== i));

  return (
    <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-100">
      {candidates.map((c) => {
        const busy = saving === c.placeId;
        const where = [c.city, multiCountry ? c.country : null].filter(Boolean).join(", ");
        const tieBreak = dupes.has(keyOf(c)) ? c.formattedAddress : null;
        return (
          <li key={c.placeId}>
            <button
              type="button"
              onClick={() => onPick(c)}
              disabled={saving !== null}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-stone-50 disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline font-medium">
                  <span className="truncate">{c.name}</span>
                  {where && <span className="shrink-0 font-normal text-stone-400">&nbsp;— {where}</span>}
                </p>
                {tieBreak && <p className="mt-0.5 truncate text-xs text-stone-400">{tieBreak}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {busy ? "Saving…" : c.category}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
