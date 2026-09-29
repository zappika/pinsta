import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Pinsta",
  description: "Save places from Instagram posts to your map.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
