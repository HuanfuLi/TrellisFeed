---
phase: 50
slug: retrieval-and-library-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | `app/package.json` (test scripts), `app/tests/canonical-knowledge.test.mjs` (pattern reference) |
| **Quick run command** | `cd app && node --test tests/services/collection.service.test.mjs` (or per-file under test) |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the per-file test added/touched by the task
- **After every plan wave:** Run `cd app && npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + bundle-parity test must pass
- **Max feedback latency:** ~10 seconds (per-file); ~60 seconds (full suite)

---

## Per-Task Verification Map

> Populated by planner during PLAN.md authoring. Each task receives a row mapping it to its automated verify command, requirement ID, and (if applicable) threat reference.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 50-XX-YY | XX | N | RETRIEVE-XX | T-50-XX / — | {expected secure behavior or "N/A"} | unit/integration/screen | `cd app && node --test tests/path/to/file.test.mjs` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/services/collection.service.test.mjs` — collectionService CRUD + persistence stubs
- [ ] `app/tests/services/engagement.service.pinned-ids.test.mjs` — getPinnedIds union semantics stubs
- [ ] `app/tests/services/post-history.purge.test.mjs` — collection membership pins post against purge
- [ ] `app/tests/services/library-search.service.test.mjs` — Fuse.js index + relevance ordering + highlight match stubs
- [ ] `app/tests/screens/SavedScreen.collections-tab.test.mjs` — 4th tab renders + tab-scoped search stubs
- [ ] `app/tests/components/CollectionPickerSheet.test.mjs` — implicit Saved pre-checked + inline create stubs
- [ ] `app/tests/locales/bundle-parity.test.mjs` — existing test; new keys must land in all 4 locale bundles (no new test file, existing test will enforce)
- [ ] `app/tests/events/event-bus.collections-changed.test.mjs` — COLLECTIONS_CHANGED event type stub
- [ ] No new framework install — `node --test` + esbuild loader already in place

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collection picker sheet opens on long-press → "Save to..." tap on a feed tile | RETRIEVE-02 | iOS gesture (long-press at 480ms) requires real device or browser pointer simulation; flaky in headless test env | 1. Long-press a feed tile (480ms hold), 2. Tap "Save to...", 3. Picker sheet opens with "Saved" pre-checked, 4. Tap "Create new collection", 5. Type name + commit, 6. Collection appears in picker, 7. Tap to add post |
| Search highlight visually renders matched substrings in feed list | RETRIEVE-01 | Visual correctness of highlight rendering (color, weight, contrast) needs eye-check | 1. Open /saved, 2. Focus search bar, 3. Type a substring matching a known saved post title, 4. Verify matched substring is visually distinct (bold/highlighted), 5. Verify body snippet shows ~120 chars centered on match |
| Filter chips appear inline on search-bar focus and disappear on blur | RETRIEVE-01 | Focus/blur animation timing needs visual check across mobile WebView | 1. Open /saved, 2. Tap search bar (focus), 3. Chips slide in below bar, 4. Tap outside (blur), 5. Chips collapse |
| Tab switch preserves search query but rescopes results | RETRIEVE-01 | Cross-tab interaction state requires user-flow walkthrough | 1. Open /saved, 2. Type query on Saved tab, 3. Switch to Liked tab, 4. Query string persists, 5. Results rescope to Liked |
| Collection membership pins post against 7-day purge | RETRIEVE-02 | Manual time-travel via dev-tools "Force New Day" to verify post survives purge after >7 days | 1. Save post to a custom collection, 2. Wait or trigger Force-New-Day repeatedly until >7 days simulated, 3. Open /saved → History, 4. Post still visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
