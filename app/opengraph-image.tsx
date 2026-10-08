import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The share card for vicolo.space links (iMessage, WhatsApp, etc.).
export const alt = "Vicolo — save the places you find to your own map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const png = await readFile(join(process.cwd(), "public/brand/elephant-resin.png"));
  const src = `data:image/png;base64,${png.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#f5f5f4", padding: "0 96px", gap: 64 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={320} height={320} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 112, fontWeight: 700, color: "#1c1917", letterSpacing: -3 }}>Vicolo</div>
          <div style={{ fontSize: 40, color: "#57534e", marginTop: 12, maxWidth: 620, lineHeight: 1.3 }}>
            Save the places you find to your own map.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
