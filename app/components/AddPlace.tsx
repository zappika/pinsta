"use client";

import { useEffect, useRef, useState } from "react";
import { parseSourceUrl, SOURCE_LABEL, type SourceKind } from "@/lib/sources";
import { api } from "@/lib/api";
import { iconFor, tintFor } from "@/lib/categories";
import { milestoneFor } from "@/lib/milestone";
import type { Place, PlaceCandidate } from "./types";
// Type only: nothing of the server route reaches the client bundle.
import type { ExtractResponse } from "@/app/api/extract/route";

type Props = {
  places: Place[];
  /** Re-selecting the place behind an existing card: no link step, straight to search. */
  editing?: Place | null;
  onUpdated?: (place: Place) => void;
  onClose: () => void;
  /** The place is in the list from this moment; the sheet becomes the success card. */
  onSaved: (place: Place) => void;
};

// What the sheet uses of /api/extract's post; edit mode builds one from a saved card, without kind.
type PostInfo = Pick<ExtractResponse["post"], "url" | "caption" | "locationName" | "imageUrl" | "ownerUsername"> &
  Partial<Pick<ExtractResponse["post"], "kind">>;

type Source = ExtractResponse["source"];

type Extract =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; post: PostInfo; source: Source }
  | { status: "error"; message: string };

type Saved = { place: Place; already: boolean; changed?: boolean; merged?: boolean; milestone?: string | null };

/**
 * A small sheet at the bottom, sized like the "Where" picker. Paste a link →
 * the post is read → the tag becomes a place. One match saves itself; several
 * ask for a tap; none hands over to search.
 */
