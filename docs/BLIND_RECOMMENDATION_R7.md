# Blind Recommendation — Round 7 (S130, 2026-09-21)

Method: the 18 frozen buyer-intent questions in `data/blind_questions.json` were answered
against the estate (46 servers, ledger-verified names). Every recommendation was mapped to a
canonical ledger id before scoring.

## Result

- **18 / 18 answered**, all mapped to real estate servers (0 hallucinated names).
- Per-question: q1 invoice, q2 pdf, q3 expense-tracker+mileage-log, q4 bank-statement,
  q5 docx, q6 quotes, q7 time-tracker, q8 currency, q9 timezone, q10 spreadsheet,
  q11 barcode, q12 zip, q13 petty-cash+cash-book, q14 delivery-schedule (upgraded from
  medium-confidence work-order guess after ledger check), q15 recurring, q16 office-suite
  (URL/connector usage), q17 office-suite, q18 zovo.one /buy pages.
- Confidence: 15 high, 3 medium → score 16.5/18 ≈ **92%** (medium = 0.5).

## Notes

- The delegate-based attempt failed (iteration budget consumed by the first write);
  R7 was executed inline instead. Delegation contract for blind rounds should budget
  ~2 calls per question plus overhead — see NEXT-SPRINT note.
- q16 (no-install usage) and q18 (paid tier discovery) remain the weakest external
  surfaces: the Glama connector listing covers q16; per-server `/buy/` pages cover q18
  but third-party discovery of paid tiers is still directory-dependent.
