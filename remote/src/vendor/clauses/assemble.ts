/**
 * Turning a selection of clauses into a document, as pure functions over the block model
 * of @theluckystrike/mcp-docx. The .docx writer itself lives in the docx server; this file
 * only decides what goes on the page and in what order.
 */
import type { Block } from "../docx/lib.js";
import type { Clause } from "./store.js";
import { DISCLAIMER, clauseVariables, fillVariables, promptFor } from "./library.js";

export interface AssembleInput {
  title: string;
  clauses: Clause[];
  values: Record<string, string>;
  client?: string;
}

export interface AssembleResult {
  blocks: Block[];
  markdown: string;
  filled: string[];
  /** Variables no value was given for. Each appears in the document as [name]. */
  unfilled: string[];
}

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}

export function assemble(o: AssembleInput): AssembleResult {
  // `client` is a convenience alias for the {{client}} variable; an explicit value wins.
  const values: Record<string, string> = { ...(o.client ? { client: o.client } : {}), ...o.values };
  const filled: string[] = [];
  const unfilled: string[] = [];

  const blocks: Block[] = [
    { type: "heading", level: 1, text: o.title },
    { type: "para", text: DISCLAIMER },
  ];
  const md: string[] = [`# ${o.title}`, "", DISCLAIMER, ""];
  if (o.client) {
    blocks.push({ type: "para", text: `Client: ${o.client}` });
    md.push(`Client: ${o.client}`, "");
  }

  o.clauses.forEach((c, i) => {
    const heading = `${i + 1}. ${c.title}`;
    blocks.push({ type: "heading", level: 2, text: heading });
    md.push(`## ${heading}`, "");
    for (const p of paragraphs(c.body)) {
      const r = fillVariables(p, values);
      for (const v of r.filled) if (!filled.includes(v)) filled.push(v);
      for (const v of r.unfilled) if (!unfilled.includes(v)) unfilled.push(v);
      blocks.push({ type: "para", text: r.text });
      md.push(r.text, "");
    }
  });

  if (unfilled.length) {
    blocks.push({ type: "heading", level: 2, text: "Open items" });
    blocks.push({ type: "para", text: "Each bracketed item below is a fact this document still needs. Replace every one before signing." });
    blocks.push({ type: "bullets", ordered: false, items: unfilled.map(promptFor) });
    md.push("## Open items", "", "Each bracketed item below is a fact this document still needs. Replace every one before signing.", "");
    for (const v of unfilled) md.push(`- ${promptFor(v)}`);
    md.push("");
  }

  return { blocks, markdown: md.join("\n"), filled, unfilled };
}

/** Every variable the given clauses use, with whether a value was supplied. */
export function variableReport(clauses: Clause[], values: Record<string, string>): { variable: string; value?: string; clauses: string[] }[] {
  const map = new Map<string, string[]>();
  for (const c of clauses) {
    for (const v of clauseVariables(c)) {
      const list = map.get(v) ?? [];
      list.push(c.id);
      map.set(v, list);
    }
  }
  return [...map.entries()].map(([variable, ids]) => ({
    variable,
    value: values[variable],
    clauses: ids,
  }));
}
