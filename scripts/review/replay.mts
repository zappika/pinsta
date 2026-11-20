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
import type { ReviewCase } from "../../lib/db/schema";
import { score } from "./score.mts";

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

console.log(JSON.stringify(score(cases, got), null, 1));
