/** The one intermediate shape every input (arguments, markdown, an existing .docx) is turned into. */
export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "para"; text: string }
  | { type: "bullets"; items: string[]; ordered: boolean; levels?: number[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string };

/** Inline runs: bold, italic and monospace inside a paragraph. */
export interface Run { text: string; bold?: boolean; italic?: boolean; mono?: boolean }

/**
 * Parse **bold**, *italic* / _italic_ and `code` into runs. Unmatched markers stay literal.
 *
 * Underscore italics use CommonMark's left/right-flanking rule so intraword underscores
 * (e.g. late_fee_percent) are left alone: an opening `_` must not be preceded by a word
 * character (start of text, whitespace or punctuation counts) and must be immediately
 * followed by a non-space character; a closing `_` must be immediately preceded by a
 * non-space character and must not be followed by a word character (whitespace,
 * punctuation or end of text counts). Asterisk italics keep the simpler "no adjacent
 * space" rule, so *this* still works intraword.
 */
export function inlineRuns(text: string): Run[] {
  const out: Run[] = [];
  const re =
    /(?<boldMark>\*\*|__)(?<boldText>.+?)\k<boldMark>|\*(?!\s)(?<astItalic>.+?)(?<!\s)\*|(?<!\w)_(?!\s)(?<underItalic>.+?)(?<!\s)_(?!\w)|`(?<code>[^`]+)`/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const g = m.groups!;
    if (g.boldText !== undefined) out.push({ text: g.boldText, bold: true });
    else if (g.astItalic !== undefined) out.push({ text: g.astItalic, italic: true });
    else if (g.underItalic !== undefined) out.push({ text: g.underItalic, italic: true });
    else out.push({ text: g.code!, mono: true });
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
