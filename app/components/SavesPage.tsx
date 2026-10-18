"use client";

import { useCallback, useEffect, useState } from "react";
import { api, setOwnerKey } from "@/lib/api";
import type { Save } from "@/lib/db/schema";
import { isMiss, sourceOf } from "@/lib/pulse";
import BackofficeNav from "./BackofficeNav";
import Locked from "./Locked";

/**
 * /saves (backoffice): how the phones' saves ended, last 30 days. The point is
 * the misses: a post someone gave up on is a case to open and fix, reported
 * without anyone having to message Sarp. Owner-only, like /usage. Below the
 * outcomes: where saves came from. People (phones, coming back) are on /pulse.
 */
const OUTCOME: Record<string, string> = {
  auto: "Saved by itself",
  picked: "Picked a suggestion",
  searched: "Typed a search",
  many: "List post",
  already: "Already in Vicolo",
  changed: "Changed the place",
  gave_up: "Gave up",
};

export default function SavesPage() {
  const [rows, setRows] = useState<Save[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [keyTried, setKeyTried] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api("/api/saves")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { saves: Save[] }) => setRows(d.saves))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener("pinsta:locked", onLocked);
    return () => window.removeEventListener("pinsta:locked", onLocked);
  }, []);

  if (locked && !rows) {
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

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <h1 className="text-2xl font-semibold tracking-tight">Saves</h1>
      <p className="mt-1 text-sm text-stone-500">How saves ended on the phones, last 30 days</p>
      {!rows ? (
        <p className="mt-6 text-sm text-stone-400">{failed ? "Couldn't load saves." : "Loading…"}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-400">Nothing yet. Phones report from the build after 27.</p>
      ) : (
        <Report rows={rows} />
      )}
      <BackofficeNav />
    </main>
  );
}

function Report({ rows }: { rows: Save[] }) {
  const count = (o: string) => rows.filter((r) => r.outcome === o).length;
  const tries = rows.filter((r) => r.outcome !== "already" && r.outcome !== "changed");
  const pct = (n: number) => (tries.length ? `${Math.round((100 * n) / tries.length)}%` : "–");
  const misses = rows.filter(isMiss);

  const installs = new Set(rows.map((r) => r.install));

  return (
    <>
      <section className="mt-5 overflow-hidden rounded-2xl bg-white">
        <div className="divide-y divide-stone-100 px-4">
          {Object.keys(OUTCOME).map((o) => (
            <div key={o} className="flex items-baseline gap-3 py-3">
              <p className="flex-1 text-sm font-medium">{OUTCOME[o]}</p>
              <p className="text-sm tabular-nums">{count(o)}</p>
              <p className="w-12 text-right text-xs text-stone-400 tabular-nums">{o === "already" || o === "changed" ? "" : pct(count(o))}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-400">
          {tries.length} {tries.length === 1 ? "save" : "saves"} tried by {installs.size}{" "}
          {installs.size === 1 ? "phone" : "phones"}. Percentages leave out “Already in Vicolo” and changes (a changed place usually means a wrong automatic save).
        </p>
      </section>

      <div id="misses" className="mt-8 flex scroll-mt-6 items-baseline">
        <h2 className="flex-1 text-xs font-medium uppercase tracking-wide text-stone-400">Misses ({misses.length})</h2>
        <CopyLinks rows={misses} />
      </div>
      <p className="mt-1 text-xs text-stone-400">Gave up, or the post couldn&apos;t be read. Each is a case to open.</p>
      <Rows rows={misses} />

      <Sources rows={tries} />


      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">All</h2>
      <Rows rows={rows} />
    </>
  );
}

function Sources({ rows }: { rows: Save[] }) {
  if (rows.length === 0) return null;
  const by = new Map<string, { share: number; app: number }>();
  for (const r of rows) {
    const k = sourceOf(r.url);
    const e = by.get(k) ?? { share: 0, app: 0 };
    e[r.detail.via === "share" ? "share" : "app"]++;
    by.set(k, e);
  }
  const sorted = [...by.entries()].sort((a, b) => b[1].share + b[1].app - (a[1].share + a[1].app));
  return (
    <>
      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">Where saves came from</h2>
      <section className="mt-2 overflow-hidden rounded-2xl bg-white">
        <div className="divide-y divide-stone-100 px-4">
          <div className="flex gap-3 py-2 text-xs text-stone-400">
            <p className="flex-1" />
            <p className="w-20 text-right">share sheet</p>
            <p className="w-14 text-right">in app</p>
          </div>
          {sorted.map(([k, e]) => (
            <div key={k} className="flex items-baseline gap-3 py-2.5 text-sm">
              <p className="flex-1 font-medium">{k}</p>
              <p className="w-20 text-right tabular-nums">{e.share}</p>
              <p className="w-14 text-right tabular-nums">{e.app}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** Every miss's link, one per line, to paste into a session and work through. */
function CopyLinks({ rows }: { rows: Save[] }) {
  const [copied, setCopied] = useState(false);
  const links = [...new Set(rows.map((r) => r.url).filter(Boolean))];
  if (links.length === 0) return null;
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(links.join("\n")).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="text-xs font-medium text-stone-500 active:text-stone-700"
    >
      {copied ? "Copied" : `Copy ${links.length} ${links.length === 1 ? "link" : "links"}`}
    </button>
  );
}

function Rows({ rows }: { rows: Save[] }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-stone-400">None.</p>;
  return (
    <section className="mt-2 overflow-hidden rounded-2xl bg-white">
      <div className="divide-y divide-stone-100">
        {rows.map((r) => (
          <div key={r.id} className="px-4 py-2.5">
            <div className="flex items-baseline gap-3 text-sm">
              <p className="min-w-0 flex-1 truncate font-medium">{r.detail.place ?? OUTCOME[r.outcome] ?? r.outcome}</p>
              <p className="shrink-0 text-xs text-stone-400">{when(r.at)}</p>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">{describe(r)}</p>
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-stone-400 underline">
                {r.url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** One grey line: what happened, in order. */
function describe(r: Save): string {
  const d = r.detail;
  const bits: string[] = [];
  if (r.detail.place) bits.push(OUTCOME[r.outcome] ?? r.outcome);
  if (d.readError) bits.push(`couldn't read: ${d.readError}`);
  if (d.source) bits.push(`from ${d.source}`);
  if (d.offered !== undefined && r.outcome !== "auto") bits.push(`${d.offered} offered`);
  if (d.rank != null && d.rank > 0) bits.push(`took #${d.rank + 1}`);
  if (d.google) bits.push("Google");
  if (d.listed) bits.push(`${d.saved ?? 0} of ${d.listed} listed`);
  if (r.outcome === "gave_up" && d.step) bits.push(`at “${d.step}”`);
  if (d.seconds !== undefined) bits.push(`${d.seconds} s`);
  bits.push(d.via === "share" ? "share sheet" : "in app");
  bits.push(`build ${r.build ?? "?"}`, r.install.slice(0, 8));
  return bits.join(" · ");
}

const when = (iso: Date | string) =>
  new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
