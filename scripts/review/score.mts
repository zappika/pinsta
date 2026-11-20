// How a replay is scored, shared by the phone replay (replay.mts) and the server one (replay-server.mts).
import type { ReviewCase, ReviewReport } from "../../lib/db/schema";

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const letters = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, "");
const words = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
/**
 * Same place by name: one name inside the other ("Bisou." / "Bisou", "Beak" / "Beak Brewery"), or every
 * word of one in the other ("Bar la Janethe" / "Bar Restaurante La Janethe").
 */
const same = (a: string, b: string) => {
  const x = letters(a), y = letters(b);
  if (x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))) return true;
  const [wa, wb] = [words(a), words(b)];
  return wa.length > 0 && wb.length > 0 && (wa.every((w) => wb.includes(w)) || wb.every((w) => wa.includes(w)));
};
/**
 * What was found carries at most two words the saved name lacks ("Bar Restaurante La Janethe" for "Bar la Janethe").
 * The saved name may be longer: Google's "Alapar - Restaurante Japonés-Mediterráneo" is Apple's "Alapar".
 */
const close = (found: string, saved: string) => {
  const ws = words(saved);
  return letters(found) === letters(saved) || words(found).filter((w) => !ws.includes(w)).length <= 2;
};

/** A case passes when the first suggestion is the place people saved (or, for a place from Google, when nothing was found: the app then asks Google). */
export function score(cases: ReviewCase[], got: Map<string, { got: string[]; auto: boolean }>) {
  const results: ReviewReport["results"] = cases.map((c) => {
    const r = got.get(c.url) ?? { got: [], auto: false };
    // A place saved without a tap has to be the very place, not one carrying its name among others: "Apa Del Col Nal
    // Mixto José María De Sagarra De Bar" contains "Sagarra" and passed while it was saving the wrong place (2026-11-11).
    const pass = c.expect == null ? false : r.got.length ? same(r.got[0], c.expect) && (!r.auto || close(r.got[0], c.expect)) : c.google;
    return { url: c.url, expect: c.expect, got: r.got.slice(0, 4), pass, auto: r.auto };
  });
  const scored = results.filter((r) => r.expect != null);
  return { passed: scored.filter((r) => r.pass).length, total: scored.length, open: results.length - scored.length, results };
}
