---
phase: 51
slug: concept-dashboard-and-recovery-surfaces
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
updated: 2026-05-19
---

# Phase 51 - Validation Strategy

Per-phase validation contract for Concept Dashboard and Recovery Surfaces.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` |
| Config file | `app/package.json` test scripts; tests live under `app/tests/**/*.test.mjs` |
| Quick run command | `cd app && node --test tests/lib/anchor-resolution.test.mjs tests/screens/AnchorDetailScreen.recovery.test.mjs tests/components/InfoFlow.badge-nav.test.mjs tests/screens/SavedScreen.routeFilter.test.mjs tests/screens/PostDetailScreen.conceptNav.test.mjs tests/screens/PodcastScreen.routeFilter.test.mjs` |
| Full suite command | `cd app && npm test` |
| Estimated runtime | <1s for phase slice; full suite varies |

---

## Sampling Rate

- After every task commit: run the per-file test added or touched by that task.
- After every plan wave: run the Phase 51 slice plus `cd app && npm test`.
- Before `$gsd-verify-work`: full suite must be green or non-phase failures must be documented.
- Max feedback latency: <10s for the Phase 51 slice.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | unit | `cd app && node --test tests/lib/anchor-resolution.test.mjs` | yes | green |
| 51-01-02 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | screen/source | `cd app && node --test tests/screens/AnchorDetailScreen.recovery.test.mjs` | yes | green |
| 51-01-03 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | component/source | `cd app && node --test tests/components/InfoFlow.badge-nav.test.mjs` | yes | green |
| 51-01-04 | 51-01 | 0 | RETRIEVE-03 | screen/source | `cd app && node --test tests/screens/PostDetailScreen.conceptNav.test.mjs` | yes | green |
| 51-01-05 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | screen/source | `cd app && node --test tests/screens/SavedScreen.routeFilter.test.mjs` | yes | green |
| 51-01-06 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | screen/source | `cd app && node --test tests/screens/PodcastScreen.routeFilter.test.mjs` | yes | green |
| 51-01-07 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | locale/unit | `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` | yes | green |
| 51-01-08 | 51-01 | 0 | RETRIEVE-03 / RETRIEVE-04 | phase slice | `cd app && node --test tests/lib/anchor-resolution.test.mjs tests/screens/AnchorDetailScreen.recovery.test.mjs tests/components/InfoFlow.badge-nav.test.mjs tests/screens/SavedScreen.routeFilter.test.mjs tests/screens/PostDetailScreen.conceptNav.test.mjs tests/screens/PodcastScreen.routeFilter.test.mjs` | yes | green |

*Status: pending / green / red / flaky*

---

## Requirement Coverage

| Requirement | Phase 51 Behavior | Automated Coverage | Status |
|-------------|-------------------|--------------------|--------|
| RETRIEVE-03 | User can open a concept-level home from concept-linked surfaces, see local concept artifacts/signals, and jump to bounded filtered surfaces. | `anchor-resolution.test.mjs`, `InfoFlow.badge-nav.test.mjs`, `PostDetailScreen.conceptNav.test.mjs`, `AnchorDetailScreen.recovery.test.mjs`, `SavedScreen.routeFilter.test.mjs`, `PodcastScreen.routeFilter.test.mjs` | covered |
| RETRIEVE-04 | Retrieval surfaces stay bounded and recovery-oriented through targeted dashboard navigation, review CTA morphing, and pre-applied filters. | `AnchorDetailScreen.recovery.test.mjs`, `SavedScreen.routeFilter.test.mjs`, `PodcastScreen.routeFilter.test.mjs`, locale parity/missing-key tests | covered |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 51 already had four automated files at execution close, and this validation pass added the two missing source guards:

- [x] `app/tests/screens/PostDetailScreen.conceptNav.test.mjs` - concept chip and connection pill navigation to `/anchor/:id`
- [x] `app/tests/screens/PodcastScreen.routeFilter.test.mjs` - `/podcast` route-state filter consumer, filtered list, and Clear banner

---

## Manual-Only Verifications

All Phase 51 requirements have automated Nyquist coverage. Device UAT observations remain documented in `51-UAT.md`, but no requirement is manual-only for validation sign-off.

---

## Validation Audit 2026-05-19

| Metric | Count |
|--------|-------|
| Input state | State B - reconstructed from PLAN/SUMMARY/VERIFICATION |
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |
| Manual-only | 0 |

### Gaps Resolved

| Gap | Resolution | File |
|-----|------------|------|
| PostDetailScreen concept entry points had verifier evidence but no dedicated automated guard. | Added source tests covering strict `resolveAnchorId` chip resolution, title fallback, mobile-safe `/anchor/:id` tap handler, static unresolved labels, and connection pill click/keyboard routing. | `app/tests/screens/PostDetailScreen.conceptNav.test.mjs` |
| PodcastScreen route-state consumer had verifier evidence but no direct automated guard. | Added source tests covering `{ conceptFilterQaIds, conceptTitle }` consumption, All Podcasts auto-open, surgical route-state clear, `visiblePodcasts` intersection filtering, and Clear banner. | `app/tests/screens/PodcastScreen.routeFilter.test.mjs` |

### Verification Run

| Command | Result |
|---------|--------|
| `cd app && node --test tests/screens/PostDetailScreen.conceptNav.test.mjs tests/screens/PodcastScreen.routeFilter.test.mjs` | 13 pass / 0 fail |
| Phase 51 quick run command | 64 pass / 0 fail |
| `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` | 3 pass / 0 fail |
| `cd app && npm test` | 1357 main + 149 actions pass / 0 fail |

---

## Validation Sign-Off

- [x] All tasks have automated verification or completed Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s for the Phase 51 validation slice
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Manual-only device checks are outside Nyquist sign-off and remain in `51-UAT.md`

**Approval:** verified 2026-05-19
