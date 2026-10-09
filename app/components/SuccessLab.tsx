"use client";

// Design sandbox for the share sheet's success states (Sarp, 2026-10-09). Nothing here
// saves or reads data: it plays the three states over a fake Instagram post so the timing
// and look can be judged on the web before iOS gets the settled version.
//   Everyday save  — big, quick, gone by itself.
//   New city       — the city's icon, stays, "See it on your map".
//   New category   — the type's icon, stays, "See it on your map".
// "See it" can't open the app from a share extension (officially); the plan is a flag the
// app reads on its next open (option 2), so here it only says so.

import { useEffect, useState } from "react";

type Kind = "everyday" | "city" | "category";

const CITIES: Record<string, string> = {
  Istanbul: "tea-cat", "New York": "mets-cap", "San Francisco": "transamerica-pyramid", London: "oyster-card",
  Paris: "red-lipstick", Barcelona: "vermouth-siphon", Madrid: "dali-painting", Athens: "souvlaki", Tokyo: "vending-machine",
  Seoul: "karaoke-microphone", Berlin: "berlin-station", Copenhagen: "tin-soldier", "Malmö": "falafel-pita", Helsinki: "sauna-bucket",
  Stockholm: "cardamom-bun", Rome: "pantheon", Torino: "mole-antonelliana", Milano: "campari-bottle", Lisbon: "lisbon-kiosk",
  "Mexico City": "sun-stone", Vienna: "museum-seat", "Gothenburg (no icon)": "",
};
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
          <Field label="City">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg bg-white px-2 py-1.5 text-sm">
              {Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
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

        <Phone>
          <Sheet key={`${run}-${kind}`} kind={kind} name={name} city={city} type={type} count={count} />
        </Phone>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-stone-500">{label}{children}</label>;
}

/** A phone-sized frame over a stand-in Instagram post, so the sheet is judged in place. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-[720px] w-[340px] shrink-0 overflow-hidden rounded-[44px] border-[10px] border-stone-900 bg-stone-300 shadow-xl">
      <div className="absolute inset-0 bg-[url(/types/bakery.png)] bg-[length:70%] bg-center bg-no-repeat opacity-30" />
      <div className="absolute inset-0 bg-black/25" />
      {children}
    </div>
  );
}

function Sheet({ kind, name, city, type, count }: { kind: Kind; name: string; city: string; type: string; count: number }) {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    const t = kind === "everyday" ? setTimeout(() => setGone(true), EVERYDAY_MS) : undefined;
    return () => { cancelAnimationFrame(a); clearTimeout(t); };
  }, [kind]);

  const cityIcon = CITIES[city];
  const cityName = city.replace(/ \(.*\)$/, "");
  const typeIcon = `/types/${type.toLowerCase()}.png`;
  const where = `${type} · ${cityName}`;

  if (gone) return <p className="absolute inset-x-0 bottom-8 text-center text-xs text-white/80">Back to Instagram</p>;

  const pop = `transition duration-500 ease-[cubic-bezier(.2,1.4,.4,1)] ${shown ? "scale-100 opacity-100" : "scale-50 opacity-0"}`;

  if (kind === "everyday") {
    return (
      <div className={`absolute inset-x-3 bottom-3 rounded-[32px] bg-white px-6 pb-8 pt-7 text-center transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-full"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={typeIcon} alt="" className={`mx-auto h-24 w-24 object-contain ${pop}`} />
        <p className="mt-3 text-xl font-semibold">{name}</p>
        <p className="mt-1 text-sm text-stone-500">Saved · {cityName}</p>
        <div className="mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full bg-stone-300" style={{ width: shown ? "100%" : "0%", transition: `width ${EVERYDAY_MS}ms linear` }} />
        </div>
      </div>
    );
  }

  const isCity = kind === "city";
  const headline = isCity ? `First place in ${cityName}` : `Your first ${PLURAL[type] ?? type.toLowerCase()}`;
  const sub = isCity ? where : `${where} · ${count} places in ${cityName}`;
  const icon = isCity && cityIcon ? `/vicolo-library/assets/cities/${cityIcon}.png` : typeIcon;

  return (
    <div className={`absolute inset-x-3 bottom-3 rounded-[32px] bg-[#FDFCF5] px-6 pb-6 pt-8 text-center transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-full"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className={`mx-auto h-36 w-auto max-w-[85%] object-contain mix-blend-multiply ${pop}`} />
      <p className="mt-4 text-[26px] font-semibold leading-tight tracking-tight">{headline}</p>
      <p className="mt-3 text-base font-medium">{name}</p>
      <p className="mt-0.5 text-sm text-stone-500">{sub}</p>
      <button onClick={() => setNote("The app will open on this place next time.")}
        className="mt-6 w-full rounded-2xl bg-stone-900 py-3.5 text-base font-semibold text-white active:bg-stone-800">
        See it on your map
      </button>
      <button onClick={() => setGone(true)} className="mt-2 w-full py-2 text-sm font-medium text-stone-500">Done</button>
      {note && <p className="mt-1 text-xs text-stone-400">{note}</p>}
    </div>
  );
}
