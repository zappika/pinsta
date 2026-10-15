import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

/**
 * Just enough Markdown for the repo's own notes (changelog.md, parity.md): headings,
 * paragraphs, "- " lists, pipe tables, and inline `code`, **bold** and [links](url).
 * HTML comments are notes for whoever edits the file and are dropped. Read at build
 * time: the pages are static, so a push that edits the file is what updates them.
 */
export function renderMarkdownFile(name: string): ReactNode[] {
  return renderMarkdown(readFileSync(join(/*turbopackIgnore: true*/ process.cwd(), name), "utf8"));
}

export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const key = out.length;
    if (!line) {
      i++;
    } else if (line.startsWith("#")) {
      const level = line.match(/^#+/)![0].length;
      const text = inline(line.slice(level).trim());
      if (level === 1) out.push(<h1 key={key} className="text-2xl font-semibold text-stone-900">{text}</h1>);
      else if (level === 2) out.push(<h2 key={key} className="mt-10 text-lg font-semibold text-stone-900">{text}</h2>);
      else out.push(<h3 key={key} className="mt-6 font-semibold text-stone-900">{text}</h3>);
      i++;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) items.push(lines[i++].trim().slice(2));
      out.push(
        <ul key={key} className="mt-3 list-disc space-y-2 pl-5">
          {items.map((t, n) => <li key={n}>{inline(t)}</li>)}
        </ul>,
      );
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      const [head, ...body] = rows;
      out.push(
        // A wide table scrolls on its own; the page never does.
        <div key={key} className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr>{head.map((c, n) => <th key={n} className="border-b border-stone-300 px-2 py-2 align-bottom font-semibold text-stone-900">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, n) => (
                <tr key={n}>{r.map((c, m) => <td key={m} className={`border-b border-stone-200 px-2 py-2 align-top ${m === 0 ? "font-medium text-stone-900" : ""}`}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#|- |\|)/.test(lines[i].trim())) para.push(lines[i++].trim());
      out.push(<p key={key} className="mt-4">{inline(para.join(" "))}</p>);
    }
  }
  return out;
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, n) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={n} className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**")) return <strong key={n}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={n} href={link[2]} className="underline underline-offset-2">{link[1]}</a>;
    return part;
  });
}
