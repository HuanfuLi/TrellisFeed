---
phase: 55
slug: algorithm-mechanism-tuning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader (see `app/tests/canonical-knowledge.test.mjs` pattern) |
| **Config file** | none — runner invoked via npm script |
| **Quick run command** | `cd app && node --test tests/<area>/<file>.test.mjs` (single file) |
| **Full suite command** | `cd app && npm test` (note: `;`-chained multi-runner masks non-zero exit — aggregate fail counts across ALL segments) |
| **Typecheck command** | `cd app && ./node_modules/.bin/tsc -b --noEmit` |
| **Estimated runtime** | full suite ~ tens of seconds (1,635 tests baseline green) |

---

## Sampling Rate

- **After every task commit:** Run the targeted `node --test` file(s) touched by the task.
- **After every plan wave:** Run `cd app && npm test` + `tsc -b --noEmit`.
- **Before `/gsd:verify-work`:** Full suite + typecheck must be green.
- **Max feedback latency:** < 60 seconds for targeted runs.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TUNE-01 / TUNE-02 | T-55-01 (filter) | Malicious cosine threshold clamped to 0.78–0.85 band; dual-vector scoring not regressed | unit | `cd app && npm test` | ⬜ W0 | ⬜ pending |

*Populated by the planner / Nyquist auditor once tasks exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/services/embed-cache.test.mjs` — embedding query-cache hit/miss + pipeline hand-off (TUNE-01)
- [ ] `app/tests/services/filter-golden-fixtures.test.mjs` — labeled off-topic/on-topic/malicious corpus asserted at chosen thresholds; malicious stays in 0.78–0.85 band (TUNE-01/02)
- [ ] `app/tests/services/storage-migration.test.mjs` — SQLite-primary write-through + in-memory mirror sync read + clean-cutover init + delete-guard preserved (folded migration)
- [ ] `app/tests/services/like-boost.test.mjs` — liked concept gets 4→8 derived-list multiplicity without starving due-for-review concepts (TUNE-02)
- [ ] Verify `@sqlite.org/sqlite-wasm` + `opfs-sahpool` VFS resolves in `npm run dev` (Open Question 1 — Wave 0 spike before committing to the WASM backend)

*Existing threshold-band tests (`classification-dedup.test.mjs`, `filter-classifier.unit.test.mjs`) pass and remain valid.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Threshold tuning via dev slider + console.log instrumentation | TUNE-01 | Operator-driven empirical tuning in the browser; the durable artifact is the frozen golden fixtures, not the live tuning session | Operator drives per-threshold debug knobs in `npm run dev`, reads instrumentation, picks values; interesting cases are frozen into `filter-golden-fixtures.test.mjs` |
| Browser SQLite backend escapes localStorage quota on-device | folded migration | Device WebView storage behaves differently than `npm run dev` | After migration, exercise a large mindmap on-device; confirm no quota error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are recorded as Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
