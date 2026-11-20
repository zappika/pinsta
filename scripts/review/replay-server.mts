// The search review's cases through the server's search (lib/resolve-post.ts, on Google Places) instead of
// the phone's (MapKit): can the server do the phone's job? Scored like the phone replay (score.mts).
// Costs Google Text Search calls (a few per case, inside the monthly free allowance; counted in Usage).
//   npm run review:replay-server [-- --source apple] [--only <url>] > server.json
import { neon } from "@neondatabase/serverless";
import type { ReviewCase } from "../../lib/db/schema";
import { resolvePost } from "../../lib/resolve-post";
import { searchWith } from "../../lib/google-places";
import { searchApple } from "../../lib/apple-maps";
import { score } from "./score.mts";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = arg("only");
// --source apple: Apple Maps Server API (free, 25,000 a day) in place of Google.
if (arg("source") === "apple") searchWith(searchApple);

const sql = neon(process.env.DATABASE_URL!);
const rows = (await sql`select * from review_cases where post is not null order by added_at`) as ReviewCase[];
const cases = rows.filter((c) => c.expect !== "-" && (!only || c.url === only));

const got = new Map<string, { got: string[]; auto: boolean }>();
for (const c of cases) {
  const p = c.post!;
  const r = await resolvePost(p.kind, p).catch((e) => {
    console.error(`${c.url}: ${e instanceof Error ? e.message : e}`);
    return { candidates: [], source: null };
  });
  // The phone saves by itself when a trusted search finds exactly one place; the web the same.
  got.set(c.url, { got: r.candidates.map((x) => x.name), auto: r.source === "tag" && r.candidates.length === 1 });
  console.error(`${got.size}/${cases.length} ${r.candidates[0]?.name ?? "(nothing)"}`);
}
console.log(JSON.stringify(score(cases, got), null, 1));
