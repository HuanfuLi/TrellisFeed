# Phase 17: Auto-fetch Online Videos for Posts - Validation

**Created:** 2026-04-01
**Source:** 17-RESEARCH.md Validation Architecture

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner |
| Config file | none (uses `node --test`) |
| Quick run command | `node --test tests/services/youtube.test.mjs` |
| Full suite command | `node --test tests/**/*.test.mjs` |

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Due concepts drive YouTube search queries | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-02 | YouTube Data API v3 search call structure | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-03 | 3 initial + 4 pull-for-more video posts | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-04 | Video posts interleaved in feed | unit | `node --test tests/services/concept-feed.test.mjs` | Partial (existing file) |
| D-07 | sourceType 'video' added and validated | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-09 | Transcript extraction returns text | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-10 | chatCompletion called with serviceName 'video-summary' | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |

## Sampling Rate

- **Per task commit:** `node --test tests/services/youtube.test.mjs`
- **Per wave merge:** `node --test tests/**/*.test.mjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

## Wave 0 Gaps

- [ ] `tests/services/youtube.test.mjs` -- covers D-01, D-02, D-03, D-07, D-09, D-10
- [ ] Update `tests/services/concept-feed.test.mjs` -- covers D-04 (interleaving)
