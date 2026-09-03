/** The one intermediate shape every input (arguments, markdown, an existing .docx) is turned into. */
export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "para"; text: string }
  | { type: "bullets"; items: string[]; ordered: boolean; levels?: number[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string };

/** Inline runs: bold, italic and monospace inside a paragraph. */
export interface Run { text: string; bold?: boolean; italic?: boolean; mono?: boolean }

/** Parse **bold**, *italic* / _italic_ and `code` into runs. Unmatched markers stay literal. */
export function inlineRuns(text: string): Run[] {
  const out: Run[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|`([^`]+)`/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) out.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) out.push({ text: m[4], italic: true });
    else out.push({ text: m[5], mono: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

/** Plain text of a block, used by doc_read and by the free-tier text response. */
export function blockText(b: Block): string {
  switch (b.type) {
    case "heading": return b.text;
    case "para": return b.text;
    case "code": return b.text;
    case "bullets": return b.items.join("\n");
    case "table": return [b.headers.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("\n");
  }
}
