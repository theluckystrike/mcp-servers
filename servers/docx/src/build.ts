import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { inlineRuns, type Block, type Run } from "./blocks.js";
import type { Business } from "./store.js";

export type DocStyle = "plain" | "letter" | "proposal";

const NUM_REF = "mcp-docx-ordered";
const BRAND = "Generated with mcp-docx by theluckystrike";
const DEFAULT_ACCENT = "1F3864";

function accent(business: Business, pro: boolean): string {
  const c = pro && business.brand_color ? business.brand_color.replace(/^#/, "").trim() : "";
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : DEFAULT_ACCENT;
}

function runs(rs: Run[], base: { size?: number; color?: string } = {}): TextRun[] {
  return rs.map((r) => new TextRun({
    text: r.text, bold: r.bold, italics: r.italic,
    font: r.mono ? "Consolas" : undefined,
    size: base.size, color: base.color,
  }));
}

function textPara(text: string, opts: Record<string, unknown> = {}): Paragraph {
  // Word has no newline inside a run: split on \n and use explicit breaks.
  const parts = text.split("\n");
  const children: TextRun[] = [];
  parts.forEach((p, i) => {
    for (const r of inlineRuns(p)) {
      children.push(new TextRun({ text: r.text, bold: r.bold, italics: r.italic, font: r.mono ? "Consolas" : undefined, break: i > 0 && children.length === 0 ? undefined : undefined }));
    }
    if (i < parts.length - 1) children.push(new TextRun({ text: "", break: 1 }));
  });
  return new Paragraph({ children, ...opts });
}

const HEADINGS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

function tableOf(b: Extract<Block, { type: "table" }>, color: string): Table {
  const cell = (text: string, head: boolean) => new TableCell({
    shading: head ? { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: runs(inlineRuns(text)).map((r, i) => r) , ...(head ? {} : {}) })],
  });
  const headRow = new TableRow({
    tableHeader: true,
    children: b.headers.map((h) => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color })] })],
    })),
  });
  const width = b.headers.length;
  const body = b.rows.map((r) => new TableRow({
    children: Array.from({ length: width }, (_, i) => cell(r[i] ?? "", false)),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headRow, ...body],
  });
}

function blockChildren(blocks: Block[], color: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(new Paragraph({
          heading: HEADINGS[Math.min(6, Math.max(1, b.level))],
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: b.text, color })],
        }));
        break;
      case "para":
        out.push(textPara(b.text, { spacing: { after: 140 } }));
        break;
      case "bullets":
        for (const item of b.items) {
          out.push(new Paragraph({
            children: runs(inlineRuns(item)),
            spacing: { after: 60 },
            ...(b.ordered ? { numbering: { reference: NUM_REF, level: 0 } } : { bullet: { level: 0 } }),
          }));
        }
        break;
      case "table":
        out.push(tableOf(b, color));
        out.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        break;
      case "code":
        for (const line of b.text.split("\n")) {
          out.push(new Paragraph({
            children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
            shading: { type: ShadingType.CLEAR, fill: "F5F5F5", color: "auto" },
            spacing: { after: 0 },
          }));
        }
        out.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        break;
    }
  }
  return out;
}

function logoRun(business: Business, pro: boolean): ImageRun | null {
  if (!pro || !business.logo_path || !existsSync(business.logo_path)) return null;
  const ext = extname(business.logo_path).toLowerCase();
  const type = ext === ".jpg" || ext === ".jpeg" ? "jpg" : ext === ".gif" ? "gif" : "png";
  try {
    return new ImageRun({
      type: type as "png" | "jpg" | "gif",
      data: readFileSync(business.logo_path),
      transformation: { width: 90, height: 90 },
    });
  } catch { return null; }
}

export interface BuildOptions {
  title: string;
  blocks: Block[];
  style?: DocStyle;
  business: Business;
  pro: boolean;
  date?: string;
  recipient?: string;
}

