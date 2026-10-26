"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { placeIcon, priceLabel, tintFor } from "@/lib/categories";
import { typeLabel } from "@/lib/subtypes";
import { WALK_MAX, countLabel, namesIn, shortestOrder, walkLine, type SendKind, type SendStop } from "@/lib/sends";
import type { Place, PlaceCandidate } from "./types";

/** A stop in the making: what goes out, plus what only this sheet needs. */
type Draft = SendStop & {
  key: string;
  /** The card in your list, when it's yours already. */
  savedId: string | null;
  /** What the name could also be ("Not this one?"). */
  others: PlaceCandidate[];
};

export type SendStart =
  /** + → Send to a friend: paste or type, a walk by default. */
  | { from: "paste" }
  /** "Send these" on a Where·What selection: your places, a list by default. */
  | { from: "selection"; places: Place[]; title: string };

type Props = {
  start: SendStart;
  places: Place[];
  /** Where to look for a pasted name when the text names no city (the Where row, else nothing). */
  near: string | null;
  here: { lat: number; lng: number } | null;
  onClose: () => void;
  onSaved: (p: Place) => void;
};

const FROM_KEY = "vicolo.sendFrom";

/**
 * Send places to a friend (Sarp, 2026-10-26): paste a list (a ChatGPT answer, a message) or send a
 * Where·What selection, arrange it, get a link to `/w/<id>`. A copy: only what's here goes out.
 * After sending, "Keep any of these?" offers the stops not in your list yet: nothing is ticked,
 * so skipping keeps the send disposable.
 */
