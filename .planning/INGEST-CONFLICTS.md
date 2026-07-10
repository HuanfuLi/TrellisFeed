# Conflict Detection Report

MODE: new. Sources (precedence, lower = higher authority): docs/research_system_design.md=0 (SPEC), docs/SCOPE.md=1 (ADR, LOCKED), ROADMAP.md=2 (PRD), docs/prune_report.md=3 (DOC).

Cross-ref cycle detection (DFS, three-color, depth cap 50) was run over the 4-doc ref graph. Result below (INFO-1). No LOCKED-vs-LOCKED contradiction exists (only one LOCKED source). No competing acceptance variants exist (single PRD). No UNKNOWN/low-confidence docs.

### BLOCKERS (0)

None.

### WARNINGS (0)

None.

### INFO (3)

[INFO] Precedence inversion: SPEC outranks ADR by explicit manifest integers
  Note: The manifest assigns research_system_design.md (SPEC) precedence 0 and SCOPE.md (ADR, LOCKED) precedence 1, inverting the type-based default (ADR > SPEC). Explicit integers govern per the ingest directive. No actual contradiction was found — SCOPE.md explicitly defers authority to research_system_design.md, and their overlapping content (framing rules §22, graph-visibility cap §7.7, both-conditions Ask §6.6, pruned features §15.3) agrees. SCOPE.md's LOCKED status still makes its scope boundaries non-overridable regardless of precedence ordering.

[INFO] Auto-resolved: phase granularity — SPEC 8 phases vs PRD 5 phases
  Note: research_system_design.md §16 lays out eight granular phases (Phase 0–7); ROADMAP.md consolidates them into five coarse phases (Phase 0–4, Phase 0 complete 2026-07-09). Per the operator lock, ROADMAP's five coarse phases are adopted verbatim and win. No content is lost: RSD's finer phase details fold into the ROADMAP phases and are preserved as intra-phase build guidance in intel/context.md (Topic: Build sequencing guidance) and mapped onto requirements via each REQ's `phase:` field.

[INFO] Cross-ref cycle detected but non-blocking: ROADMAP.md <-> docs/prune_report.md
  Note: Cycle detection found one 2-node loop in the cross_refs graph — ROADMAP.md references docs/prune_report.md ("See docs/prune_report.md") and prune_report.md references ROADMAP.md (in its "root-level docs were not edited by this pass" note). This is benign bidirectional documentation linking, not a semantic derivation cycle: extraction is per-doc and independent, and manifest precedence is a strict total order (2 > 3) that unambiguously breaks the tie (ROADMAP wins over prune_report on any overlap). No synthesis loop is possible, so all four docs were synthesized. Recorded here for transparency rather than as a blocker.
