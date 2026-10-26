"use client";

import { useRef, useState } from "react";
import { CATEGORIES, placeIcon, priceLabel, tintFor } from "@/lib/categories";
import { googleMapsUrl, appleMapsUrl } from "@/lib/maps";
import { typeLabel } from "@/lib/subtypes";
import { countLabel, walkDirectionsUrl, walkLine, type SendKind, type SendStop } from "@/lib/sends";
import ElephantMark from "./ElephantMark";
import SendMap from "./SendMap";

type Props = { kind: SendKind; title: string; from: string | null; stops: SendStop[] };

/**
 * What a friend sees when they open a sent link (Sarp, 2026-10-26). No app, no account: the map,
 * the stops with the sender's notes, the walk in Google Maps, and a way into Vicolo.
 * A walk is numbered and in order; a list is grouped by type.
 */
export default function SendPage({ kind, title, from, stops }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [getting, setGetting] = useState(false);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const walk = kind === "walk";

  const meta = [
    from ? `from ${from}` : null,
    countLabel(kind, stops.length),
    walk && stops.length > 1 ? walkLine(stops) : null,
  ].filter(Boolean).join(" · ");

  // A list reads by type ("Restaurants", "Bars"); a walk keeps its order.
  const groups: { label: string | null; items: { s: SendStop; i: number }[] }[] = walk
    ? [{ label: null, items: stops.map((s, i) => ({ s, i })) }]
    : groupByCategory(stops);

  function pick(i: number | null) {
    setSelected(i);
    if (i !== null) rows.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <header className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900">{title}</h1>
        <p className="mt-1.5 text-sm text-stone-500">{meta}</p>
      </header>

      <div className="mx-4 h-[46vh] min-h-[280px] overflow-hidden rounded-3xl bg-stone-200">
        <SendMap kind={kind} stops={stops} selected={selected} onSelect={pick} />
      </div>

      {groups.map((g) => (
        <section key={g.label ?? "walk"} className="mt-5">
          {g.label && <h2 className="px-5 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{g.label}</h2>}
          <ol>
            {g.items.map(({ s, i }) => (
              <li key={i} ref={(el) => { rows.current[i] = el; }}>
                <button
                  type="button"
                  onClick={() => pick(selected === i ? null : i)}
                  className={`flex w-full items-start gap-4 px-5 py-3 text-left transition-colors ${selected === i ? "bg-stone-200/60" : "active:bg-stone-200/40"}`}
                >
                  <div className="relative shrink-0">
                    <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl" style={{ backgroundColor: tintFor(s.category) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.imageUrl ?? placeIcon({ category: s.category, primaryType: s.primaryType, name: s.name })}
                        alt=""
                        loading="lazy"
                        className={s.imageUrl ? "h-full w-full object-cover" : "h-full w-full object-contain p-3"}
                      />
                    </div>
                    {walk && (
                      <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white ring-2 ring-stone-100">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[17px] font-semibold leading-snug text-stone-900">{s.name}</p>
                    <p className="mt-0.5 truncate text-sm text-stone-500">
                      {[s.primaryType ? typeLabel(s.primaryType) : s.category, priceLabel(s.priceLevel), s.city].filter(Boolean).join(" · ")}
                    </p>
                    {s.note && <p className="mt-1.5 text-[15px] leading-snug text-stone-700">“{s.note}”</p>}
                    {selected === i && (
                      <a
                        href={s.placeId ? googleMapsUrl(s.name, s.placeId) : appleMapsUrl(s.name, s.lat, s.lng)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 inline-flex min-h-9 items-center rounded-full bg-white px-3.5 text-sm font-medium text-stone-900 shadow-sm ring-1 ring-black/5"
                      >
                        Open in Maps
                      </a>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-stone-400">
        <ElephantMark size={16} />
        Sent with Vicolo
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md bg-gradient-to-t from-stone-100 via-stone-100/95 to-transparent px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6">
        <div className="flex gap-2">
          {walk && stops.length > 1 && (
            <a
              href={walkDirectionsUrl(stops)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-stone-900 px-4 text-[15px] font-semibold text-white active:opacity-80"
            >
              Walk it in Google Maps
            </a>
          )}
          <button
            type="button"
            onClick={() => setGetting(true)}
            className={`flex min-h-12 items-center justify-center rounded-full px-4 text-[15px] font-semibold active:opacity-80 ${
              walk ? "bg-white text-stone-900 shadow-sm ring-1 ring-black/5" : "flex-1 bg-stone-900 text-white"
            }`}
          >
            {walk ? "Save" : "Save these to Vicolo"}
          </button>
        </div>
      </div>

      {getting && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-stone-900/30" onClick={() => setGetting(false)}>
          <div className="pinsta-rise w-full max-w-md rounded-t-3xl bg-white px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold text-stone-900">Keep these in Vicolo</p>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              Vicolo saves the places you find (from Instagram, TikTok, Google Maps, or a friend) on your own map. It’s on iPhone, in beta
              {from ? `: ask ${from} for an invite.` : "."}
            </p>
            <a href="/" className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-stone-900 text-[15px] font-semibold text-white">
              What’s Vicolo?
            </a>
            <button type="button" onClick={() => setGetting(false)} className="mt-2 flex min-h-11 w-full items-center justify-center text-[15px] font-medium text-stone-500">
              Not now
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function groupByCategory(stops: SendStop[]) {
  const by = new Map<string, { s: SendStop; i: number }[]>();
  stops.forEach((s, i) => {
    const c = s.category ?? "Other";
    by.set(c, [...(by.get(c) ?? []), { s, i }]);
  });
  const order = (c: string) => {
    const k = CATEGORIES.indexOf(c as (typeof CATEGORIES)[number]);
    return k < 0 ? 99 : k;
  };
  const groups = [...by].sort((a, b) => order(a[0]) - order(b[0]));
  // One type only ("my Helsinki restaurants"): the title already says it.
  if (groups.length === 1) return [{ label: null, items: groups[0][1] }];
  return groups.map(([c, items]) => ({ label: plural(c), items }));
}

function plural(category: string) {
  if (category === "Nature" || category === "Culture" || category === "Other") return category;
  return category.endsWith("y") ? `${category.slice(0, -1)}ies` : `${category}s`;
}