export default function SendSheet({ start, places, near, here, onClose, onSaved }: Props) {
  const [step, setStep] = useState<"add" | "arrange" | "sent">(start.from === "paste" ? "add" : "arrange");
  const [text, setText] = useState("");
  const [city, setCity] = useState(near ?? "");
  const [finding, setFinding] = useState<{ done: number; total: number } | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [stops, setStops] = useState<Draft[]>(() => (start.from === "selection" ? start.places.map(fromPlace) : []));
  const [kind, setKind] = useState<SendKind>(start.from === "paste" ? "walk" : "list");
  const [title, setTitle] = useState(start.from === "selection" ? start.title : "");
  const [titleTouched, setTitleTouched] = useState(false);
  const [from, setFrom] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; url: string } | null>(null);
  const [kept, setKept] = useState<Record<string, "want" | "been" | "saving">>({});
  const [copied, setCopied] = useState(false);

  // The name you sent with last time, once: on every render it wiped what was being typed.
  useEffect(() => {
    try {
      setFrom(localStorage.getItem(FROM_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // The title follows the stops until you type one: "4 stops in Berlin".
  useEffect(() => {
    if (titleTouched || start.from === "selection" || stops.length === 0) return;
    const town = mostCommon(stops.map((s) => s.city));
    setTitle(`${kind === "walk" ? `A walk` : countLabel("list", stops.length)}${town ? ` in ${town}` : ""}`);
  }, [stops, kind, titleTouched, start.from]);

  /** One name → its best match near the city, the rest kept as "Not this one?". */
  async function find(name: string): Promise<Draft | null> {
    const query = city.trim() ? `${name}, ${city.trim()}` : name;
    const res = await api("/api/places/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, near: city.trim() ? null : here }),
    }).catch(() => null);
    if (!res?.ok) return null;
    const { candidates } = (await res.json()) as { candidates: PlaceCandidate[] };
    if (!candidates.length) return null;
    return fromCandidate(candidates[0], candidates.slice(1));
  }

  function fromCandidate(c: PlaceCandidate, others: PlaceCandidate[]): Draft {
    const mine = places.find((p) => p.placeId === c.placeId);
    if (mine) return { ...fromPlace(mine), others };
    return {
      key: c.placeId,
      name: c.name,
      placeId: c.placeId,
      lat: c.lat,
      lng: c.lng,
      address: c.formattedAddress,
      city: c.city,
      category: c.category,
      primaryType: c.primaryType,
      priceLevel: c.priceLevel,
      imageUrl: null,
      note: null,
      savedId: null,
      others,
    };
  }

  async function findAll() {
    const names = namesIn(text);
    if (!names.length) return;
    setFinding({ done: 0, total: names.length });
    setMissed([]);
    const found: (Draft | null)[] = new Array(names.length).fill(null);
    let done = 0;
    // Three at a time: quick, and the pasted order is kept whatever answers first.
    const queue = names.map((n, i) => ({ n, i }));
    await Promise.all(
      [0, 1, 2].map(async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          found[job.i] = await find(job.n);
          setFinding({ done: ++done, total: names.length });
        }
      }),
    );
    const got = dedupe([...stops, ...found.filter((d): d is Draft => d !== null)]);
    setStops(got);
    setMissed(names.filter((_, i) => !found[i]));
    if (got.length > WALK_MAX) setKind("list");
    setFinding(null);
    if (got.length) setStep("arrange");
  }

  async function addOne() {
    const name = adding.trim();
    if (!name) return;
    setAdding("");
    const d = await find(name);
    if (d) setStops((s) => dedupe([...s, d]));
    else setMissed((m) => [...m, name]);
  }

  const move = (i: number, by: number) =>
    setStops((s) => {
      const j = i + by;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const update = (key: string, patch: Partial<Draft>) => setStops((s) => s.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  async function send() {
    setSending(true);
    setError(null);
    try {
      localStorage.setItem(FROM_KEY, from.trim());
    } catch {}
    const res = await api("/api/sends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Only what goes out: no ids of your cards, no alternatives.
      body: JSON.stringify({
        kind,
        title: title.trim(),
        from: from.trim() || null,
        stops: stops.map(({ name, placeId, lat, lng, address, city, category, primaryType, priceLevel, imageUrl, note }) => ({
          name, placeId, lat, lng, address, city, category, primaryType, priceLevel, imageUrl, note,
        })),
      }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) return setError("Couldn't make the link. Try again.");
    const { id } = (await res.json()) as { id: string };
    setSent({ id, url: sendUrl(id) });
    setStep("sent");
  }

  async function share() {
    if (!sent) return;
    if (navigator.share) {
      await navigator.share({ title: title.trim(), url: sent.url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(sent.url).catch(() => undefined);
    setCopied(true);
  }

  async function keep(d: Draft, as: "want" | "been") {
    setKept((k) => ({ ...k, [d.key]: "saving" }));
    const res = await api("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instagramUrl: mapsLink(d), placeId: d.placeId, visited: as === "been" }),
    }).catch(() => null);
    if (!res?.ok) {
      setKept(({ [d.key]: _, ...k }) => k);
      return setError(`Couldn't save ${d.name}.`);
    }
    onSaved((await res.json()).place);
    setKept((k) => ({ ...k, [d.key]: as }));
  }

  const unsaved = stops.filter((s) => !s.savedId && s.placeId);
  const ready = stops.length > 0 && title.trim().length > 0;

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Send to a friend">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex max-h-[88dvh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            {step === "sent" ? "Sent" : "Send to a friend"}
          </p>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
            {step === "sent" ? "Done" : "Cancel"}
          </button>
        </div>

        {step === "add" && (
          <div className="px-4 pt-1 pb-4">
            <p className="text-lg font-semibold">Which places?</p>
            <p className="mt-0.5 text-sm text-stone-500">Paste a list, a message, or type them, one per line.</p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"1. A bakery you love\n2. That coffee place\n3. The gallery after"}
              className="mt-3 w-full resize-none rounded-xl bg-stone-100 px-3.5 py-3 text-[15px] leading-relaxed outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-stone-300"
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-xl bg-stone-100 px-3.5">
                <span className="text-sm text-stone-500">In</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City or area"
                  className="min-h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-400"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  const clip = await navigator.clipboard.readText().catch(() => "");
                  if (clip) setText((t) => (t ? t + "\n" : "") + clip);
                }}
                className="min-h-11 rounded-xl bg-stone-100 px-4 text-sm font-medium active:bg-stone-200"
              >
                Paste
              </button>
            </div>
            {missed.length > 0 && <p className="mt-3 text-sm text-stone-500">Couldn’t find {missed.join(", ")}.</p>}
            <button
              type="button"
              disabled={!namesIn(text).length || finding !== null}
              onClick={findAll}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-stone-900 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {finding ? `Finding ${finding.done} of ${finding.total}…` : namesIn(text).length ? `Find ${namesIn(text).length} places` : "Find them"}
            </button>
          </div>
        )}

        {step === "arrange" && (
          <>
            <div className="px-4 pt-1">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                aria-label="Title"
                className="w-full rounded-lg bg-transparent text-lg font-semibold outline-none focus:bg-stone-50"
              />
              <p className="text-sm text-stone-500">
                {countLabel(kind, stops.length)}
                {kind === "walk" && stops.length > 1 && ` · ${walkLine(stops)}`}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex rounded-full bg-stone-100 p-0.5 text-sm font-medium">
                  {(["walk", "list"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={k === "walk" && stops.length > WALK_MAX}
                      onClick={() => setKind(k)}
                      className={`min-h-9 whitespace-nowrap rounded-full px-3.5 disabled:opacity-40 ${kind === k ? "bg-white shadow-sm" : "text-stone-500"}`}
                    >
                      {k === "walk" ? "In order" : "Any order"}
                    </button>
                  ))}
                </div>
                {kind === "walk" && stops.length > 2 && (
                  <button type="button" onClick={() => setStops((s) => shortestOrder(s))} className="min-h-9 whitespace-nowrap rounded-full px-3 text-sm font-medium text-stone-600 active:bg-stone-100">
                    Shortest walk
                  </button>
                )}
              </div>
            </div>

            <ol className="mt-2 flex-1 divide-y divide-stone-100 overflow-y-auto overscroll-contain">
              {stops.map((d, i) => (
                <li key={d.key} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: tintFor(d.category) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.imageUrl ?? placeIcon({ category: d.category, primaryType: d.primaryType, name: d.name })} alt="" className={d.imageUrl ? "h-full w-full object-cover" : "h-full w-full object-contain p-2"} />
                      {kind === "walk" && (
                        <span className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[11px] font-semibold text-white">{i + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{d.name}</p>
                      <p className="truncate text-xs text-stone-500">
                        {[d.savedId ? "In your Vicolo" : null, d.primaryType ? typeLabel(d.primaryType) : d.category, priceLabel(d.priceLevel), d.address?.split(",")[0]].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {kind === "walk" && (
                      <div className="flex shrink-0 flex-col">
                        <button type="button" aria-label="Earlier" disabled={i === 0} onClick={() => move(i, -1)} className="h-6 w-8 text-stone-500 disabled:opacity-25">▲</button>
                        <button type="button" aria-label="Later" disabled={i === stops.length - 1} onClick={() => move(i, 1)} className="h-6 w-8 text-stone-500 disabled:opacity-25">▼</button>
                      </div>
                    )}
                    <button type="button" aria-label={`Remove ${d.name}`} onClick={() => setStops((s) => s.filter((x) => x.key !== d.key))} className="h-9 w-7 shrink-0 text-lg text-stone-400">×</button>
                  </div>
                  <div className="mt-1 flex min-w-0 gap-3 pl-[60px] text-xs font-medium text-stone-500">
                    {noteFor !== d.key && (
                      <button type="button" onClick={() => setNoteFor(d.key)} className="min-w-0 truncate py-1 text-left">{d.note ? `“${d.note}”` : "+ Note"}</button>
                    )}
                    {d.others.length > 0 && noteFor !== d.key && (
                      <button type="button" onClick={() => setSwapFor(swapFor === d.key ? null : d.key)} className="shrink-0 whitespace-nowrap py-1">Not this one?</button>
                    )}
                  </div>
                  {noteFor === d.key && (
                    <input
                      autoFocus
                      defaultValue={d.note ?? ""}
                      placeholder="Get the Spezial"
                      onBlur={(e) => {
                        update(d.key, { note: e.target.value.trim() || null });
                        setNoteFor(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="mt-1 ml-[60px] w-[calc(100%-60px)] rounded-lg bg-stone-100 px-3 py-2 text-sm outline-none"
                    />
                  )}
                  {swapFor === d.key && (
                    <ul className="mt-1 ml-[60px] rounded-xl bg-stone-50">
                      {d.others.map((c) => (
                        <li key={c.placeId}>
                          <button
                            type="button"
                            onClick={() => {
                              const next = fromCandidate(c, [...d.others.filter((o) => o.placeId !== c.placeId)]);
                              setStops((s) => s.map((x) => (x.key === d.key ? { ...next, note: d.note } : x)));
                              setSwapFor(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm"
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="block truncate text-xs text-stone-500">{c.formattedAddress}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              <li className="px-4 py-2.5">
                <input
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addOne()}
                  placeholder="Add a place"
                  className="min-h-10 w-full rounded-lg bg-stone-100 px-3 text-sm outline-none placeholder:text-stone-400"
                />
                {missed.length > 0 && <p className="mt-2 text-xs text-stone-500">Couldn’t find {missed.join(", ")}.</p>}
              </li>
            </ol>

            <div className="border-t border-stone-100 px-4 pt-3 pb-4">
              <label className="flex items-center gap-2 rounded-xl bg-stone-100 px-3.5">
                <span className="text-sm text-stone-500">From</span>
                <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Your name (optional)" className="min-h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-400" />
              </label>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <button
                type="button"
                disabled={!ready || sending}
                onClick={send}
                className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-stone-900 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {sending ? "Making the link…" : "Make the link"}
              </button>
              <p className="mt-2 text-center text-xs text-stone-400">Only these places and your notes go out, never your list.</p>
            </div>
          </>
        )}

        {step === "sent" && sent && (
          <div className="overflow-y-auto px-4 pt-1 pb-4">
            <p className="text-lg font-semibold">{title.trim()}</p>
            <p className="mt-0.5 truncate text-sm text-stone-500">{sent.url.replace(/^https?:\/\//, "")}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={share} className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-stone-900 text-[15px] font-semibold text-white">
                {copied ? "Link copied" : "Share link"}
              </button>
              <a href={sent.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-full bg-stone-100 px-5 text-[15px] font-semibold">
                See it
              </a>
            </div>

            {unsaved.length > 0 && (
              <>
                <p className="mt-6 text-sm font-semibold">Keep any of these?</p>
                <p className="text-xs text-stone-500">They’re not in your Vicolo. Skip, and the send stays just a send.</p>
                <ul className="mt-2 divide-y divide-stone-100">
                  {unsaved.map((d) => (
                    <li key={d.key} className="flex items-center gap-3 py-2.5">
                      <p className="min-w-0 flex-1 truncate text-[15px] font-medium">{d.name}</p>
                      {kept[d.key] === "want" || kept[d.key] === "been" ? (
                        <span className="text-sm text-stone-500">{kept[d.key] === "been" ? "Been there ✓" : "Want to go ✓"}</span>
                      ) : (
                        <div className="flex gap-1.5">
                          {(["been", "want"] as const).map((as) => (
                            <button
                              key={as}
                              type="button"
                              disabled={kept[d.key] === "saving"}
                              onClick={() => keep(d, as)}
                              className="min-h-9 rounded-full bg-stone-100 px-3 text-sm font-medium active:bg-stone-200 disabled:opacity-40"
                            >
                              {as === "been" ? "Been there" : "Want to go"}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fromPlace(p: Place): Draft {
  return {
    key: p.id,
    name: p.name,
    placeId: p.placeId,
    lat: p.lat,
    lng: p.lng,
    address: p.formattedAddress,
    city: p.city,
    category: p.category,
    primaryType: p.primaryType,
    priceLevel: p.priceLevel,
    imageUrl: p.imageUrl,
    note: null,
    savedId: p.id,
    others: [],
  };
}

/** The same place twice (pasted twice, or two names for it) is one stop. */
function dedupe(ds: Draft[]): Draft[] {
  const seen = new Set<string>();
  return ds.filter((d) => {
    const k = d.placeId ?? d.key;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function mostCommon(xs: (string | null)[]): string | null {
  const n = new Map<string, number>();
  for (const x of xs) if (x) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** The link as the friend gets it: the public site, not the owner's app host. */
export function sendUrl(id: string): string {
  const host = location.host === "app.vicolo.space" || location.host === "backoffice.vicolo.space" ? "https://www.vicolo.space" : location.origin;
  return `${host}/w/${id}`;
}

/** A place saved by name has no post: a Maps search link stands in (as in the save sheet). */
function mapsLink(d: Draft) {
  const u = new URL("https://www.google.com/maps/search/");
  u.searchParams.set("api", "1");
  u.searchParams.set("query", d.name);
  if (d.placeId) u.searchParams.set("query_place_id", d.placeId);
  return u.toString();
}
