// The worked credit note, every figure recomputed by hand and asserted to the minor unit.
//
// 3 x 2499 @ 23% = 7497 + 1724 tax; 1 x 999 @ 23% = 999 + 230; 1 x 1200 @ 0% = 1200.
// Subtotal 9696, tax 1954, total 11650. The 23% base is 8496, never the full 9696.
// The lifecycle: draft -> revise -> finalize -> immutable, and the eleventh finalize on
// the free tier is the one that is refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, storeDir, WORKED, WORKED_SUBTOTAL, WORKED_TAX, WORKED_TOTAL, WORKED_TAX_BASE_23, HALF_LINE, HALF_GROSS } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

async function workedDraft(t, opts = {}) {
  const { box, c } = open(t, opts);
  await c.init();
  const r = await c.json("credit_note_create", WORKED);
  assert.ok(r.created, JSON.stringify(r).slice(0, 400));
  return { box, c, draft: r.created };
}

test("the worked note computes to the minor unit: subtotal 9696, tax 1954, total 11650", async (t) => {
  const { draft } = await workedDraft(t);
  assert.equal(draft.status, "draft");
  assert.equal(draft.number, null, "a draft has no final number");
  assert.match(draft.id, /^CN-DRAFT-\d{4}-\d{4}$/);
  assert.equal(draft.subtotal_minor, WORKED_SUBTOTAL);
  assert.equal(draft.tax_minor, WORKED_TAX);
  assert.equal(draft.total_minor, WORKED_TOTAL);
  assert.equal(draft.total, "EUR 116.50");
  assert.deepEqual(draft.lines.map((l) => [l.gross_minor, l.tax_minor, l.total_minor]), [
    [7497, 1724, 9221],
    [999, 230, 1229],
    [1200, 0, 1200],
  ]);
  // The 23% tax line is on the 23% base alone: 8496, not the whole subtotal.
  assert.deepEqual(draft.tax_lines, [
    { rate: 0, base_minor: 1200, tax_minor: 0, base: "EUR 12.00", tax: "EUR 0.00" },
    { rate: 23, base_minor: WORKED_TAX_BASE_23, tax_minor: 1954, base: "EUR 84.96", tax: "EUR 19.54" },
  ]);
});

test("2.5 x 3333 rounds half-up to 8333 on the gross, never banker's rounding", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.json("credit_note_create", {
    recipient: "Beta BV", reason: "overcharge", currency: "EUR",
    lines: [HALF_LINE],
  });
  assert.equal(r.created.lines[0].gross_minor, HALF_GROSS);
  assert.equal(r.created.total_minor, HALF_GROSS);
});

test("finalize burns the CN number, freezes the note, and the series has no gap from a deleted draft", async (t) => {
  const { c, draft } = await workedDraft(t);
  // A second draft, deleted: its draft number is burned and never reissued, and the
  // final series does not see it at all.
  const d2 = (await c.json("credit_note_create", { ...WORKED, duplicate_ok: true })).created;
  assert.notEqual(d2.id, draft.id);
  const del = await c.json("credit_note_delete", { id: d2.id });
  assert.equal(del.deleted.id, d2.id);

  const fin = await c.json("credit_note_finalize", { id: draft.id });
  assert.equal(fin.finalized.status, "final");
  assert.equal(fin.finalized.number, "CN-2026-0001", "the number comes from the issue-date year");
  assert.ok(fin.finalized.finalized_at);

  const d3 = (await c.json("credit_note_create", { ...WORKED, duplicate_ok: true })).created;
  const fin3 = await c.json("credit_note_finalize", { id: d3.id });
  assert.equal(fin3.finalized.number, "CN-2026-0002", "the deleted draft left no gap in the final series");
  // The draft ids did not reuse the deleted one's number either.
  assert.equal(d3.id, "CN-DRAFT-" + draft.id.slice(9, 13) + "-0003");

  // The finalized note refuses edits and deletion, by name.
  const up = await c.call("credit_note_update", { id: "CN-2026-0001", recipient: "Someone Else" });
  assert.equal(up.isError, true);
  assert.match(up.text, /CN-2026-0001 is finalized and cannot be edited/);
  const delFinal = await c.call("credit_note_delete", { id: "CN-2026-0001" });
  assert.equal(delFinal.isError, true);
  assert.match(delFinal.text, /CN-2026-0001 is finalized and cannot be deleted/);
  // Finalizing twice is refused too.
  const again = await c.call("credit_note_finalize", { id: "CN-2026-0001" });
  assert.equal(again.isError, true);
  assert.match(again.text, /already finalized/);
});

