// One-off: creates `review_cases` and `reviews` (lib/db/schema.ts) without drizzle-kit push, which also
// rewrites other tables' keys. Additive only: IF NOT EXISTS, nothing else touched.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
await sql`CREATE TABLE IF NOT EXISTS review_cases (
  url text PRIMARY KEY,
  expect text,
  google boolean NOT NULL DEFAULT false,
  outcome text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  post jsonb,
  note text
)`;
await sql`CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  passed integer NOT NULL,
  total integer NOT NULL,
  report jsonb NOT NULL
)`;
console.log("review_cases, reviews: ready");
