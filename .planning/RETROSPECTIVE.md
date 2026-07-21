# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Research Instrument

**Shipped:** 2026-07-20
**Phases:** 5 (0–4) | **Plans:** 40 | **Sessions:** multiple, spanning 2026-07-09 → 2026-07-20

### What Was Built
- A rebranded, condition-plumbed research shell with §14.1 interaction logging and a durable upload outbox (Phase 1).
- A real 77-post curated content pool through a full operator-gated pipeline (collect → preprocess → dedupe → review → freeze), with frozen feed/post UI and post-scoped Ask identical across both study conditions (Phase 2).
- A two-layer graph-memory model (frozen global edges + personal `UserConceptState`), a non-personal control ranker and a graph-memory experimental ranker with 5 orchestration strategies, diversity reranking, and interpretable reasons — algorithm-verified against §12.3 (Phase 3).
- Full study infrastructure: versioned §14.3 consent in 4 locales, server-resolved condition assignment, a live Cloudflare Worker + D1 backend with a four-file researcher export, and an executable pilot protocol — verified end-to-end on a real Android device (Phase 4).

### What Worked
- **Delegation discipline paid off.** Routing bulk execution to Codex (`codex exec --yolo`) while Claude stayed in the planner/reviewer seat kept token spend on judgment calls, and every delegate diff got reviewed + gates re-run independently before landing — this caught real issues (Spanish register drift, a stale test name, a scope-conflict Codex correctly stopped on) before they shipped.
- **Trust-but-verify on live infrastructure.** Every claim about deployment state (CORS preflights, remote row counts, test pass counts) was independently re-verified with a fresh command, not taken from a report — this caught the CORS deployment-boundary blocker that a code-only verification pass would have missed entirely.
- **Locked decisions held.** DEC-control-no-question-history, DEC-both-conditions-ask, and the five-phase structure never needed renegotiating across 10 days and 40 plans — a live grep gate + algorithm-verification test enforced the ranker isolation invariant structurally, not just by convention.

### What Was Inefficient
- **The first live deploy created an accidental duplicate Worker.** The operator had already deployed `question-trace-research-collector` on 2026-07-11 with their own secrets; a same-day authorized deploy missed that and created `questiontrace-research` with fresh secrets instead of reusing the existing one. Cost: an extra consolidation pass (delete duplicate, reconcile `.dev.vars`, re-point config) before the real gap (missing CORS origin binding) could even be found. Lesson: before any live infrastructure action, enumerate *existing* resources first, don't assume a blank slate.
- **The CORS deployment gap escaped both code verification and the first live smoke.** Origin-less `/admin` and `/admin/export.zip` checks passed, masking that the Worker rejected every actual app origin. Root cause fix (a config regression test that drives real preflights through the tracked config) is now permanent, but it took a dedicated integration-checker pass with live network access to surface it — code-level "passed" verification alone was not sufficient for a deployment-boundary contract.

### Patterns Established
- **Deployment-config regression tests belong at the config layer, not just the app layer** — `deployment-config.test.mjs` reads the tracked `wrangler.jsonc` itself and drives the real worker handler, so a plain redeploy can never again silently drop a required binding.
- **ADB-only device verification** (no Computer Use, no fetch stubs, no DevTools overrides) as the acceptance bar for "real device proof" — cleared app data, UI driven via `uiautomator`, evidence captured via logcat + a read-only remote row-count delta.
- **Verifier-owned checkboxes**: `VERIFICATION.md` correctly never touches `REQUIREMENTS.md` checkboxes; the milestone-close step is what reconciles satisfied-but-unchecked requirements — keeps verification and requirement-bookkeeping cleanly separated.

### Key Lessons
1. Live infrastructure changes need an inventory-first step — check what already exists before deploying, especially when picking back up a project after a gap.
2. A verification pass that only exercises origin-less/unauthenticated smoke checks cannot certify a CORS-gated transport boundary; the acceptance bar must include real-origin preflights.
3. iOS UAT genuinely cannot run without macOS/Xcode access — Windows has no viable path (no libimobiledevice tooling, no build toolchain); this is a hard environment constraint to plan around, not a task to retry differently.

### Cost Observations
- Model mix: primarily Claude (Fable 5) orchestration + Codex (GPT) execution per the operator's standing delegation policy; sonnet subagents for verification/integration-checking.
- Sessions: multiple across 2026-07-09 → 2026-07-20 (compacted at least twice).
- Notable: the CORS gap closure (04-07) was itself executed as a mini-phase — Codex handled Tasks 1–2 (RED/GREEN config test) and Task 5 (device smoke) in the background while Claude ran the blocking Task 3 authorization checkpoint and Task 4 (live deploy + preflight verification) directly, since that step required an authenticated Cloudflare session already available to Claude.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | multiple | 5 (0–4) | First milestone — established Codex-delegation + independent-reverification workflow |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.0 | 611 app + 49 backend | Not tracked as %; algorithm-verification + control-isolation suites are load-bearing | — |

### Top Lessons (Verified Across Milestones)

1. Independent re-verification (re-running gates, re-querying live state yourself) catches gaps that trusting a delegate's or a verifier's report alone would miss.