test("update revises a draft and recomputes the totals; null detaches the invoice reference", async (t) => {
  const { c, draft } = await workedDraft(t);
  const r = await c.json("credit_note_update", {
    id: draft.id,
    recipient: "Acme GmbH & Co. KG",
    lines: [{ description: "Returned: USB-C cable", quantity: 2, unit_price_minor: 2499, tax_rate: 23 }],
    invoice_ref: null,
  });
  assert.equal(r.updated.recipient, "Acme GmbH & Co. KG");
  assert.equal(r.updated.invoice_ref, null);
  // 2 x 2499 = 4998; tax round(4998*0.23) = round(1149.54) = 1150.
  assert.equal(r.updated.subtotal_minor, 4998);
  assert.equal(r.updated.tax_minor, 1150);
  assert.equal(r.updated.total_minor, 6148);
  assert.equal(r.updated.lines.length, 1, "the new line set replaced the old one");
  assert.ok(Date.parse(r.updated.updated) >= Date.parse(draft.updated));
});

test("a byte-identical duplicate is refused, and duplicate_ok lets a genuinely repeated credit through", async (t) => {
  const { c } = await workedDraft(t);
  const dup = await c.call("credit_note_create", WORKED);
  assert.equal(dup.isError, true);
  assert.match(dup.text, /is already this credit note, to the byte/);
  assert.match(dup.text, /Nothing was written/);
  const ok2 = await c.call("credit_note_create", { ...WORKED, duplicate_ok: true });
  assert.equal(ok2.isError, false, ok2.text);
  const list = await c.json("credit_note_list", {});
  assert.equal(list.count, 2);
});

test("validation refuses a zero-total note, a future date, and a fantasy date, all without writing", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const zero = await c.call("credit_note_create", {
    recipient: "Zero Ltd", reason: "other", currency: "EUR",
    lines: [{ description: "Free sample", quantity: 1, unit_price_minor: 0 }],
  });
  assert.equal(zero.isError, true);
  assert.match(zero.text, /credit a total of zero/);
  const future = await c.call("credit_note_create", {
    recipient: "Future Ltd", reason: "other", currency: "EUR", issue_date: "2999-01-01",
    lines: [{ description: "Work", quantity: 1, unit_price_minor: 100 }],
  });
  assert.equal(future.isError, true);
  assert.match(future.text, /after today/);
  const fantasy = await c.call("credit_note_create", {
    recipient: "Fantasy Ltd", reason: "other", currency: "EUR", issue_date: "2026-02-30",
    lines: [{ description: "Work", quantity: 1, unit_price_minor: 100 }],
  });
  assert.equal(fantasy.isError, true);
  assert.match(fantasy.text, /not a real date/);
  const badCurrency = await c.call("credit_note_create", {
    recipient: "Fx Ltd", reason: "other", currency: "EURO",
    lines: [{ description: "Work", quantity: 1, unit_price_minor: 100 }],
  });
  assert.equal(badCurrency.isError, true);
  // And a line that overflows one line's ceiling.
  const huge = await c.call("credit_note_create", {
    recipient: "Huge Ltd", reason: "other", currency: "EUR",
    lines: [{ description: "The moon", quantity: 1e6, unit_price_minor: 1e14 }],
  });
  assert.equal(huge.isError, true);
  assert.match(huge.text, /more than one line can credit/);
  assert.equal(existsSync(join(storeDir(box.dataHome), "notes.json")), false, "a refused create wrote the store");
});

