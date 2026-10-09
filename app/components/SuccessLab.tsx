"use client";

// Design sandbox for the save flow and its success card (Sarp, 2026-10-09). Nothing here
// saves or reads data: it plays the flow over a fake Instagram post so it can be judged on
// the web before iOS gets the settled version.
//
// The flow starts where the user is: from Share the link is already known (no URL field),
// from + it asks for one. Then, by how sure we are:
//   Sure    — a location tag matching one place: saved straight away.
//   Likely  — a guess (the account's name): "Is this the place?" + Save [name].
//   No idea — "We couldn't tell which place this is": a Place name field, rows that each Save.
// Every save ends on one success card: the post photo, the place's name and type · town
// over it, "Saved to Vicolo" with the elephant, a milestone line above the name when there
// is one. Gone by itself after SHOW_MS, or on a tap.

import { useEffect, useState } from "react";

type Entry = "share" | "paste";
type Match = "sure" | "likely" | "none";
type Milestone = "none" | "city" | "category";
type Place = { name: string; type: string; area: string; city: string };
type Step = { at: "link" } | { at: "reading" } | { at: "likely" } | { at: "search"; query: string } | { at: "saved"; place: Place } | { at: "gone" };

const PHOTO = "/lab/post.jpg";
const POST = { account: "_casualbakery_", caption: "sixers the first of many. Pastrami, pickles, crispy onions" };
const GUESS: Place = { name: "Casual Bakery", type: "Bakery", area: "Davidshall", city: "Malmö" };
const DIRECTORY: Place[] = [
  GUESS,
  { name: "Casual Bakery & Coffee", type: "Cafe", area: "Lund C", city: "Lund" },
  { name: "Casa Bakery", type: "Bakery", area: "Möllevången", city: "Malmö" },
  { name: "Café Casual", type: "Cafe", area: "Norrmalm", city: "Stockholm" },
];
const PLURAL: Record<string, string> = { Bakery: "bakery", Cafe: "café" };
const READ_MS = 1800;
const SHOW_MS = 2600;
// The bar waits for the card to settle, then starts slow: a timer that runs from the first frame felt stressful (Sarp).
const BAR_DELAY_MS = 500;

