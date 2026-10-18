"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, setOwnerKey } from "@/lib/api";
import type { Install, Save, Use } from "@/lib/db/schema";
import { daysAgo, phoneName, pulse, QUIET_DAYS, RETRIEVAL_BUILD, type Phone } from "@/lib/pulse";
import BackofficeNav from "./BackofficeNav";
import Locked from "./Locked";

/**
 * /pulse, the backoffice's home (Sarp, 2026-10-18): is Vicolo working for the people trying it?
 * Four questions, each answered in phones, then every phone on its own row (tap one to name it,
 * or mark it as yours so it stays out of the numbers). Math in lib/pulse.ts. Phone-first: this
 * page lives on Sarp's Home Screen.
 */
type Data = { saves: Save[]; uses: Use[]; installs: Install[] };

const INCLUDE_ME = "vicolo.pulse.includeMe";

export default function PulsePage() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [keyTried, setKeyTried] = useState(false);
  const [includeMe, setIncludeMe] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    const get = (path: string) => api(path).then((r) => (r.ok ? r.json() : Promise.reject()));
    Promise.all([get("/api/saves?days=90"), get("/api/uses?days=90"), get("/api/installs")])
      .then(([s, u, i]) => setData({ saves: s.saves, uses: u.uses, installs: i.installs }))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    try {
      setIncludeMe(localStorage.getItem(INCLUDE_ME) === "1");
    } catch {}
    const onLocked = () => setLocked(true);
    window.addEventListener("pinsta:locked", onLocked);
    return () => window.removeEventListener("pinsta:locked", onLocked);
  }, []);

  const p = useMemo(() => (data ? pulse(data.saves, data.uses, data.installs, { includeMe }) : null), [data, includeMe]);
  const mine = data?.installs.filter((i) => i.me).length ?? 0;

  if (locked && !data) {
    return (
      <Locked
        rejected={keyTried}
        onKey={(k) => {
          setKeyTried(true);
          setOwnerKey(k);
          setLocked(false);
          load();
        }}
      />
    );
  }

  const toggleMe = () => {
    setIncludeMe(!includeMe);
    try {
      localStorage.setItem(INCLUDE_ME, includeMe ? "0" : "1");
    } catch {}
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <h1 className="text-2xl font-semibold tracking-tight">Pulse</h1>
      <p className="mt-1 text-sm text-stone-500">
        {p ? `Last 30 days · ${p.phones.length} ${p.phones.length === 1 ? "phone" : "phones"}` : "Is Vicolo working for people?"}
        {mine > 0 && (
          <button onClick={toggleMe} className="ml-2 font-medium text-stone-400 underline active:text-stone-600">
            {includeMe ? "hide mine" : `+ ${mine} of mine`}
          </button>
        )}
      </p>

      {!p ? (
        <p className="mt-6 text-sm text-stone-400">{failed ? "Couldn't load." : "Loading…"}</p>
      ) : p.phones.length === 0 ? (
        <p className="mt-6 text-sm text-stone-400">No phone has reported yet.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3">
            <Question q="Can people save what they want?">
              {p.tries === 0 ? (
                <Empty>No saves tried yet.</Empty>
              ) : (
                <>
                  <Big n={p.tries - p.bands.missed} of={p.tries} unit="saves worked" />
                  <Split
                    parts={[
                      { n: p.bands.clean, label: "found it alone", tone: "bg-stone-800" },
                      { n: p.bands.rescued, label: "after digging", tone: "bg-stone-400" },
                      { n: p.bands.missed, label: "gave up", tone: "bg-red-400" },
                    ]}
                  />
                  {p.changed > 0 && (
                    <p className="mt-2 text-xs text-stone-400">
                      {p.changed} changed later, most likely a wrong automatic save.
                    </p>
                  )}
                </>
              )}
            </Question>

            <Question q="Which posts break it?">
              {p.missesByKind.length === 0 ? (
                <Empty>No misses.</Empty>
              ) : (
                <>
                  <p className="mb-1 text-xs text-stone-400">Gave up, or the post couldn&apos;t be read (even when saved by hand).</p>
                  <div className="divide-y divide-stone-100">
                    {p.missesByKind.map(([kind, n]) => (
                      <div key={kind} className="flex items-baseline py-1.5 text-sm">
                        <p className="flex-1">{kind}</p>
                        <p className="tabular-nums">{n}</p>
                      </div>
                    ))}
                  </div>
                  <a href="/saves#misses" className="mt-2 inline-block text-sm font-medium text-stone-500 active:text-stone-700">
                    The links →
                  </a>
                </>
              )}
            </Question>

            <Question q="Do they come back to save more?">
              {p.savers === 0 ? (
                <Empty>Nobody has saved yet.</Empty>
              ) : (
                <>
                  <Big n={p.returners} of={p.savers} unit="phones saved on 2+ days" />
                  {p.quiet.length > 0 && (
                    <p className="mt-2 text-sm text-stone-500">
                      Quiet for {QUIET_DAYS}+ days: {p.quiet.map(phoneName).join(", ")}
                    </p>
                  )}
                </>
              )}
            </Question>

            <Question q="Do they come back to find something?">
              {p.counting === 0 ? (
                <Empty>Counted from build {RETRIEVAL_BUILD}. No phone is on it yet.</Empty>
              ) : (
                <>
                  <Big n={p.lookers} of={p.counting} unit="phones opened a saved place on a day they saved nothing" />
                  <p className="mt-2 text-xs text-stone-400">
                    {p.phones.reduce((n, x) => n + x.directions, 0)} Directions taps,{" "}
                    {p.phones.reduce((n, x) => n + x.visited, 0)} marked Been there. Only phones on build {RETRIEVAL_BUILD}+.
                  </p>
                </>
              )}
            </Question>
          </div>

          {p.byBuild.length > 1 && <Builds rows={p.byBuild} />}

          <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">Phones</h2>
          <p className="mt-1 text-xs text-stone-400">Newest first. Tap one to name it.</p>
          <section className="mt-2 overflow-hidden rounded-2xl bg-white">
            <div className="divide-y divide-stone-100">
              {p.phones.map((x) => (
                <PhoneRow key={x.install} phone={x} onSaved={load} />
              ))}
            </div>
          </section>

          <Screens uses={data!.uses.filter((u) => includeMe || !data!.installs.some((i) => i.me && i.install === u.install))} />
        </>
      )}
      <BackofficeNav />
    </main>
  );
}

