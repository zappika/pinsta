"use client";

import { useCallback, useEffect, useState } from "react";
import { api, setOwnerKey } from "@/lib/api";
import type { Review } from "@/lib/db/schema";
import BackofficeNav from "./BackofficeNav";
import Locked from "./Locked";

/**
 * /review (backoffice, Sarp 2026-11-01): the search checking itself. Every save someone dug for or
 * gave up on is a case in a regression set; a scheduled task on Sarp's Mac replays them all through
 * the iOS search each week, groups what still fails into causes, and tries one fix on a local branch.
 * This page shows what it found. Gave-ups have no answer until one is typed here. Owner-only.
 */
type Case = { url: string; expect: string | null; outcome: string; note: string | null; addedAt: string };

export default function ReviewPage() {
  const [data, setData] = useState<{ reviews: Review[]; cases: Case[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [keyTried, setKeyTried] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api("/api/reviews")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
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
          load();
        }}
      />
    );
  }

  const [latest, ...earlier] = data?.reviews ?? [];
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <p className="mt-1 text-sm text-stone-500">Every save people dug for, replayed through the search each Monday</p>
      {!data ? (
        <p className="mt-6 text-sm text-stone-400">{failed ? "Couldn't load reviews." : "Loading…"}</p>
      ) : (
        <>
          {latest ? <Latest review={latest} before={earlier[0]} /> : <p className="mt-6 text-sm text-stone-400">No review yet. The first runs on Monday.</p>}
          <Unanswered cases={data.cases} onSaved={load} />
          {earlier.length > 0 && <Earlier reviews={earlier} />}
          <p className="mt-8 text-xs text-stone-400">
            {data.cases.length} cases in the set. Run by hand: <code>npm run review:replay</code>.
          </p>
        </>
      )}
      <BackofficeNav />
    </main>
  );
}

function Latest({ review, before }: { review: Review; before?: Review }) {
  const r = review.report;
  const delta = before ? review.passed - before.passed : 0;
  const failing = r.results.filter((x) => x.expect && x.expect !== "-" && !x.pass);
  return (
    <>
      <section className="mt-5 rounded-2xl bg-white px-4 py-4">
        <div className="flex items-baseline gap-3">
          <p className="flex-1 text-3xl font-semibold tabular-nums tracking-tight">
            {review.passed}
            <span className="text-stone-400"> of {review.total}</span>
          </p>
          <p className="text-xs text-stone-400">{when(review.at)}</p>
        </div>
        <p className="mt-0.5 text-sm text-stone-500">
          found first{before && delta !== 0 ? ` · ${delta > 0 ? "+" : ""}${delta} since the last review` : ""}
        </p>
        <p className="mt-3 text-sm leading-relaxed">{r.summary}</p>
      </section>

      {r.proposal && (
        <>
          <Heading>Proposed change</Heading>
          <section className="mt-2 rounded-2xl bg-white px-4 py-4 text-sm">
            <p className="font-medium">{r.proposal.title}</p>
            <p className="mt-1 leading-relaxed text-stone-600">{r.proposal.why}</p>
            <p className="mt-3 text-stone-500">
              With it: <span className="font-medium text-stone-800 tabular-nums">{r.proposal.passedAfter} of {review.total}</span>
              {r.proposal.broke.length > 0 ? ` · breaks ${r.proposal.broke.length}` : " · breaks nothing that passed"}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Branch <code className="text-stone-600">{r.proposal.branch}</code> on the Mac, not pushed · {r.proposal.files.join(", ")}
            </p>
            <p className="mt-2 text-xs text-stone-400">To take it, ask a session to merge that branch.</p>
          </section>
        </>
      )}

      {r.causes.length > 0 && (
        <>
          <Heading>Why the rest fail</Heading>
          <section className="mt-2 overflow-hidden rounded-2xl bg-white">
            <div className="divide-y divide-stone-100">
              {r.causes.map((c) => (
                <div key={c.title} className="px-4 py-3 text-sm">
                  <div className="flex items-baseline gap-3">
                    <p className="flex-1 font-medium">{c.title}</p>
                    <p className="text-xs text-stone-400 tabular-nums">{c.count}</p>
                  </div>
                  <p className="mt-1 leading-relaxed text-stone-600">{c.fix}</p>
                  <p className="mt-1 text-xs text-stone-400">{c.code}</p>
                  {c.examples.map((u) => (
                    <Link key={u} url={u} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Heading>Not found first ({failing.length})</Heading>
      {failing.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">None.</p>
      ) : (
        <section className="mt-2 overflow-hidden rounded-2xl bg-white">
          <div className="divide-y divide-stone-100">
            {failing.map((x) => (
              <div key={x.url} className="px-4 py-2.5 text-sm">
                <p className="font-medium">{x.expect}</p>
                <p className="mt-0.5 text-xs text-stone-500">{x.got.length ? `Offered ${x.got.join(" · ")}` : "Offered nothing"}</p>
                <Link url={x.url} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Gave-ups nobody has answered: type the place the post shows, or skip it (not a venue). */
function Unanswered({ cases, onSaved }: { cases: Case[]; onSaved: () => void }) {
  const open = cases.filter((c) => !c.expect);
  if (open.length === 0) return null;
  return (
    <>
      <Heading>Which place is it? ({open.length})</Heading>
      <p className="mt-1 text-xs text-stone-400">Gave-ups have no answer to check against. Type the place the post shows, or skip it.</p>
      <section className="mt-2 overflow-hidden rounded-2xl bg-white">
        <div className="divide-y divide-stone-100">
          {open.map((c) => (
            <Answer key={c.url} c={c} onSaved={onSaved} />
          ))}
        </div>
      </section>
    </>
  );
}

function Answer({ c, onSaved }: { c: Case; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const save = (expect: string) => {
    setBusy(true);
    api("/api/reviews", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: c.url, expect }) })
      .then(onSaved)
      .finally(() => setBusy(false));
  };
  return (
    <div className="px-4 py-3">
      <Link url={c.url} />
      {c.note && <p className="mt-0.5 text-xs text-stone-400">{c.note}</p>}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save(name);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Place name"
          className="min-w-0 flex-1 rounded-lg bg-stone-100 px-3 py-1.5 text-sm outline-none"
        />
        <button disabled={busy || !name.trim()} className="rounded-lg bg-stone-900 px-3 text-sm font-medium text-white disabled:opacity-40">
          Save
        </button>
        <button type="button" disabled={busy} onClick={() => save("-")} className="px-1 text-sm text-stone-500 active:text-stone-700">
          Skip
        </button>
      </form>
    </div>
  );
}

function Earlier({ reviews }: { reviews: Review[] }) {
  return (
    <>
      <Heading>Earlier</Heading>
      <section className="mt-2 overflow-hidden rounded-2xl bg-white">
        <div className="divide-y divide-stone-100 px-4">
          {reviews.map((r) => (
            <div key={r.id} className="flex items-baseline gap-3 py-2.5 text-sm">
              <p className="flex-1 truncate text-stone-600">{r.report.proposal?.title ?? r.report.summary}</p>
              <p className="tabular-nums">
                {r.passed}/{r.total}
              </p>
              <p className="w-16 text-right text-xs text-stone-400">{when(r.at)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400">{children}</h2>;
}

function Link({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-stone-400 underline">
      {url.replace(/^https?:\/\/(www\.)?/, "")}
    </a>
  );
}

function when(at: Date | string) {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
