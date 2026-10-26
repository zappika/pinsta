// One-off: creates the `sends` table (lib/db/schema.ts) without drizzle-kit push, which also
// rewrites other tables' keys. Additive only: IF NOT EXISTS, nothing else touched.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
await sql`CREATE TABLE IF NOT EXISTS sends (
  id text PRIMARY KEY,
  kind text NOT NULL,
  title text NOT NULL,
  "from" text,
  stops jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
console.log("sends: ready");
