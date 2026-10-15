import type { Metadata } from "next";
import { renderMarkdownFile } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "What's new · Vicolo",
  description: "What changed in each Vicolo build.",
};

// Built from changelog.md at deploy time. Public, for testers: the app's menu → What's new opens it.
export const dynamic = "force-static";

export default function Changelog() {
  return <main className="mx-auto max-w-xl px-5 py-12 text-stone-800 leading-relaxed">{renderMarkdownFile("changelog.md")}</main>;
}
