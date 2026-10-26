import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sends } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";
import { googlePhoto } from "@/lib/photo";
import { SEND_MAX, cleanStop, newSendId } from "@/lib/sends";

// A stop not in the list yet gets Google's photo here (a few seconds each, in parallel).
export const maxDuration = 60;

/** Sent: every send, newest first (the buddy menu's history). */
export async function GET(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const rows = await getDb().select().from(sends).orderBy(desc(sends.createdAt));
  return NextResponse.json({ sends: rows });
}

/** Makes a send: a copy of the stops, behind /w/<id>. Only what's in the body goes out. */
export async function POST(req: Request) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const raw = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const kind = raw.kind === "walk" ? "walk" : "list";
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : null;
  const from = typeof raw.from === "string" && raw.from.trim() ? raw.from.trim().slice(0, 40) : null;
  const stops = (Array.isArray(raw.stops) ? raw.stops : []).map(cleanStop).filter((s) => s !== null).slice(0, SEND_MAX);
  if (!title || stops.length === 0) return NextResponse.json({ error: "A title and at least one place" }, { status: 400 });

  const id = newSendId();
  // A place never goes without a photo, on her page too.
  await Promise.all(
    stops.map(async (s, i) => {
      if (!s.imageUrl && s.placeId) s.imageUrl = await googlePhoto(s.placeId, `send-${id}-${i}`).catch(() => null);
    }),
  );
  await getDb().insert(sends).values({ id, kind, title, from, stops });
  return NextResponse.json({ id });
}
