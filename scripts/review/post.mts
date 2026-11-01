// Stores a review (lib/db/schema.ts → reviews) for /review on the backoffice. Straight into the
// database from this Mac, so production is never polled.
//   npm run review:post -- report.json   (a ReviewReport plus passed/total)
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import type { ReviewReport } from "../../lib/db/schema";

const r = JSON.parse(readFileSync(process.argv[2], "utf8")) as ReviewReport & { passed: number; total: number };
if (typeof r.summary !== "string" || !Array.isArray(r.results) || !Array.isArray(r.causes)) throw new Error("not a review report");
const { passed, total, ...report } = r;
const sql = neon(process.env.DATABASE_URL!);
const [row] = await sql`insert into reviews (passed, total, report) values (${passed}, ${total}, ${JSON.stringify(report)}::jsonb) returning id`;
console.log(`review ${row.id} stored: ${passed}/${total}`);