test("list filters by recipient part, reason, status and period", async (t) => {
  const { c, draft } = await workedDraft(t);
  await c.call("credit_note_create", {
    recipient: "Beta BV", reason: "overcharge", currency: "USD", issue_date: "2026-04-11",
    lines: [{ description: "Billed 10 seats, used 7", quantity: 3, unit_price_minor: 1500 }],
  });
  await c.json("credit_note_finalize", { id: draft.id });

  const all = await c.json("credit_note_list", {});
  assert.equal(all.count, 2);
  assert.deepEqual(all.credit_notes.map((n) => n.recipient), ["Acme GmbH", "Beta BV"], "sorted by issue date");

  const acme = await c.json("credit_note_list", { recipient: "acme" });
  assert.equal(acme.count, 1);
  assert.equal(acme.credit_notes[0].total_minor, WORKED_TOTAL);

  const over = await c.json("credit_note_list", { reason: "overcharge" });
  assert.equal(over.count, 1);
  assert.equal(over.credit_notes[0].currency, "USD");

  const drafts = await c.json("credit_note_list", { status: "draft" });
  assert.equal(drafts.count, 1);
  assert.equal(drafts.credit_notes[0].recipient, "Beta BV");
  const finals = await c.json("credit_note_list", { status: "final" });
  assert.equal(finals.count, 1);
  assert.equal(finals.credit_notes[0].number, "CN-2026-0001");

  const march = await c.json("credit_note_list", { from: "2026-03-01", to: "2026-03-31" });
  assert.equal(march.count, 1);
  const may = await c.json("credit_note_list", { from: "2026-05-01" });
  assert.equal(may.count, 0);
  const swapped = await c.call("credit_note_list", { from: "2026-05-01", to: "2026-03-01" });
  assert.equal(swapped.isError, true);
});

test("get reads one note in full by final number, by draft id, and by exact recipient", async (t) => {
  const { c, draft } = await workedDraft(t);
  await c.json("credit_note_finalize", { id: draft.id });
  const byNumber = await c.json("credit_note_get", { id: "cn-2026-0001" });
  assert.equal(byNumber.credit_note.recipient, "Acme GmbH", "number lookup is case-insensitive");
  const byDraftId = await c.json("credit_note_get", { id: draft.id });
  assert.equal(byDraftId.credit_note.number, "CN-2026-0001", "the draft id keeps resolving after finalize");
  const byName = await c.json("credit_note_get", { id: "Acme GmbH" });
  assert.equal(byName.credit_note.total_minor, WORKED_TOTAL);
  const missing = await c.call("credit_note_get", { id: "CN-2026-9999" });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /credit_note_list/);
});

