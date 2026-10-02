"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { directions } from "@/lib/directions";
import { sourceKind } from "@/lib/sources";
import { priceLabel } from "@/lib/categories";
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
  /** Given in the pull-up sheet: a ⋯ button offers Change place and Remove. */
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function PlaceCard({ place, hideCategory, hideCity, compact, expanded, onEdit, onDelete }: Props) {
  const [showPost, setShowPost] = useState(!!expanded);
  const [showMore, setShowMore] = useState(false);
  const allUrls = [place.instagramUrl, ...(place.posts ?? []).map((p) => p.instagramUrl)];
  // Google Maps links are the place, not a post: Directions covers them.
  const postUrls = allUrls.filter((u) => sourceKind(u) !== "google");
  const meta = [hideCategory ? null : place.category, priceLabel(place.priceLevel), hideCity ? null : place.city, postUrls.length > 1 ? `${postUrls.length} posts` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {place.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} className={`${compact ? "h-32" : expanded ? "h-72" : "h-44"} w-full bg-stone-100 object-cover`} />
      )}
      {/* Name and type on the left; two round actions on the right. No button row. */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{place.name}</h3>
          {meta && (
            <p className="mt-0.5 truncate text-sm text-stone-500">{meta}</p>
          )}
        </div>
        <RoundAction label="Directions" onClick={() => directions(place)}>
          <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3Z" />
        </RoundAction>
        {postUrls.length > 0 && <RoundAction label={showPost ? "Hide post" : "Post"} active={showPost} onClick={() => setShowPost((s) => !s)}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
        </RoundAction>}
        {(onEdit || onDelete) && <RoundAction label="Change or remove" active={showMore} onClick={() => setShowMore((s) => !s)}>
          <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </RoundAction>}
      </div>

      {showMore && (
        <div className="flex gap-2 px-4 pb-3.5">
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex-1 rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-stone-700 active:bg-stone-200">
              Change place
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-600 active:opacity-70">
              Remove
            </button>
          )}
        </div>
      )}

      {showPost && postUrls.map((u) => (sourceKind(u) === "tiktok" ? <TikTokEmbed key={u} url={u} /> : <InstagramEmbed key={u} url={u} />))}
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

/** TikTok's public embed.js — the same pattern as Instagram's. */
function TikTokEmbed({ url }: { url: string }) {
  const id = url.match(/video\/(\d+)/)?.[1];
  useEffect(() => {
    // embed.js renders every .tiktok-embed on load, so it is re-added per embed.
    const s = document.createElement("script");
    s.src = "https://www.tiktok.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
    return () => s.remove();
  }, [url]);
  return (
    <div className="border-t border-stone-100 bg-stone-50 p-2">
      <blockquote className="tiktok-embed !m-0 !max-w-full" cite={url} data-video-id={id}>
        <a href={url} target="_blank" rel="noreferrer" className="block p-3 text-sm text-stone-500">
          Open on TikTok
        </a>
      </blockquote>
    </div>
  );
}
