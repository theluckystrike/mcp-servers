# Draft 05 — Reddit r/ollama: invoice processing with a local LLM

**Surface:** Reddit r/ollama — `HUMAN-GATED` (Reddit account required)
**Thread URL:** https://www.reddit.com/r/ollama/comments/1tawcds/use_case_invoice_processing_with_local_llm_which/
**Thread title:** *Use Case: Invoice processing with local LLM — which model / how*
**Fit:** The poster wants a fully local invoice pipeline and is asking for model recommendations. The
useful redirection is that the model choice is the *second* problem — determinism of the extraction and
the ledger format is the first, and that's a tooling shape question, not a model question.

**Exact guide link to include:** https://mcp.zovo.one/guides/invoice-pdf-from-chat

---

## Draft answer (paste as-is)

Split this into two problems, because the model is the easy one.

**Problem 1: extraction must be deterministic and auditable.** For a pipeline that runs monthly, you
don't want free-form model output deciding what the invoice total was. The shape that survives contact
with real invoices: a tool that reads the document and writes a *structured* row (vendor, number, date,
net, VAT, gross, currency) into a local store on your disk, with the model only orchestrating that call
— not transcribing numbers from a page image. Then "what did we bill in Q3" is a query against rows you
can diff and correct, not a re-derivation you can't reproduce. That also means re-running the pipeline
is idempotent: same file in, no duplicate row out.

**Problem 2: the model.** Once extraction is a tool call with a schema, the LLM you pick matters much
less — any tool-calling model that reliably emits the call arguments will do, because it isn't doing the
hard part. That's the good news for a local setup: you're no longer gating your accounting pipeline on a
70B model's arithmetic. Ollama models that handle tool calls strictly are plenty, and you keep the
privacy property that made you go local in the first place.

Concrete things to insist on before committing to a local stack:
- **No network calls at all**, not even for a licence check — verify this, because plenty of "local"
  servers phone home.
- **Number/locale handling.** `1 234,56` and `1,234.56` must both parse to the same amount; if the tool
  assumes one locale, a supplier's invoice silently becomes a thousand times too small.
- **Sign convention stored once at import** (debit negative, credit positive), so nothing downstream
  re-guesses it per-bank or per-vendor.
- **Idempotent import** keyed on content, so re-processing a folder doesn't double your books.

I maintain local MCP servers for exactly this (invoice generation, PDF handling, bank-statement import
with reconciliation), and the pipeline shape above is written out here, free and with no signup:
https://mcp.zovo.one/guides/invoice-pdf-from-chat — everything runs on your machine, nothing is
uploaded. Disclosure: these are my servers, so treat the recommendation accordingly. If you'd rather not
use mine, the checklist above is the part worth keeping.

---

## Notes for the operator
- The draft's value is the "model is problem 2" reframe; keep it even though it somewhat de-emphasises
  the product — that's what makes it credible.
- Works equally well pasted into a r/LocalLLaMA invoicing thread if this one is stale.
