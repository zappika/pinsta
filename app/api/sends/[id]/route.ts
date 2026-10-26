import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sends } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner";

/** Deleting a send from Sent: the link stops working. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const locked = requireOwner(req);
  if (locked) return locked;
  const { id } = await params;
  await getDb().delete(sends).where(eq(sends.id, id));
  return NextResponse.json({ ok: true });
}
