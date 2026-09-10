# Blind recommendation test: the estate's primary discovery KPI

## Why this is the primary number

Every other discovery metric this project has tracked measures whether a machine can find
the catalogue. This one measures whether a person gets told about it.

The buyer of these servers does not browse a registry. They ask an assistant "how do I get
Claude to make me an invoice" and install whatever it names. So the only discovery question
that maps to revenue is: **when a general assistant researches the buyer's question, does it
name one of our servers.**

Baseline, 2026-09-10, first run: **0 of 18**. The instrument named 47 distinct MCP servers
across the 18 questions and not one was ours. The domain surfaced in 2 of 18 raw result
lists, at rank 8 and rank 10, both times the homepage, and never in the generated answer.
The GitHub identity appeared 0 of 18 times.

## The instrument

A subagent with NO knowledge of this estate, no repo context and no framing, given only the
question list in `data/blind_questions.json` and told to research each with web search and
name the specific server it would recommend, with the source. It is told a null result is a
valid and valuable result, because an instrument that knows what answer is wanted is not an
instrument.

Cost: about 90k tokens and four minutes. Free of paid APIs.

## Why it must stay blind

The moment the runner knows the domain, it will search for the domain and find it, and the
number becomes a measure of whether the site exists rather than whether it is recommended.
Do not paste the question list into a context that already contains this repo. Spawn a fresh
agent, hand it only the questions and the two output paths, and read only its summary back.

## How to re-run

1. Spawn a general-purpose subagent with a fresh context.
2. Give it the 18 questions from `data/blind_questions.json` verbatim, the instruction to
   research each with web search and name specific servers with sources, and the three
   summary questions.
3. Have it write `docs/BLIND_RECOMMENDATION_R<n>.md` and `data/blind_recommendation_r<n>.json`.
4. Record three numbers: named-in-answer count out of 18, host-appeared-in-results count out
   of 18, and identity-appeared count out of 18. Only the first is the KPI; the other two
   diagnose whether the failure is retrieval or citation.

## Reading the result honestly

- **Named in answer** is the KPI. It went to zero on the first run and that is the true state.
- **Appeared in results but not in the answer** means the page was retrieved and rejected as
  an answer. That is a content defect, not a distribution one, and more pages will not fix it.
- **Did not appear at all** means a retrieval failure, and content will not fix that either.
  The fix there is indexation, which `docs/AI_INDEX_R1.md` measures.

The first run showed the second pattern on the homepage and the third pattern everywhere
else, which is why loop 33 split the response across both.

## The two questions with no market answer

Q16 ("which MCP servers can I use without installing anything, just by pasting a URL") and
Q18 ("where do I find MCP servers that cost money, and how do I pay for one") were the only
two of the 18 where the instrument could not produce a confident named answer at all. Those
are uncontested, and they are the two questions this estate is uniquely placed to answer,
with 30 hosted zero-install endpoints and a live paid path. Track them separately.