export async function buildDocx(o: BuildOptions): Promise<Buffer> {
  const style: DocStyle = o.style ?? "plain";
  const color = accent(o.business, o.pro);
  const head: (Paragraph | Table)[] = [];
  const biz = o.business;
  const logo = logoRun(biz, o.pro);

  if (biz.name && style !== "plain") {
    if (logo) head.push(new Paragraph({ children: [logo], alignment: AlignmentType.RIGHT }));
    head.push(new Paragraph({
      alignment: style === "letter" ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: biz.name, bold: true, size: 26, color })],
    }));
    const meta = [biz.address, biz.email, biz.vat_id ? `VAT ${biz.vat_id}` : ""].filter(Boolean).join("\n");
    if (meta) {
      head.push(textPara(meta, {
        alignment: style === "letter" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { after: 200 },
      }));
    }
    head.push(new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 1 } },
      children: [],
    }));
  }
  if (style === "letter") {
    if (o.date) head.push(new Paragraph({ text: o.date, alignment: AlignmentType.RIGHT, spacing: { after: 200 } }));
    if (o.recipient) head.push(textPara(o.recipient, { spacing: { after: 240 } }));
    head.push(new Paragraph({ children: [new TextRun({ text: o.title, bold: true })], spacing: { after: 200 } }));
  } else {
    head.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: style === "proposal" ? 80 : 240 },
      children: [new TextRun({ text: o.title, bold: true, size: 40, color })],
    }));
    if (style === "proposal" && (o.recipient || o.date)) {
      head.push(textPara([o.recipient ? `Prepared for ${o.recipient}` : "", o.date ?? ""].filter(Boolean).join("   |   "),
        { spacing: { after: 280 } }));
    }
  }

  const doc = new Document({
    creator: biz.name || "mcp-docx",
    title: o.title,
    description: `Created with mcp-docx`,
    numbering: {
      config: [{
        reference: NUM_REF,
        levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: o.pro ? undefined : {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: BRAND, size: 16, color: "888888" })],
          })],
        }),
      },
      children: [...head, ...blockChildren(o.blocks, color)],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/* --------------------------------------------------------------------- HTML */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml(text: string): string {
  return inlineRuns(text).map((r) => {
    const t = esc(r.text).replace(/\n/g, "<br>");
    if (r.mono) return `<code>${t}</code>`;
    if (r.bold) return `<strong>${t}</strong>`;
    if (r.italic) return `<em>${t}</em>`;
    return t;
  }).join("");
}

/** Semantic HTML with a print stylesheet: open it in a browser and print to PDF. */
export function toHtml(title: string, blocks: Block[]): string {
  const body: string[] = [];
  for (const b of blocks) {
    if (b.type === "heading") body.push(`<h${Math.min(6, b.level)}>${inlineHtml(b.text)}</h${Math.min(6, b.level)}>`);
    else if (b.type === "para") body.push(`<p>${inlineHtml(b.text)}</p>`);
    else if (b.type === "code") body.push(`<pre>${esc(b.text)}</pre>`);
    else if (b.type === "bullets") {
      const tag = b.ordered ? "ol" : "ul";
      body.push(`<${tag}>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</${tag}>`);
    } else {
      body.push(
        `<table><thead><tr>${b.headers.map((h) => `<th>${inlineHtml(h)}</th>`).join("")}</tr></thead>` +
        `<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
    }
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 16px/1.55 Calibri, "Segoe UI", system-ui, sans-serif; color: #111; max-width: 46em; margin: 3em auto; padding: 0 1.5em; }
  h1 { font-size: 1.9em; margin: 0 0 .6em; }
  h2 { font-size: 1.35em; margin: 1.6em 0 .4em; }
  h3 { font-size: 1.12em; margin: 1.3em 0 .3em; }
  p { margin: 0 0 .8em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: .45em .6em; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  pre { background: #f5f5f5; padding: .8em; overflow-x: auto; font: 13px/1.45 Consolas, monospace; }
  code { font: 0.92em Consolas, monospace; }
  @media print { body { margin: 0; max-width: none; font-size: 11pt; } h2, h3 { page-break-after: avoid; } table, pre { page-break-inside: avoid; } }
</style></head>
<body>
${body.join("\n")}
</body></html>
`;
}
