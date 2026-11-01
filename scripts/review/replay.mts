// Replays the regression set (review_cases) through the iOS search on real MapKit: compiles
// scripts/review/Replay.swift with this checkout's ios/Pinsta search code, runs every case, and
// scores it. A case passes when the first suggestion is the place people ended up saving (or,
// for a place they took from Google, when Apple found nothing: the app then asks Google itself).
// A gave-up nobody has answered yet is listed but not scored. Free: no Apify, no Google.
//   npm run review:replay [-- --ios <path to ios/Pinsta>] [--only <url>] [--pause 12] > result.json
import { neon } from "@neondatabase/serverless";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ReviewCase, ReviewReport } from "../../lib/db/schema";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const ios = resolve(arg("ios") ?? "ios/Pinsta");
const only = arg("only");
const pause = arg("pause") ?? "12";

const sql = neon(process.env.DATABASE_URL!);
const rows = (await sql`select * from review_cases where post is not null order by added_at`) as (ReviewCase & { added_at: string })[];
const cases = rows.filter((c) => c.expect !== "-" && (!only || c.url === only));

const dir = mkdtempSync(join(tmpdir(), "vicolo-replay-"));
writeFileSync(join(dir, "cases.json"), JSON.stringify(cases.map((c) => ({ url: c.url, ...c.post! }))));
const models = readdirSync(join(ios, "Models")).filter((f) => f.endsWith(".swift")).map((f) => join(ios, "Models", f));
console.error(`compiling against ${ios}…`);
// Top-level code only compiles in a file called main.swift.
copyFileSync(resolve("scripts/review/Replay.swift"), join(dir, "main.swift"));
execFileSync("swiftc", ["-O", "-suppress-warnings", "-o", join(dir, "replay"), join(ios, "Services/PlaceSearch.swift"), join(ios, "Services/Metros.swift"), ...models, join(dir, "main.swift")], { stdio: ["ignore", "ignore", "inherit"] });

console.error(`replaying ${cases.length} cases, ${pause}s apart…`);
const got = new Map<string, { got: string[]; auto: boolean }>();
await new Promise<void>((done, fail) => {
  const run = spawn(join(dir, "replay"), [join(dir, "cases.json"), pause]);
  let buf = "";
  run.stdout.on("data", (d) => {
    buf += d;
    let n;
    while ((n = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, n);
      buf = buf.slice(n + 1);
      if (!line.startsWith("{")) continue;
      const r = JSON.parse(line);
      got.set(r.url, r);
      console.error(`${got.size}/${cases.length} ${r.got[0] ?? "(nothing)"}`);
    }
  });
  run.on("exit", (code) => (code === 0 ? done() : fail(new Error(`replay exited ${code}`))));
});

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
const results: ReviewReport["results"] = cases.map((c) => {
  const r = got.get(c.url) ?? { got: [], auto: false };
  const pass = c.expect == null ? false : r.got.length ? same(r.got[0], c.expect) : c.google;
  return { url: c.url, expect: c.expect, got: r.got.slice(0, 4), pass, auto: r.auto };
});
const scored = results.filter((r) => r.expect != null);
console.log(JSON.stringify({ passed: scored.filter((r) => r.pass).length, total: scored.length, open: results.length - scored.length, results }, null, 1));