function Question({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white px-4 py-3.5">
      <h2 className="text-sm font-medium text-stone-500">{q}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-stone-400">{children}</p>;

/** "12 of 15", the number people would quote, with what it counts. */
function Big({ n, of, unit }: { n: number; of: number; unit: string }) {
  return (
    <p className="text-sm text-stone-500">
      <span className="text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">{n}</span>
      <span className="ml-1 text-lg font-medium text-stone-400 tabular-nums">of {of}</span>
      <span className="ml-2">{unit}</span>
    </p>
  );
}

function Split({ parts }: { parts: { n: number; label: string; tone: string }[] }) {
  const total = parts.reduce((s, x) => s + x.n, 0) || 1;
  return (
    <>
      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {parts.filter((x) => x.n > 0).map((x) => (
          <div key={x.label} className={x.tone} style={{ width: `${(100 * x.n) / total}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        {parts.map((x) => (
          <span key={x.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${x.tone}`} />
            <span className="tabular-nums">{x.n}</span> {x.label}
          </span>
        ))}
      </div>
    </>
  );
}

/** Did the last build help? Tries per build, found alone and gave up. */
function Builds({ rows }: { rows: { build: number; tries: number; clean: number; missed: number }[] }) {
  return (
    <>
      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">By build</h2>
      <section className="mt-2 overflow-hidden rounded-2xl bg-white">
        <div className="divide-y divide-stone-100 px-4">
          <div className="flex gap-3 py-2 text-xs text-stone-400">
            <p className="flex-1" />
            <p className="w-12 text-right">tries</p>
            <p className="w-14 text-right">alone</p>
            <p className="w-16 text-right">gave up</p>
          </div>
          {rows.map((b) => (
            <div key={b.build} className="flex items-baseline gap-3 py-2.5 text-sm tabular-nums">
              <p className="flex-1 font-medium">{b.build}</p>
              <p className="w-12 text-right">{b.tries}</p>
              <p className="w-14 text-right">{Math.round((100 * b.clean) / b.tries)}%</p>
              <p className="w-16 text-right">{b.missed}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
const ago = (day: string) => {
  const d = daysAgo(day);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

function PhoneRow({ phone: x, onSaved }: { phone: Phone; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(x.label ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (body: { label?: string; me?: boolean }) => {
    setBusy(true);
    await api("/api/installs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ install: x.install, ...body }) }).catch(() => {});
    setBusy(false);
    setOpen(false);
    onSaved();
  };
  const facts = [
    `since ${shortDay(x.firstSeen)}`,
    `${x.activeDays14} of 14 days`,
    `${x.saves} ${x.saves === 1 ? "save" : "saves"}${x.savesThisWeek ? ` (${x.savesThisWeek} this week)` : ""}`,
    x.misses ? `${x.misses} missed` : null,
    x.counts ? `${x.lookDays} look-up ${x.lookDays === 1 ? "day" : "days"}` : null,
    x.counts && x.directions ? `${x.directions} Directions` : null,
  ].filter(Boolean);
  return (
    <div className="px-4 py-3">
      <button className="block w-full text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-baseline gap-2 text-sm">
          <p className={`min-w-0 flex-1 truncate font-medium ${x.label ? "" : "font-mono text-xs text-stone-500"}`}>
            {phoneName(x)}
            {x.me && <span className="ml-2 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">me</span>}
            {x.quiet && !x.me && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">quiet</span>}
          </p>
          <p className="shrink-0 text-xs text-stone-400">
            {ago(x.lastSeen)} · build {x.build ?? "?"}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">{facts.join(" · ")}</p>
      </button>
      {open && (
        <form
          className="mt-2.5 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save({ label });
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-base outline-none focus:border-stone-400"
          />
          <button disabled={busy} className="rounded-xl bg-stone-900 px-3.5 text-sm font-medium text-white active:bg-stone-800 disabled:opacity-50">
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ me: !x.me })}
            className="rounded-xl bg-stone-100 px-3.5 text-sm font-medium text-stone-600 active:bg-stone-200 disabled:opacity-50"
          >
            {x.me ? "Not mine" : "Mine"}
          </button>
          <p className="w-full font-mono text-[10px] text-stone-400">{x.install}</p>
        </form>
      )}
    </div>
  );
}

const SCREENS = ["map", "list", "cards", "tiles", "tutorial"];

/** Seconds on each screen, view pill taps: summed over every phone, last 30 days. */
function Screens({ uses: all }: { uses: Use[] }) {
  const uses = all.filter((u) => daysAgo(u.day) < 30);
  if (uses.length === 0) return null;
  const sum = (event: string) => uses.filter((u) => u.event === event).reduce((n, u) => n + u.count, 0);
  const phones = (event: string) => new Set(uses.filter((u) => u.event === event && u.count > 0).map((u) => u.install)).size;
  const total = SCREENS.reduce((n, s) => n + sum(`sec.${s}`), 0);
  const opens = sum("open");
  return (
    <>
      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">Where the time goes</h2>
      <section className="mt-2 overflow-hidden rounded-2xl bg-white">
        <div className="divide-y divide-stone-100 px-4">
          <div className="flex gap-3 py-2 text-xs text-stone-400">
            <p className="flex-1" />
            <p className="w-14 text-right">time</p>
            <p className="w-10 text-right">share</p>
            <p className="w-12 text-right">picked</p>
            <p className="w-12 text-right">phones</p>
          </div>
          {SCREENS.map((s) => {
            const sec = sum(`sec.${s}`);
            return (
              <div key={s} className="flex items-baseline gap-3 py-2.5 text-sm">
                <p className="flex-1 font-medium capitalize">{s}</p>
                <p className="w-14 text-right tabular-nums">{duration(sec)}</p>
                <p className="w-10 text-right text-xs text-stone-400 tabular-nums">{total ? `${Math.round((100 * sec) / total)}%` : "–"}</p>
                <p className="w-12 text-right tabular-nums">{s === "tutorial" ? "" : sum(`pick.${s}`)}</p>
                <p className="w-12 text-right tabular-nums">{phones(`sec.${s}`)}</p>
              </div>
            );
          })}
        </div>
        <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-400">
          {opens} {opens === 1 ? "open" : "opens"}. Time is while the app is in front; picked counts taps on the view pill (every
          open starts on the map).
        </p>
      </section>
    </>
  );
}

function duration(sec: number): string {
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}