export default function SuccessLab() {
  const [entry, setEntry] = useState<Entry>("share");
  const [match, setMatch] = useState<Match>("likely");
  const [milestone, setMilestone] = useState<Milestone>("city");
  const [run, setRun] = useState(0);
  const replay = () => setRun((r) => r + 1);

  return (
    <main className="min-h-dvh bg-stone-100 px-4 py-6 text-stone-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row md:items-start">
        <section className="flex flex-col gap-5 md:w-72">
          <h1 className="text-lg font-semibold">Save flow</h1>
          <Choice label="Opened from" value={entry} onChange={(v) => { setEntry(v); replay(); }}
            options={[["share", "Instagram Share"], ["paste", "+ in the app"]]} />
          <Choice label="What we find" value={match} onChange={(v) => { setMatch(v); replay(); }}
            options={[["sure", "Sure: location tag"], ["likely", "Likely: account guess"], ["none", "No idea"]]} />
          <Choice label="Milestone on the card" value={milestone} onChange={(v) => { setMilestone(v); replay(); }}
            options={[["none", "None"], ["city", "First in a city"], ["category", "First of a type"]]} />
          <button onClick={replay} className="rounded-xl bg-white py-2 text-sm font-medium">Replay</button>
        </section>

        <Phone>
          <Flow key={`${run}-${entry}-${match}-${milestone}`} entry={entry} match={match} milestone={milestone} />
        </Phone>
      </div>
    </main>
  );
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-stone-500">{label}</p>
      {options.map(([k, text]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`rounded-xl px-3 py-2 text-left text-sm font-medium ${value === k ? "bg-stone-900 text-white" : "bg-white text-stone-700"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** A phone-sized frame over a stand-in Instagram post, so the sheet is judged in place. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-[720px] w-[340px] shrink-0 overflow-hidden rounded-[44px] border-[10px] border-stone-900 bg-stone-300 shadow-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO} alt="" className="absolute inset-x-0 top-24 w-full" />
      <div className="absolute inset-0 bg-black/25" />
      {children}
    </div>
  );
}

function Flow({ entry, match, milestone }: { entry: Entry; match: Match; milestone: Milestone }) {
  const [step, setStep] = useState<Step>(entry === "paste" ? { at: "link" } : { at: "reading" });
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(a);
  }, []);

  useEffect(() => {
    if (step.at !== "reading") return;
    const t = setTimeout(() => setStep(match === "sure" ? { at: "saved", place: GUESS } : match === "likely" ? { at: "likely" } : { at: "search", query: "" }), READ_MS);
    return () => clearTimeout(t);
  }, [step.at, match]);

  if (step.at === "gone") return <p className="absolute inset-x-0 bottom-8 text-center text-xs text-white/80">Back to Instagram</p>;
  if (step.at === "saved") return <SavedCard place={step.place} milestone={milestone} onGone={() => setStep({ at: "gone" })} />;

  const save = (place: Place) => setStep({ at: "saved", place });
  const cancel = () => setStep({ at: "gone" });

  return (
    <div className={`absolute inset-x-3 bottom-3 rounded-[28px] bg-white px-4 pb-4 pt-4 shadow-2xl transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-[110%]"}`}>
      <div className="mb-3 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/elephant-resin.png" alt="" className="h-6 w-6" />
        <button onClick={cancel} className="text-sm font-medium text-stone-500">Cancel</button>
      </div>

      {step.at === "link" ? (
        <LinkStep onUse={() => setStep({ at: "reading" })} />
      ) : (
        <>
          <PostRow />
          {step.at === "reading" && <Reading />}
          {step.at === "likely" && <Likely onSave={() => save(GUESS)} onOther={() => setStep({ at: "search", query: GUESS.name })} />}
          {step.at === "search" && <Search initial={step.query} guessed={match === "likely"} onSave={save} />}
        </>
      )}
    </div>
  );
}

function LinkStep({ onUse }: { onUse: () => void }) {
  return (
    <div>
      <p className="text-base font-semibold">Save a place</p>
      <p className="mt-1 text-sm text-stone-500">Paste a link from Instagram, TikTok or Google Maps.</p>
      <div className="mt-3 rounded-xl bg-stone-100 px-3 py-2.5 text-sm text-stone-400">instagram.com/p/…</div>
      <button onClick={onUse} className="mt-3 w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white">Paste</button>
    </div>
  );
}

/** The post, small: context for the decision, not a thing to act on. */
function PostRow() {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-500">@{POST.account}</p>
        <p className="truncate text-sm text-stone-700">{POST.caption}</p>
      </div>
    </div>
  );
}

function Reading() {
  return (
    <div className="pb-2 pt-4">
      <p className="text-base font-semibold">Finding the place in this post…</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full w-1/3 animate-[lab-slide_1.2s_ease-in-out_infinite] rounded-full bg-stone-400" />
      </div>
      <style>{`@keyframes lab-slide { from { transform: translateX(-100%) } to { transform: translateX(300%) } }`}</style>
    </div>
  );
}

function Likely({ onSave, onOther }: { onSave: () => void; onOther: () => void }) {
  return (
    <div className="pt-4">
      <p className="text-base font-semibold">Is this the place?</p>
      <div className="mt-3 rounded-xl border border-stone-200 px-3 py-2.5">
        <p className="font-medium">{GUESS.name}</p>
        <p className="text-sm text-stone-500">{GUESS.type} · {GUESS.area}, {GUESS.city}</p>
      </div>
      <button onClick={onSave} className="mt-3 w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white active:bg-stone-800">
        Save {GUESS.name}
      </button>
      <button onClick={onOther} className="mt-1 w-full py-2 text-sm font-medium text-stone-500">Search for another place</button>
    </div>
  );
}

function Search({ initial, guessed, onSave }: { initial: string; guessed: boolean; onSave: (p: Place) => void }) {
  const [query, setQuery] = useState(initial);
  const q = query.trim().toLowerCase();
  const results = q.length < 2 ? [] : DIRECTORY.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => q.split(/\s+/).some((t) => w.startsWith(t))));
  return (
    <div className="pt-4">
      <p className="text-base font-semibold">{guessed ? "Which place is it?" : "We couldn’t tell which place this is"}</p>
      {!guessed && <p className="mt-1 text-sm text-stone-500">Search for its name to save it.</p>}
      <label className="mt-3 block">
        <span className="text-xs font-medium text-stone-500">Place name</span>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Casual Bakery"
          className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm outline-none placeholder:text-stone-400" />
      </label>
      <div className="mt-2 flex min-h-[120px] flex-col">
        {results.slice(0, 3).map((p) => (
          <div key={p.name} className="flex items-center gap-3 border-b border-stone-100 py-2.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-sm text-stone-500">{p.type} · {p.area}, {p.city}</p>
            </div>
            <button onClick={() => onSave(p)} className="shrink-0 rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">Save</button>
          </div>
        ))}
        {q.length >= 2 && results.length === 0 && <p className="py-3 text-sm text-stone-400">No places called that. Try the name and the town.</p>}
      </div>
    </div>
  );
}

/** One card for every save: what was saved and where, with Vicolo's mark. Tap to close early. */
function SavedCard({ place, milestone, onGone }: { place: Place; milestone: Milestone; onGone: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    const t = setTimeout(onGone, SHOW_MS);
    return () => { cancelAnimationFrame(a); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per card
  }, []);

  const line = milestone === "city" ? `Your first save in ${place.city}` : milestone === "category" ? `Your first ${PLURAL[place.type] ?? place.type.toLowerCase()}` : null;

  return (
    <button type="button" onClick={onGone}
      className={`absolute inset-x-3 bottom-3 overflow-hidden rounded-[32px] text-left shadow-2xl transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-[110%]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO} alt="" className="block aspect-[4/5] w-full object-cover" />
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/85 py-1 pl-1 pr-3 backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/elephant-resin.png" alt="" className="h-7 w-7" />
        <span className="text-sm font-semibold text-[#1f1c1a]">Saved to Vicolo</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-6 pt-20 text-white">
        {line && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/85">{line}</p>}
        <p className="text-[28px] font-semibold leading-tight tracking-tight">{place.name}</p>
        <p className="mt-0.5 text-base text-white/85">{place.type} · {place.city}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <div className="h-full bg-white/50" style={{ width: shown ? "100%" : "0%", transition: `width ${SHOW_MS - BAR_DELAY_MS}ms cubic-bezier(.45,0,.8,1) ${BAR_DELAY_MS}ms` }} />
      </div>
    </button>
  );
}
