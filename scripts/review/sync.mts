// The search's regression set, brought up to date from the phones' save reports (lib/db/schema.ts →
// reviewCases). Every Instagram/TikTok save with a link becomes a case: the place it ended on is
// what the search should find (the saved place, even when it was found alone: those cases guard
// against a fix breaking what works). A gave-up has no answer until Sarp types one on /review.
// New links are read once through Apify (counted in Usage) and cached; nothing is re-read.
//   npm run review:sync
import { neon } from "@neondatabase/serverless";
import { fetchInstagramPost } from "../../lib/instagram-post";
import { fetchInstagramProfile } from "../../lib/instagram-profile";
import { fetchTikTokPost } from "../../lib/tiktok";
import { parseSourceUrl } from "../../lib/sources";
import type { CasePost, SaveDetail } from "../../lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
type Row = { url: string; outcome: string; detail: SaveDetail; at: string };
const saves = (await sql`select url, outcome, detail, at from saves where url is not null order by at`) as Row[];
const known = new Map(((await sql`select url, expect, post, note from review_cases`) as { url: string; expect: string | null; post: CasePost | null; note: string | null }[]).map((c) => [c.url, c]));

// One case per post: the latest save that ended on a place wins; a gave-up only stands alone.
const byUrl = new Map<string, Row>();
for (const s of saves) {
  const src = parseSourceUrl(s.url);
  if (!src || src.kind === "google") continue;
  if (s.outcome === "already") continue;
  const prev = byUrl.get(src.url);
  if (!prev || s.detail.place || !prev.detail.place) byUrl.set(src.url, s);
}

let added = 0, read = 0, failed = 0;
for (const [url, s] of byUrl) {
  const c = known.get(url);
  const expect = s.detail.place ?? null;
  if (!c) {
    await sql`insert into review_cases (url, expect, google, outcome) values (${url}, ${expect}, ${s.detail.google === true}, ${s.outcome})`;
    added++;
  } else if (expect && !c.expect) {
    // Someone saved a post that was a gave-up before: their answer fills it in.
    await sql`update review_cases set expect = ${expect}, google = ${s.detail.google === true}, outcome = ${s.outcome} where url = ${url}`;
  }
  if (c?.post || c?.note?.startsWith("gone")) continue;
  try {
    await sql`update review_cases set post = ${JSON.stringify(await readPost(url))}::jsonb, note = null where url = ${url}`;
    read++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A deleted or private post won't come back: don't pay to read it again.
    const gone = /does not exist|not found|not public/i.test(msg);
    await sql`update review_cases set note = ${(gone ? "gone: " : "read failed: ") + msg.slice(0, 160)} where url = ${url}`;
    failed++;
  }
}
console.log(JSON.stringify({ cases: byUrl.size, added, read, failed }));

async function readPost(url: string): Promise<CasePost> {
  const kind = parseSourceUrl(url)!.kind;
  if (kind === "profile") {
    const p = await fetchInstagramProfile(url);
    return { kind, locationName: p.locationName, caption: p.biography, ownerFullName: p.fullName, ownerUsername: p.username, coauthors: [], hashtags: [], category: p.category, city: null };
  }
  if (kind === "tiktok") {
    const p = await fetchTikTokPost(url);
    return { kind, locationName: p.locationName, caption: p.caption, ownerFullName: p.ownerFullName, ownerUsername: p.ownerUsername, coauthors: [], hashtags: p.hashtags, category: null, city: p.locationCity };
  }
  const p = await fetchInstagramPost(url);
  return { kind: "instagram", locationName: p.locationName, caption: p.caption, ownerFullName: p.ownerFullName, ownerUsername: p.ownerUsername, coauthors: p.coauthors, hashtags: p.hashtags, category: null, city: null };
}
