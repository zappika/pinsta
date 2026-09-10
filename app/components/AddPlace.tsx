"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeInstagramUrl } from "@/lib/instagram";
import type { Place, PlaceCandidate } from "./types";

type Props = {
  onClose: () => void;
  onSaved: (place: Place) => void;
};

type PostInfo = {
  url: string;
  caption: string | null;
  locationName: string | null;
  imageUrl: string | null;
  ownerUsername: string | null;
};

type Extract =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; post: PostInfo }
  | { status: "error"; message: string };

export default function AddPlace({ onClose, onSaved }: Props) {
  const [url, setUrl] = useState("");
  const [extract, setExtract] = useState<Extract>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  const validUrl = normalizeInstagramUrl(url);
  const urlTouched = url.trim().length > 0;
  const post = extract.status === "done" ? extract.post : null;

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  // As soon as the link is valid, read the post: thumbnail + location tag → candidates.
  useEffect(() => {
    if (!validUrl) {
      setExtract({ status: "idle" });
      setCandidates([]);
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
          body: JSON.stringify({ instagramUrl: validUrl }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as {
          post?: PostInfo;
          candidates?: PlaceCandidate[];
          error?: string;
        };
        if (!res.ok || !data.post) throw new Error(data.error ?? "Could not read post");
        setExtract({ status: "done", post: data.post });
        setCandidates(data.candidates ?? []);
        if (!data.candidates?.length) queryRef.current?.focus();
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

  async function save(c: PlaceCandidate) {
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
          imageUrl: post?.imageUrl ?? null,
          caption: post?.caption ?? null,
          igLocationName: post?.locationName ?? null,
          ownerUsername: post?.ownerUsername ?? null,
        }),
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

  const showTaggedFirst =
    candidates.length > 0 && !!post?.locationName && query.trim().length < 2;

  const manualMode =
    extract.status === "error" || (extract.status === "done" && !extract.post.locationName);

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
            <p className="mt-1.5 text-xs text-red-600">Needs to be an Instagram post or reel link.</p>
          )}
        </label>

        {extract.status === "loading" && (
          <div className="mt-4 overflow-hidden rounded-2xl bg-white">
            <div className="aspect-[4/3] w-full animate-pulse bg-stone-100" />
            <div className="space-y-2 px-4 py-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-stone-100" />
              <p className="text-xs text-stone-400">Reading post…</p>
            </div>
          </div>
        )}

        {post && <PostPreview post={post} />}

        {extract.status === "error" && (
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-stone-600">
            Couldn&apos;t read that post ({extract.message}). Type the place below.
          </p>
        )}

        {showTaggedFirst && (
          <>
            <p className="mt-4 mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
              Tagged “{post?.locationName}” — tap to save
            </p>
            <CandidateList candidates={candidates} saving={saving} onPick={save} />
          </>
        )}

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
            {post?.locationName && !manualMode ? "Not the right place? Search" : "Which place is it?"}
          </span>
          <input
            ref={queryRef}
            type="search"
            enterKeyHint="search"
            autoCorrect="off"
            placeholder={
              extract.status === "loading"
                ? "One moment…"
                : manualMode
                  ? "e.g. Septime Paris"
                  : "Search a different place"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!validUrl || extract.status === "loading"}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base outline-none placeholder:text-stone-400 focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {!showTaggedFirst && <CandidateList candidates={candidates} saving={saving} onPick={save} />}

        {searching && candidates.length === 0 && (
          <p className="mt-4 text-center text-sm text-stone-400">Searching…</p>
        )}
        {!searching && query.trim().length >= 2 && candidates.length === 0 && !error && (
          <p className="mt-4 text-center text-sm text-stone-400">No matches. Try adding the city.</p>
        )}
        {manualMode && extract.status === "done" && query.trim().length < 2 && (
          <p className="mt-4 text-center text-sm text-stone-400">
            No location tag on this post — type the place name.
          </p>
        )}
      </div>
    </div>
  );
}

function PostPreview({ post }: { post: PostInfo }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-white">
      {post.imageUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt=""
            className="aspect-[4/3] w-full bg-stone-100 object-cover"
          />
          {post.ownerUsername && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              @{post.ownerUsername}
            </span>
          )}
        </div>
      ) : (
        post.ownerUsername && (
          <p className="px-4 pt-3 text-xs font-medium text-stone-500">@{post.ownerUsername}</p>
        )
      )}
      {post.caption && (
        <div className="px-4 py-3">
          <p className="line-clamp-2 text-sm leading-snug text-stone-600">{post.caption}</p>
        </div>
      )}
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
  const dupes = new Set(
    candidates.map(keyOf).filter((k, i, arr) => arr.indexOf(k) !== i),
  );

  return (
    <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
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
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-stone-50 disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline font-medium">
                  <span className="truncate">{c.name}</span>
                  {where && (
                    <span className="shrink-0 font-normal text-stone-400">&nbsp;— {where}</span>
                  )}
                </p>
                {tieBreak && (
                  <p className="mt-0.5 truncate text-xs text-stone-400">{tieBreak}</p>
                )}
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
