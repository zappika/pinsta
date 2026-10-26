import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sends } from "@/lib/db/schema";
import { countLabel } from "@/lib/sends";

// The link preview in WhatsApp / iMessage: the title, who sent it, and the first photos.
export const alt = "Places sent with Vicolo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const [row] = await getDb().select().from(sends).where(eq(sends.id, (await params).id)).limit(1);
  const photos = (row?.stops ?? []).map((s) => s.imageUrl).filter((u): u is string => !!u).slice(0, 4);
  const what = row ? (countLabel(row.kind, row.stops.length)) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f5f5f4", padding: 64, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ fontSize: 30, color: "#78716c" }}>{row?.from ? `From ${row.from} · ${what}` : what}</div>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#1c1917", letterSpacing: -2, lineHeight: 1.05, marginTop: 16 }}>{row?.title ?? "Vicolo"}</div>
          <div style={{ fontSize: 30, color: "#a8a29e", marginTop: 28 }}>Vicolo</div>
        </div>
        {photos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", width: 500, gap: 16, alignContent: "center" }}>
            {photos.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} width={photos.length === 1 ? 500 : 242} height={photos.length <= 2 ? 500 : 242} style={{ objectFit: "cover", borderRadius: 28 }} alt="" />
            ))}
          </div>
        )}
      </div>
    ),
    size,
  );
}
