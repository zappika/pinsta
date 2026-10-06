"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = {
  id: string;
  label: string;
  calls: number;
  free: number | null;
  freeLeft: number | null;
  per1000: number | null;
  cost: number;
};
export type Day = { day: string; apify: number; google: number };
export type Usage = {
  since: string;
  daily: Day[];
  services: Row[];
  apify: { usd: number; included: number; billedUsd: number; cycleStart: string | null; cycleEnd: string | null } | null;
  total: number;
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const count = (n: number) => n.toLocaleString("en");
const times = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? "" : "s"}`;
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }) : "?";

/**
 * What the paid APIs cost this month (app/api/usage), opened from the buddy
 * menu. Same floating card as Settings. Google is an estimate from our own
 * call counts; Apify is its real bill.
 */
export default function UsageSheet({ onClose }: { onClose: () => void }) {
  const { data, failed } = useUsage();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const month = data ? monthName(data.since) : "";

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col justify-end" role="dialog" aria-label="Usage">
      <button type="button" aria-label="Close" onClick={onClose} className="pinsta-fade absolute inset-0 bg-black/30" />
      <div className="pinsta-rise relative m-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Usage{month && ` · ${month} so far`}</p>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full px-2 py-1 text-sm font-medium text-stone-500 active:bg-stone-100">
            Done
          </button>
        </div>

        {!data ? (
          <p className="px-4 pt-3 pb-6 text-sm text-stone-400">{failed ? "Couldn't load usage." : "Loading…"}</p>
        ) : (
          <>
            <UsageSummary data={data} />
            <a href="/usage" className="block border-t border-stone-100 px-4 py-3 text-sm font-medium text-stone-600 active:bg-stone-50">
              Last 30 days, day by day →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function monthName(since: string) {
  return new Date(`${since}T00:00:00Z`).toLocaleDateString("en", { month: "long", timeZone: "UTC" });
}

/** /api/usage, once. Shared by the sheet and the /usage page. */
export function useUsage() {
  const [data, setData] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api("/api/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  return { data, failed, reload: load };
}

/** This month per service, the total and the footnote. */
export function UsageSummary({ data }: { data: Usage }) {
  return (
    <>
      <div className="divide-y divide-stone-100 px-4">
        {data.services.map((s) => (
          <div key={s.id} className="flex items-baseline gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-stone-400">
                {s.id === "apify"
                  ? data.apify
                    ? `${times(s.calls, "read")} · ${usd(data.apify.usd)} of ${usd(data.apify.included)} included · ${day(data.apify.cycleStart)}–${day(data.apify.cycleEnd)}`
                    : `${times(s.calls, "read")} · Apify didn't answer`
                  : `${times(s.calls, "call")} · ${count(s.freeLeft ?? 0)} of ${count(s.free ?? 0)} free left · $${s.per1000} per 1,000 after`}
              </p>
            </div>
            <p className={`text-sm tabular-nums ${s.cost > 0 ? "font-medium" : "text-stone-400"}`}>{usd(s.cost)}</p>
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between border-t border-stone-200 px-4 py-3">
        <p className="text-sm font-semibold">Estimated total</p>
        <p className="text-sm font-semibold tabular-nums">{usd(data.total)}</p>
      </div>
      <p className="px-4 pb-4 text-xs text-stone-400">
        Google is estimated from our own call counts (counting began 2 Oct 2026). Apify is its own figure.
      </p>
    </>
  );
}
