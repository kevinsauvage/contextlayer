# TODO · Quality

## P2 · Production-grade: security, limits, deploy, reliability

- [ ] **Run the judged evals with the default generator** `P2`
  - **Context:** the 2026-11-16 runs (E7 in [`docs/product/validation-experiments.md`](docs/product/validation-experiments.md)) used `deepseek-flash`; with `deepseek-v4-pro` as judge, 5 of 23 tests pass. `anthropic/claude-sonnet-5.5`, the default `AI_MODEL`, has never been run on these suites: the Vercel AI Gateway refuses it on the free tier and no Anthropic key is configured.
  - **Fix:** with gateway credits or an Anthropic-capable endpoint, run the three suites with the default model and a different judge, and add the result to E7 by cause.

- [~] **Stop drafts settling what no source establishes** `P2`
  - **Context:** in the E7 run, 9 of 18 failures are a draft deciding a point the fixture marks as open (CSV columns, per-key limits, a page size), mostly inside an acceptance criterion; 8 more are validator issues the pipeline returns with the draft (a Verified claim quoting text outside its evidence, a claim stating a value an open question asks). `draftTicket` and `auditIssue` report `issues` but never ask the model to repair them.
  - **Update 2026-11-16:** `deepseek-v4-pro` as generator passes 3 of 23 with the same failure shapes, so a stronger model alone does not fix it. Update 2026-11-17: four validator false positives fixed (E7); of the 9 run 3 validator failures, 3 were false and are cleared. A Verified claim that quotes an identifier to say it does not exist still fails the quote check.
  - **Fix:** measure first with the default model (item above). If the pattern holds, give the generator one repair round fed with the validator's issues. This changes `src/core/analysis` and adds a model call per flawed draft: plan it before building.
  - **Update 2026-11-20:** the shared prompt now says an acceptance criterion that depends on an open question states the condition and sets `requiresProductDecision`, never the value. The repair round still waits for the default-model run, which needs gateway credits.
