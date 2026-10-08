"use client";

import { useEffect, useState } from "react";
import { setOwnerKey } from "@/lib/api";
import Locked from "./Locked";
import { monthName, UsageSummary, useUsage, type Day } from "./UsageSheet";

/**
 * /usage: the Usage sheet as a page to keep open or bookmark, plus the last 30
 * days day by day. Owner-only like the list; the same key screen on a 401.
 */
export default function UsagePage() {
  const { data, failed, reload } = useUsage();
  const [locked, setLocked] = useState(false);
  const [keyTried, setKeyTried] = useState(false);

  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener("pinsta:locked", onLocked);
    return () => window.removeEventListener("pinsta:locked", onLocked);
  }, []);

  if (locked && !data) {
    return (
      <Locked
        rejected={keyTried}
        onKey={(k) => {
          setKeyTried(true);
          setOwnerKey(k);
          setLocked(false);
          reload();
        }}
      />
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-12">
      <a href="/app" className="text-sm font-medium text-stone-500 active:text-stone-700">
        ← Vicolo
      </a>
      <a href="/library" className="ml-5 text-sm font-medium text-stone-500">Object library →</a>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Usage</h1>
      <p className="mt-1 text-sm text-stone-500">{data ? `${monthName(data.since)} so far` : "What the paid services cost"}</p>

      {!data ? (
        <p className="mt-6 text-sm text-stone-400">{failed ? "Couldn't load usage." : "Loading…"}</p>
      ) : (
        <>
          <section className="mt-5 overflow-hidden rounded-2xl bg-white">
            <UsageSummary data={data} />
          </section>

          <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">Last 30 days</h2>
          <DayBars title="Instagram reads" unit="read" days={data.daily} pick={(d) => d.apify} />
          <DayBars title="Google calls" unit="call" days={data.daily} pick={(d) => d.google} />
          <p className="mt-3 text-xs text-stone-400">
            Days are UTC. Reads are every post a phone or this site asked for, friends included; there is no per-person count.
          </p>
        </>
      )}
    </main>
  );
}

const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * One series, one bar a day. Apify and Google get a chart each: their counts run
 * on different scales, and one axis for both would flatten the smaller.
 */
function DayBars({ title, unit, days, pick }: { title: string; unit: string; days: Day[]; pick: (d: Day) => number }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const shown = hover === null ? null : { day: days[hover].day, n: values[hover] };
  const plural = (n: number) => `${n.toLocaleString("en")} ${unit}${n === 1 ? "" : "s"}`;

  return (
    <section className="mt-3 rounded-2xl bg-white px-4 pt-3 pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {/* The hovered day replaces the 30-day total, so the readout never covers a bar. */}
        <p className="text-xs tabular-nums text-stone-500">{shown ? `${shortDay(shown.day)} · ${plural(shown.n)}` : `${plural(total)} in 30 days`}</p>
      </div>

      <div className="relative mt-3 h-28" aria-hidden onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-stone-100" />
        <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] tabular-nums text-stone-400">{max.toLocaleString("en")}</span>
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-stone-200">
          {values.map((n, i) => (
            // The whole column is the hover target, not just the bar: a quiet day is still hoverable.
            <div key={days[i].day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <div
                className={`w-full rounded-t-[4px] ${n === 0 ? "" : hover === i ? "bg-stone-900" : "bg-stone-600"}`}
                style={{ height: n === 0 ? 0 : `max(2px, ${(n / max) * 100}%)` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-stone-400" aria-hidden>
        <span>{shortDay(days[0].day)}</span>
        <span>{shortDay(days[days.length - 1].day)}</span>
      </div>

      {/* In a div: a table ignores the 1px height of sr-only and stretched the page. */}
      <div className="sr-only">
        <table>
          <caption>{title} per day, last 30 days</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>{title}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day}>
                <td>{shortDay(d.day)}</td>
                <td>{values[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
