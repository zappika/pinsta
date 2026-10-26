import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { sends } from "@/lib/db/schema";
import { countLabel } from "@/lib/sends";
import SendPage from "../../components/SendPage";

// A send is public by its unguessable id (lib/sends.ts); never listed, never indexed.
const load = cache(async (id: string) => {
  const [row] = await getDb().select().from(sends).where(eq(sends.id, id)).limit(1);
  return row ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const row = await load((await params).id);
  if (!row) return { title: "Vicolo" };
  const what = countLabel(row.kind, row.stops.length);
  return {
    title: `${row.title} · Vicolo`,
    description: [row.from ? `From ${row.from}` : null, what, row.stops.map((s) => s.name).join(", ")].filter(Boolean).join(" · "),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const row = await load((await params).id);
  if (!row) notFound();
  return <SendPage kind={row.kind} title={row.title} from={row.from} stops={row.stops} />;
}