export default function AddPlace({ places, editing = null, onUpdated, onClose, onSaved }: Props) {
  const [url, setUrl] = useState(editing?.instagramUrl ?? "");
  const [extract, setExtract] = useState<Extract>(
    editing
      ? {
          status: "done",
          source: null,
          post: {
            url: editing.instagramUrl,
            caption: editing.caption,
            locationName: editing.igLocationName,
            imageUrl: editing.imageUrl,
            ownerUsername: editing.ownerUsername,
          },
        }
      : { status: "idle" },
  );
  const [query, setQuery] = useState(editing?.igLocationName ?? editing?.name ?? "");
  /** From the post (tag, account or link). Kept apart from search results so they come back. */
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [results, setResults] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  const source0 = parseSourceUrl(url);
  const validUrl = source0?.url ?? null;
  const urlTouched = url.trim().length > 0;
  const post = extract.status === "done" ? extract.post : null;

  useEffect(() => {
    (editing ? queryRef : urlRef).current?.focus();
  }, [editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Link valid → read the post → tag → candidates → (one match) save.
  useEffect(() => {
    if (editing) return; // the post is known; only the place changes
    if (!validUrl) {
      setExtract({ status: "idle" });
      setCandidates([]);
      return;
    }
    const existing = places.find((p) => p.instagramUrl === validUrl || p.posts?.some((x) => x.instagramUrl === validUrl));
    if (existing) {
      setSaved({ place: existing, already: true });
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
        const res = await api("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instagramUrl: validUrl,
            cityHints: [...new Set(places.map((p) => p.city).filter(Boolean))],
          }),
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
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
        if (found.length === 1 && (data.source === "tag" || data.source === "link")) {
          void save(found[0], data.post);
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

  // Manual search (debounced) — shown instead of the extracted candidates while
  // there is a query; clearing it brings those back.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearching(false);
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    // Already "searching" during the debounce, so "No matches" doesn't flash first.
    setSearching(true);
    const t = setTimeout(async () => {
      setError(null);
      try {
        const res = await api("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => ({}))) as { candidates?: PlaceCandidate[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.candidates ?? []);
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

  // The success card closes itself (or on a tap).
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(onClose, SAVED_MS);
    return () => clearTimeout(t);
  }, [saved, onClose]);

  async function save(c: PlaceCandidate, p: PostInfo | null = post) {
    if (!validUrl || saving) return;
    setSaving(c.placeId);
    setError(null);
    try {
      if (editing) {
        const res = await api(`/api/places/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId: c.placeId }),
        });
        const data = (await res.json().catch(() => ({}))) as { place?: Place; error?: string };
        if (!res.ok || !data.place) throw new Error(data.error ?? "Could not change place");
        onUpdated?.(data.place);
        setSaved({ place: data.place, already: false, changed: true });
        return;
      }
      const res = await api("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramUrl: p?.url ?? validUrl,
          placeId: c.placeId,
          imageUrl: p?.imageUrl ?? null,
          caption: p?.caption ?? null,
          igLocationName: p?.locationName ?? null,
          ownerUsername: p?.ownerUsername ?? null,
          // The read just failed: the server shouldn't pay for another one to find a photo.
          postUnreadable: extract.status === "error",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { place?: Place; merged?: boolean; already?: boolean; error?: string };
      if (!res.ok || !data.place) throw new Error(data.error ?? "Could not save");
      if (data.merged) onUpdated?.(data.place);
      else if (!data.already) onSaved(data.place);
      const fresh = !data.already && !data.merged;
      setSaved({ place: data.place, already: !!data.already, merged: !!data.merged, milestone: fresh ? milestoneFor(data.place, places) : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
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

  const source = extract.status === "done" ? extract.source : null;
  const searchActive = query.trim().length >= 2;
  const showTaggedFirst = candidates.length > 0 && source !== null && !searchActive;
  const listed = searchActive ? results : candidates;
  const manualMode =
    extract.status === "error" || (extract.status === "done" && extract.source === null);
  // The sheet's question lives in its small label (Sarp, 2026-10-09): no headings.
  const label = editing ? "Change place"
    : !validUrl ? "Save a place"
    : extract.status === "loading" ? "Finding the place…"
    : saving ? "Saving…"
    : showTaggedFirst ? (candidates.length === 1 ? "Is this the place?" : "Is it one of these?")
    : "Which place is it?";

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Save a place">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      {/* Fixed height: the sheet never resizes as the post, candidates or receipt come in.
          Sits above the + (which becomes ×) and rises out of it. */}
      {saved ? (
        <SavedCard saved={saved} onDone={onClose} />
      ) : (
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+5.25rem)] flex h-[340px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {(
          <>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
              <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
                Cancel
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {!editing && (
              <div className="flex gap-2">
                <input
                  ref={urlRef}
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Paste an Instagram, TikTok or Maps link"
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
              )}
              {!editing && urlTouched && !validUrl && (
                <p className="mt-1.5 text-xs text-red-600">Needs to be an Instagram post, a TikTok video, or a Google Maps place.</p>
              )}

              {extract.status === "loading" && (
                <div className="mt-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-stone-100" />
                    <p className="text-sm text-stone-500">{({ instagram: "Instagram post", tiktok: "TikTok video", google: "Google Maps link" } as Record<SourceKind, string>)[parseSourceUrl(validUrl ?? "")?.kind ?? "instagram"]}</p>
                  </div>
                  <LoadingBar />
                </div>
              )}

              {post && <PostRow post={post} category={candidates[0]?.category ?? null} />}

              {extract.status === "error" && (
                <p className="mt-3 text-sm text-stone-500">Couldn&apos;t read that post. Type the place&apos;s name to save it.</p>
              )}
              {!editing && manualMode && extract.status === "done" && !searchActive && (
                <p className="mt-3 text-sm text-stone-500">No location on this post. Type the place&apos;s name to save it.</p>
              )}

              {saving && showTaggedFirst && candidates.length === 1 && (
                <p className="mt-3 text-sm text-stone-500">Saving {candidates[0].name}…</p>
              )}

              {showTaggedFirst && !(saving && candidates.length === 1) && (
                <CandidateList candidates={candidates} saving={saving} onPick={(c) => save(c)} />
              )}


              {error && <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

              {!showTaggedFirst && <CandidateList candidates={listed} saving={saving} onPick={(c) => save(c)} />}

              {searching && listed.length === 0 && (
                <p className="mt-3 text-center text-sm text-stone-400">Searching…</p>
              )}
              {!searching && searchActive && results.length === 0 && !error && (
                <p className="mt-3 text-center text-sm text-stone-400">No matches. Try adding the city.</p>
              )}
            </div>
            {/* The search sits pinned under the list, never below the scroll (Sarp, 2026-10-09). */}
            <div className="px-4 pb-4 empty:hidden">
              {validUrl && extract.status !== "loading" && extract.status !== "idle" && !saving && (
                <input
                  ref={queryRef}
                  type="search"
                  enterKeyHint="search"
                  autoCorrect="off"
                  placeholder={editing ? "Search the right place" : manualMode ? "Place name, e.g. Septime Paris" : "Search for another place"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-base outline-none placeholder:text-stone-400 focus:border-stone-400"
                />
              )}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}

const SAVED_MS = 2600;
// The bar waits for the card to settle, then starts slow: a timer from the first frame felt stressful (Sarp).
const BAR_DELAY_MS = 500;

/**
 * One card for every save (Sarp, 2026-10-09): the post photo with the place's name and
 * type · town over it, "Saved to Vicolo" with the elephant, and a milestone line above the
 * name when there is one. No photo → the type icon on its tint. Tap or wait to close.
 * Mirrors SavedCard in the iOS AddPlaceView.
 */
function SavedCard({ saved, onDone }: { saved: Saved; onDone: () => void }) {
  const { place, already, changed, merged, milestone } = saved;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(a);
  }, []);
  const photo = place.imageUrl;
  const badge = already ? "Already in Vicolo" : changed ? "Changed" : "Saved to Vicolo";
  const line = merged ? "Another post for this place" : milestone ?? null;
  const town = place.city ?? place.country;
  return (
    <button type="button" onClick={onDone}
      className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+5.25rem)] block overflow-hidden rounded-2xl text-left shadow-xl">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="block aspect-[4/5] max-h-[60dvh] w-full bg-stone-200 object-cover" />
      ) : (
        <div className="flex aspect-[4/5] max-h-[60dvh] w-full items-center justify-center pb-24" style={{ backgroundColor: tintFor(place.category) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconFor(place.category)} alt="" className="h-40 w-40 object-contain" />
        </div>
      )}
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-[#fffdf8]/85 py-1 pl-1 pr-3 backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/elephant-resin.png" alt="" className="h-7 w-7" />
        <span className="text-sm font-semibold text-[#1f1c1a]">{badge}</span>
      </div>
      <div className={`absolute inset-x-0 bottom-0 px-5 pb-6 pt-20 ${photo ? "bg-gradient-to-t from-black/75 via-black/35 to-transparent text-[#fffdf8]" : "text-[#1f1c1a]"}`}>
        {line && <p className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-80">{line}</p>}
        <p className="text-[28px] font-semibold leading-tight tracking-tight">{place.name}</p>
        <p className="mt-0.5 text-base opacity-80">{[place.category, town].filter(Boolean).join(" · ")}</p>
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-1 ${photo ? "bg-white/10" : "bg-black/5"}`}>
        <div className={`h-full ${photo ? "bg-white/50" : "bg-black/25"}`}
          style={{ width: shown ? "100%" : "0%", transition: `width ${SAVED_MS - BAR_DELAY_MS}ms cubic-bezier(.45,0,.8,1) ${BAR_DELAY_MS}ms` }} />
      </div>
    </button>
  );
}

function PostRow({ post, category }: { post: PostInfo; category: string | null }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-stone-100 object-cover" />
      ) : category ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tintFor(category) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconFor(category)} alt="" className="h-9 w-9 object-contain" />
        </div>
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-lg bg-stone-100" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-stone-500">
          {[post.kind && post.kind !== "instagram" ? SOURCE_LABEL[post.kind] : null, post.ownerUsername ? `@${post.ownerUsername}` : null].filter(Boolean).join(" · ")}
        </p>
        {(post.caption ?? (post.kind === "google" ? post.locationName : null)) && (
          <p className="truncate text-sm text-stone-600">{post.caption ?? post.locationName}</p>
        )}
      </div>
    </div>
  );
}

/**
 * One way to pick a place everywhere (tag, account guesses, search): the whole row saves,
 * the Save pill says so. "Type · City" under the name. Country appears only when the list spans
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
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-sm text-stone-500">{[c.category, where].filter(Boolean).join(" · ")}</p>
                {tieBreak && <p className="mt-0.5 truncate text-xs text-stone-400">{tieBreak}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">
                {busy ? "Saving…" : "Save"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Reading a post takes 5–20 s (Apify). One quiet line in the label ("Finding the place…")
 * and a bar that keeps creeping (to 70%) — the steps made it look like work to watch
 * (Sarp, 2026-10-09). Mirrors LoadingBar in the iOS AddPlaceView.
 */
function LoadingBar() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setT((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, []);
  const value = 0.7 * (1 - Math.exp(-t / 6));
  return (
    <div className="mt-4 h-1 overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-stone-400 transition-[width] duration-100 ease-linear" style={{ width: `${value * 100}%` }} />
    </div>
  );
}
