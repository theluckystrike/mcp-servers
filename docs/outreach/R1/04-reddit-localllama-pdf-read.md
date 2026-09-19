# Draft 04 — Reddit r/LocalLLaMA: MCP servers for reading PDF files

Reddit r/LocalLLaMA — `HUMAN-GATED` (Reddit account required)
https://www.reddit.com/r/LocalLLaMA/comments/1uyzxxm/mcp_servers_for_reading_pdf_files/
*MCP servers for reading pdf files*
The ask is "give my text model a way to read PDFs." The genuinely useful answer is the
subset-font trap — why token-based PDF text extraction returns glyph numbers instead of words on a
large fraction of modern PDFs — which almost no thread mentions and which saves the asker from
thinking their setup is broken.

https://mcp.zovo.one/guides/pdf-merge-split-stamp-from-chat

---

## Draft answer (paste as-is)

Worth knowing before you pick one, because it decides whether the server will work on *your* PDFs:
most PDF text extractors that don't carry a font-encoding decoder will return gibberish — short runs of
digits and symbols — on a large fraction of real-world PDFs, and they'll do it without erring.

Why: a PDF doesn't store text as characters, it stores drawing operators that place glyphs, and what
those glyphs *mean* comes from the font's own encoding table. Most PDFs from modern tools embed a
of the font and renumber the glyphs into a private table with no relation to any standard
character set; some go further and index by raw glyph id (CID) rather than by character. A decoder-less
extractor reads the operator bytes — which are glyph indices — and hands you those as "text." It looks
like a successful extraction and reads like line noise, which is worse than an empty result.

So when you evaluate a PDF MCP server, check two things:

1. **Does it say so when it can't decode?** The good behaviour is to detect that what came out isn't
   recognisable characters and report the font encoding as the reason — distinct from the message for
   an image-only scan, which has no text operators at all and needs OCR. Two failure modes, two
   explanations. A server that returns an empty string for both leaves you unable to tell "scan" from
   "subset font" from "broken file."
2. **Does it do OCR?** If your PDFs are scans (`many PDFs, mostly scans` is the usual case), token-level
   extraction is a dead end and you need real OCR — pick accordingly rather than debugging extraction.

For the specific case of *reading* rather than *producing*, the ones that carry a font decoder or wrap a
real parser handle the subset case correctly; check the changelog/issue tracker for "CID" or "ToUnicode"
before you commit.

I maintain a local PDF MCP server (merge/split/rotate/stamp, plus `pdf_text`), and wrote up exactly what
`pdf_text` can and can't read, with the subset-font and scan cases separated:
https://mcp.zovo.one/guides/pdf-merge-split-stamp-from-chat — free, no signup, files are read on your
machine with no upload. Disclosure: it's my project, so weigh that.

---

## Notes for the operator
- r/LocalLLaMA rewards technical specificity; the subset-font explanation is the value, the link is secondary.
- Do not claim to work on scans — the draft explicitly says OCR is out of scope, which builds credibility.
