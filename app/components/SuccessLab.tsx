"use client";

// Design sandbox for the share sheet's success states (Sarp, 2026-10-09). Nothing here
// saves or reads data: it plays the three states over a fake Instagram post so the timing
// and look can be judged on the web before iOS gets the settled version.
//   Everyday save  — post + place, quick, gone by itself.
//   New city / new category — the same with a milestone line; stays, "See it on your map".
// The post and the place lead, not icons (Sarp: make the user imagine what was saved and where).
// "See it" can't open the app from a share extension (officially); the plan is a flag the
// app reads on its next open (option 2), so here it only says so.

import { useEffect, useState } from "react";

type Kind = "everyday" | "city" | "category";

const TYPES = ["Bakery", "Restaurant", "Cafe", "Bar", "Vineyard", "Hotel", "Shop", "Attraction", "Museum", "Nature"];
const PLURAL: Record<string, string> = { Bakery: "bakery", Cafe: "café", Nature: "nature spot" };
const EVERYDAY_MS = 1400;

export default function SuccessLab() {
  const [kind, setKind] = useState<Kind>("city");
  const [city, setCity] = useState("Malmö");
  const [type, setType] = useState("Bakery");
  const [name, setName] = useState("Casual Bakery");
  const [count, setCount] = useState(4);
  const [run, setRun] = useState(0);
  const [photo, setPhoto] = useState("/lab/post.jpg");

  return (
    <main className="min-h-dvh bg-stone-100 px-4 py-6 text-stone-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row md:items-start">
        <section className="flex flex-col gap-4 md:w-72">
          <h1 className="text-lg font-semibold">Success states</h1>
          <div className="flex flex-col gap-1.5">
            {([["everyday", "Everyday save"], ["city", "New city"], ["category", "New category"]] as const).map(([k, label]) => (
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
          <Field label={`Places in this city after the save: ${count}`}>
            <input type="range" min={1} max={20} value={count} onChange={(e) => setCount(+e.target.value)} className="w-full" />
          </Field>
          <button onClick={() => setRun((r) => r + 1)} className="rounded-xl bg-white py-2 text-sm font-medium">Replay</button>
        </section>

        <Phone photo={photo}>
          <Sheet key={`${run}-${kind}`} kind={kind} name={name} city={city} type={type} count={count} photo={photo} />
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

function Sheet({ kind, name, city, type, count, photo }: { kind: Kind; name: string; city: string; type: string; count: number; photo: string }) {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    const t = kind === "everyday" ? setTimeout(() => setGone(true), EVERYDAY_MS) : undefined;
    return () => { cancelAnimationFrame(a); clearTimeout(t); };
  }, [kind]);

  if (gone) return <p className="absolute inset-x-0 bottom-8 text-center text-xs text-white/80">Back to Instagram</p>;

  const cityName = city.replace(/ \(.*\)$/, "");
  const everyday = kind === "everyday";
  const milestone = kind === "city" ? `First place in ${cityName}` : kind === "category" ? `Your first ${PLURAL[type] ?? type.toLowerCase()}` : null;

  // The post and the place lead: what was saved, and where. The milestone is one line above.
  return (
    <div className={`absolute inset-x-3 bottom-3 overflow-hidden rounded-[32px] bg-white transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-full"}`}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className={`w-full object-cover ${everyday ? "aspect-[4/3]" : "aspect-[4/5]"}`} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-5 pb-4 pt-16 text-white">
          {milestone && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/80">{milestone}</p>}
          <p className="text-[26px] font-semibold leading-tight tracking-tight">{name}</p>
          <p className="mt-0.5 text-base text-white/85">{type} · {cityName}</p>
        </div>
      </div>
      {everyday ? (
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-medium text-stone-500">Saved to Vicolo · {count} in {cityName}</p>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-stone-300" style={{ width: shown ? "100%" : "0%", transition: `width ${EVERYDAY_MS}ms linear` }} />
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 pt-4">
          <button onClick={() => setNote("The app will open on this place next time.")}
            className="w-full rounded-2xl bg-stone-900 py-3.5 text-base font-semibold text-white active:bg-stone-800">
            See it on your map
          </button>
          <button onClick={() => setGone(true)} className="mt-1 w-full py-2 text-sm font-medium text-stone-500">Done</button>
          {note && <p className="text-center text-xs text-stone-400">{note}</p>}
        </div>
      )}
    </div>
  );
}
