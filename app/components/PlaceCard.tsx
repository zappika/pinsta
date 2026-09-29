"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { directions } from "@/lib/directions";
import { dotFor } from "@/lib/categories";
import type { Place } from "./types";

type Props = {
  place: Place;
  /** Active filters: what the header already says isn't repeated on the card. */
  hideCategory?: boolean;
  hideCity?: boolean;
  /** Shorter photo — for the PeekCard floating over map or tiles. */
  compact?: boolean;
  /** The pull-up sheet at full height: big photo, posts already open. */
  expanded?: boolean;
};

export default function PlaceCard({ place, hideCategory, hideCity, compact, expanded }: Props) {
  const [showPost, setShowPost] = useState(!!expanded);
  const postUrls = [place.instagramUrl, ...(place.posts ?? []).map((p) => p.instagramUrl)];
  const meta = [hideCategory ? null : place.category, hideCity ? null : place.city, postUrls.length > 1 ? `${postUrls.length} posts` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {place.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrl} alt="" draggable={false} className={`${compact ? "h-32" : expanded ? "h-72" : "h-44"} w-full bg-stone-100 object-cover`} />
      )}
      {/* Name and type on the left; two round actions on the right. No button row. */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{place.name}</h3>
          {meta && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-stone-500">
              {!hideCategory && place.category && (
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotFor(place.category) }} />
              )}
              {meta}
            </p>
          )}
        </div>
        <RoundAction label="Directions" onClick={() => directions(place)}>
          <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3Z" />
        </RoundAction>
        <RoundAction label={showPost ? "Hide post" : "Post"} active={showPost} onClick={() => setShowPost((s) => !s)}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
        </RoundAction>
      </div>

      {showPost && postUrls.map((u) => <InstagramEmbed key={u} url={u} />)}
    </>
  );
}

/**
 * Instagram's public embed.js — no token needed. It scans for
 * `.instagram-media` blockquotes and swaps them for iframes.
 */
function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    const w = window as Window & { instgrm?: { Embeds: { process: () => void } } };
    if (w.instgrm) {
      w.instgrm.Embeds.process();
      return;
    }
    if (document.querySelector('script[src*="instagram.com/embed.js"]')) return;
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
  }, [url]);

  return (
    <div className="border-t border-stone-100 bg-stone-50 p-2">
      <blockquote
        className="instagram-media !m-0 !min-w-0 !max-w-full !rounded-xl !border-0 !shadow-none"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
      >
        <a href={url} target="_blank" rel="noreferrer" className="block p-3 text-sm text-stone-500">
          Open on Instagram
        </a>
      </blockquote>
    </div>
  );
}

function RoundAction({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 active:bg-stone-200"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
