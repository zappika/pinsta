import type { Metadata } from "next";
import { renderMarkdownFile } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Parity · Vicolo",
  description: "What the web and iOS apps each have.",
};

// parity.md as a page (backoffice). Built at deploy time, so it is as current as the file.
export const dynamic = "force-static";

export default function Parity() {
  return <main className="mx-auto max-w-4xl px-5 py-12 text-stone-800 leading-relaxed">{renderMarkdownFile("parity.md")}</main>;
}
