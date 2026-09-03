import type { Block } from "./blocks.js";

/** Markdown to blocks: ATX headings, paragraphs, bullet and numbered lists, GFM pipe tables, fenced code. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) { out.push({ type: "para", text: para.join(" ").trim() }); para = []; }
  };
  const isTableRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
  const cells = (s: string) => s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      out.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push({ type: "heading", level: h[1].length, text: h[2].trim() }); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); continue; }
    // GFM table: a header row followed by a --- separator row
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flush();
      const headers = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      i--;
      out.push({ type: "table", headers, rows });
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const ordered = !!ol;
      const item = (ul ?? ol)![1].trim();
      const prev = out[out.length - 1];
      if (prev && prev.type === "bullets" && prev.ordered === ordered) prev.items.push(item);
      else out.push({ type: "bullets", items: [item], ordered });
      continue;
    }
    if (/^\s*>\s?/.test(line)) { para.push(line.replace(/^\s*>\s?/, "")); continue; }
    para.push(line.trim());
  }
  flush();
  return out;
}