test("render: Markdown has the table and the totals; HTML is self-contained; a draft carries the banner", async (t) => {
  const { c, draft } = await workedDraft(t);

  const mdDraft = await c.call("credit_note_render", { id: draft.id });
  assert.equal(mdDraft.isError, false);
  assert.match(mdDraft.text, /DRAFT - not issued/);
  assert.match(mdDraft.text, /\| Returned: USB-C cable \| 3 \| 24\.99 \| 23% \| 74\.97 \|/);
  assert.match(mdDraft.text, /\*\*Subtotal:\*\* EUR 96\.96/);
  assert.match(mdDraft.text, /\*\*Tax 23% on 84\.96:\*\* EUR 19\.54/);
  assert.match(mdDraft.text, /\*\*Total credited:\*\* EUR 116\.50/);
  assert.match(mdDraft.text, /\*\*Against invoice:\*\* INV-2026-0042/);
  assert.match(mdDraft.text, /Generated with mcp-credit-note by theluckystrike/, "free tier stamps the footer");

  await c.json("credit_note_finalize", { id: draft.id });
  const md = await c.call("credit_note_render", { id: "CN-2026-0001" });
  assert.match(md.text, /# CREDIT NOTE CN-2026-0001/);
  assert.doesNotMatch(md.text, /DRAFT - not issued/);

  const html = await c.call("credit_note_render", { id: "CN-2026-0001", format: "html" });
  assert.equal(html.isError, false);
  assert.match(html.text, /^<!DOCTYPE html>/);
  assert.match(html.text, /<style>/);
  assert.match(html.text, /<title>Credit note CN-2026-0001<\/title>/);
  assert.doesNotMatch(html.text, /<script/i, "self-contained means no script");
  assert.doesNotMatch(html.text, /<link/i, "self-contained means no external stylesheet");
  assert.doesNotMatch(html.text, /src=/i, "self-contained means no external resource");
  assert.match(html.text, /Total credited \(EUR\)/);
  assert.match(html.text, /116\.50/);
  // User strings are escaped.
  await c.json("credit_note_create", {
    recipient: "<script>alert(1)</script>", reason: "other", currency: "EUR",
    lines: [{ description: "x <b>", quantity: 1, unit_price_minor: 100 }],
  });
  const raw = await c.json("credit_note_list", { recipient: "script" });
  const htmlX = await c.call("credit_note_render", { id: raw.credit_notes[0].id, format: "html" });
  assert.doesNotMatch(htmlX.text, /<script>alert/, "the recipient is HTML-escaped");
  assert.match(htmlX.text, /&lt;script&gt;/);
});

test("pro renders carry no footer", async (t) => {
  const { c, draft } = await workedDraft(t, { key: proKey() });
  await c.json("credit_note_finalize", { id: draft.id });
  const md = await c.call("credit_note_render", { id: "CN-2026-0001" });
  assert.doesNotMatch(md.text, /Generated with mcp-credit-note/);
});

test("summary totals per currency, reason and month; currencies never mix; drafts count for nothing", async (t) => {
  const { c, draft } = await workedDraft(t);
  // A draft exists and must not move the summary.
  const before = await c.json("credit_note_summary", {});
  assert.equal(before.finalized, 0);
  assert.equal(before.drafts_excluded, 1);
  assert.deepEqual(before.by_currency, []);

  await c.json("credit_note_finalize", { id: draft.id });
  const d2 = (await c.json("credit_note_create", {
    recipient: "Beta BV", reason: "overcharge", currency: "USD", issue_date: "2026-04-11",
    lines: [{ description: "Billed 10 seats, used 7", quantity: 3, unit_price_minor: 1500, tax_rate: 10 }],
  })).created;
  await c.json("credit_note_finalize", { id: d2.id });
  const d3 = (await c.json("credit_note_create", {
    recipient: "Acme GmbH", reason: "discount_correction", currency: "EUR", issue_date: "2026-04-20",
    lines: [{ description: "Loyalty discount applied late", quantity: 1, unit_price_minor: 2000 }],
  })).created;
  await c.json("credit_note_finalize", { id: d3.id });

  const s = await c.json("credit_note_summary", {});
  assert.equal(s.finalized, 3);
  assert.equal(s.by_currency.length, 2);
  const eur = s.by_currency.find((x) => x.currency === "EUR");
  const usd = s.by_currency.find((x) => x.currency === "USD");
  assert.equal(eur.notes, 2);
  assert.equal(eur.total_minor, WORKED_TOTAL + 2000);
  assert.equal(eur.total, "EUR 136.50");
  assert.equal(usd.notes, 1);
  // USD note: gross 4500, tax 450, total 4950.
  assert.equal(usd.total_minor, 4950);
  assert.equal(usd.tax_minor, 450);

  // Reasons are sorted by total, largest first.
  assert.deepEqual(eur.by_reason.map((r) => [r.reason, r.total_minor]), [
    ["returned_goods", WORKED_TOTAL],
    ["discount_correction", 2000],
  ]);
  assert.deepEqual(usd.by_reason.map((r) => [r.reason, r.total_minor]), [["overcharge", 4950]]);
  // Months are chronological.
  assert.deepEqual(eur.by_month.map((m) => [m.month, m.total_minor]), [
    ["2026-03", WORKED_TOTAL],
    ["2026-04", 2000],
  ]);

  // The period filter.
  const april = await c.json("credit_note_summary", { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(april.finalized, 2);
  assert.equal(april.by_currency.find((x) => x.currency === "EUR").total_minor, 2000);
});

test("the free tier finalizes exactly ten; the eleventh is refused with the upgrade text and nothing written", async (t) => {
  const { box, c } = open(t);
  await c.init();
  for (let i = 1; i <= 10; i++) {
    const d = await c.json("credit_note_create", {
      recipient: `Client ${i}`, reason: "other", currency: "EUR", issue_date: "2026-03-05",
      lines: [{ description: "Correction", quantity: 1, unit_price_minor: 100 * i }],
    });
    assert.ok(d.created, JSON.stringify(d).slice(0, 200));
    const f = await c.call("credit_note_finalize", { id: d.created.id });
    assert.equal(f.isError, false, `finalize ${i}: ${f.text.slice(0, 200)}`);
  }
  const d11 = await c.json("credit_note_create", {
    recipient: "Client 11", reason: "other", currency: "EUR", issue_date: "2026-03-05",
    lines: [{ description: "Correction", quantity: 1, unit_price_minor: 1100 }],
  });
  assert.ok(d11.created, "drafts are never capped");
  const blocked = await c.call("credit_note_finalize", { id: d11.created.id });
  assert.equal(blocked.isError, true);
  assert.match(blocked.text, /the free tier finalizes 10 credit notes and 10 are already final/);
  assert.match(blocked.text, /Nothing was written/);
  assert.match(blocked.text, /Pro is a one-time \$\d+ for this server/);
  assert.match(blocked.text, /mcp\.zovo\.one\/buy\/credit-note/);
  assert.match(blocked.text, /src=credit-note\.credit_note_finalize/, "the gate link is tagged with the tool");
  // The refused finalize left the draft a draft.
  const still = await c.json("credit_note_get", { id: d11.created.id });
  assert.equal(still.credit_note.status, "draft");
  assert.equal(still.credit_note.number, null);
  const stored = JSON.parse(readFileSync(join(storeDir(box.dataHome), "notes.json"), "utf8"));
  assert.equal(stored.filter((n) => n.status === "final").length, 10, "the refusal wrote nothing");

  // Every read stays free at the cap.
  assert.equal((await c.call("credit_note_list", {})).isError, false);
  assert.equal((await c.call("credit_note_summary", {})).isError, false);
  assert.equal((await c.call("credit_note_render", { id: "CN-2026-0001" })).isError, false);

  // Pro removes the limit.
  const pro = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => pro.close());
  await pro.init();
  const f11 = await pro.call("credit_note_finalize", { id: d11.created.id });
  assert.equal(f11.isError, false, f11.text.slice(0, 300));
  assert.match(f11.text, /CN-2026-0011/);
});

test("license_status reports free with no key and pro with a signed key", async (t) => {
  const { c: free } = open(t);
  await free.init();
  const f = await free.call("license_status", {});
  assert.equal(f.isError, false);
  assert.match(f.text, /"tier":\s*"free"/);
  assert.match(f.text, /"product":\s*"credit-note"/);

  const { c: pro } = open(t, { key: proKey() });
  await pro.init();
  const p = await pro.call("license_status", {});
  assert.match(p.text, /"tier":\s*"pro"/);
});

test("this server writes two files and no others, on any tool", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  const d = (await c.json("credit_note_create", WORKED)).created;
  await c.json("credit_note_update", { id: d.id, notes: "Revised" });
  await c.json("credit_note_finalize", { id: d.id });
  await c.call("credit_note_render", { id: d.id, format: "html" });
  await c.json("credit_note_summary", {});
  const d2 = (await c.json("credit_note_create", { ...WORKED, duplicate_ok: true })).created;
  await c.json("credit_note_delete", { id: d2.id });
  const files = (await import("node:fs")).readdirSync(storeDir(box.dataHome)).filter((f) => !f.startsWith("."));
  assert.deepEqual(files.sort(), ["counter.json", "notes.json"]);
  const siblings = (await import("node:fs")).readdirSync(join(box.dataHome, "mcp-servers"));
  assert.deepEqual(siblings, ["credit-note"], `a sibling store was touched: ${siblings.join(", ")}`);
});

test("a corrupt store is quarantined and every call fails loudly, never reported as empty", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const d = await c.json("credit_note_create", WORKED);
  assert.ok(d.created);
  c.close();
  const fs = await import("node:fs");
  fs.writeFileSync(join(storeDir(box.dataHome), "notes.json"), "{ not json");
  const c2 = client({ dataHome: box.dataHome });
  t.after(() => c2.close());
  await c2.init();
  const r = await c2.call("credit_note_list", {});
  assert.equal(r.isError, true);
  assert.match(r.text, /data file is corrupt/);
  assert.match(r.text, /nothing was written/);
  // The file was moved aside byte-for-byte, not overwritten.
  const moved = fs.readdirSync(storeDir(box.dataHome)).filter((f) => f.startsWith("notes.json.corrupt-"));
  assert.equal(moved.length, 1);
  assert.equal(fs.readFileSync(join(storeDir(box.dataHome), moved[0]), "utf8"), "{ not json");
});
