"use client";

// Design sandbox for the share sheet's success states (Sarp, 2026-10-09). Nothing here
// saves or reads data: it plays the three states over a fake Instagram post so the timing
// and look can be judged on the web before iOS gets the settled version.
// One card for every save (Sarp): the post photo, the place's name and type · town over it,
// "Saved to Vicolo" with the elephant, and on a milestone one line above the name ("Your
// first bakery", "Your first save in Malmö"). Gone by itself after SHOW_MS, or on a tap.

import { useEffect, useState } from "react";

type Kind = "everyday" | "city" | "category";

const TYPES = ["Bakery", "Restaurant", "Cafe", "Bar", "Vineyard", "Hotel", "Shop", "Attraction", "Museum", "Nature"];
const PLURAL: Record<string, string> = { Bakery: "bakery", Cafe: "café", Nature: "nature spot" };
const SHOW_MS = 2600;
// The bar waits for the card to settle, then starts slow: a timer that runs from the first frame felt stressful (Sarp).
const BAR_DELAY_MS = 500;

export default function SuccessLab() {
  const [kind, setKind] = useState<Kind>("city");
  const [city, setCity] = useState("Malmö");
  const [type, setType] = useState("Bakery");
  const [name, setName] = useState("Casual Bakery");
  const [run, setRun] = useState(0);
  const [photo, setPhoto] = useState("/lab/post.jpg");

  return (
    <main className="min-h-dvh bg-stone-100 px-4 py-6 text-stone-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row md:items-start">
        <section className="flex flex-col gap-4 md:w-72">
          <h1 className="text-lg font-semibold">Success states</h1>
          <div className="flex flex-col gap-1.5">
            {([["everyday", "No milestone"], ["city", "First in a city"], ["category", "First of a type"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setKind(k); setRun((r) => r + 1); }}
                className={`rounded-xl px-3 py-2 text-left text-sm font-medium ${kind === k ? "bg-stone-900 text-white" : "bg-white text-stone-700"}`}>
                {label}
              </button>
            ))}
          </div>
          <Field label="Place"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg bg-white px-2 py-1.5 text-sm" /></Field>
          <Field label="Post photo (URL)"><input value={photo} onChange={(e) => setPhoto(e.target.value)} className="w-full rounded-lg bg-white px-2 py-1.5 text-sm" /></Field>
          <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg bg-white px-2 py-1.5 text-sm" /></Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg bg-white px-2 py-1.5 text-sm">
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <button onClick={() => setRun((r) => r + 1)} className="rounded-xl bg-white py-2 text-sm font-medium">Replay</button>
        </section>

        <Phone photo={photo}>
          <Sheet key={`${run}-${kind}`} kind={kind} name={name} city={city} type={type} photo={photo} />
        </Phone>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-stone-500">{label}{children}</label>;
}

/** A phone-sized frame over a stand-in Instagram post, so the sheet is judged in place. */
function Phone({ photo, children }: { photo: string; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-[720px] w-[340px] shrink-0 overflow-hidden rounded-[44px] border-[10px] border-stone-900 bg-stone-300 shadow-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" className="absolute inset-x-0 top-24 w-full" />
      <div className="absolute inset-0 bg-black/25" />
      {children}
    </div>
  );
}

function Sheet({ kind, name, city, type, photo }: { kind: Kind; name: string; city: string; type: string; photo: string }) {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    const t = setTimeout(() => setGone(true), SHOW_MS);
    return () => { cancelAnimationFrame(a); clearTimeout(t); };
  }, []);

  if (gone) return <p className="absolute inset-x-0 bottom-8 text-center text-xs text-white/80">Back to Instagram</p>;

  const milestone = kind === "city" ? `Your first save in ${city}` : kind === "category" ? `Your first ${PLURAL[type] ?? type.toLowerCase()}` : null;

  // One card, all photo: what was saved and where, with Vicolo's mark. Tap to close early.
  return (
    <button type="button" onClick={() => setGone(true)}
      className={`absolute inset-x-3 bottom-3 overflow-hidden rounded-[32px] text-left shadow-2xl transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-[110%]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" className="block aspect-[4/5] w-full object-cover" />
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/85 py-1 pl-1 pr-3 backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/elephant-resin.png" alt="" className="h-7 w-7" />
        <span className="text-sm font-semibold text-[#1f1c1a]">Saved to Vicolo</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-6 pt-20 text-white">
        {milestone && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/85">{milestone}</p>}
        <p className="text-[28px] font-semibold leading-tight tracking-tight">{name}</p>
        <p className="mt-0.5 text-base text-white/85">{type} · {city}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <div className="h-full bg-white/50" style={{ width: shown ? "100%" : "0%", transition: `width ${SHOW_MS - BAR_DELAY_MS}ms cubic-bezier(.45,0,.8,1) ${BAR_DELAY_MS}ms` }} />
      </div>
    </button>
  );
}
