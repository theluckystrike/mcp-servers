S139 NEW SERVER CONCEPTS (8) — alias -> product, buyer-intent name rationale
1. pdf-merger        -> pdf         ("pdf merger" exact phrase, huge volume)
2. pdf-splitter      -> pdf         ("split pdf" intent)
3. expenses-tracker  -> expense-tracker (plural variant of proven token)
4. invoice-maker     -> invoice     ("invoice maker" high volume)
5. receipt-scanner   -> expense-tracker (receipt capture intent)
6. budget-tracker    -> expense-tracker (personal finance intent)
7. gantt-chart       -> spreadsheet (project planning intent)
8. pomodoro-timer    -> time-tracker (focus/productivity intent)

Rules: unique remote https://mcp.zovo.one/mcp/<name>; version 0.22.0; websiteUrl -> /s/<product>;
packages.identifier + fileSha256 copy from product mcpb (v0.22.0); description rewritten per name.
Check registry for name collisions BEFORE publishing.
