---
phase: 18
slug: feed-redesign-short-videos-text-art-posts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) + manual visual verification |
| **Config file** | `app/tsconfig.json` |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && npx tsc --noEmit` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npx tsc --noEmit`
- **After every plan wave:** Run `cd app && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-00-01 | 00 | 0 | FEED-07 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 18-01-01 | 01 | 1 | FEED-07,FEED-08,FEED-09,FEED-10 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 18-02-01 | 02 | 1 | TART-01,TART-02,TART-03 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 18-03-01 | 03 | 2 | SHORT-01,SHORT-02,SHORT-03 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 18-04-01 | 04 | 2 | MIX-01,MIX-02,VIDEO-01 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (TypeScript compilation).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge/label removed from all cards | FEED-07 | Visual check | Open home feed, verify no badge or context label on any card |
| Preview hidden when image present | FEED-08 | Visual check | Open home feed with image API key, verify image cards show hook only |
| Text-forward card for no-image | FEED-09 | Visual check | Disable image gen, verify cards show hook + preview, are shorter |
| Keyword tags removed | FEED-10 | Visual check | Open home feed, verify no pill tags on any card |
| Portrait short video card | SHORT-01 | Visual check | Verify 9:16 aspect ratio thumbnail with minimal chrome |
| Inline play on tap | SHORT-02 | Interaction check | Tap short video card, verify plays inline without navigation |
| AI takeaway after play | SHORT-03 | Interaction check | Play short, verify 1-2 sentence takeaway appears below |
| Notebook paper background | TART-01 | Visual check | Verify dot grid pattern on text-art cards |
| Mixed content with emojis | TART-02 | Visual check | Verify text-art cards show varied content styles with emojis |
| Text-art same height as image | TART-03 | Visual check | Compare card heights in mixed feed |
| Weighted random mix | MIX-01 | Visual check | Load feed, verify variety of post types |
| Image gen toggle | MIX-02 | Interaction check | Toggle off in settings, verify no image API calls |
| Video card cleanup | VIDEO-01 | Visual check | Verify landscape video cards have no badge row or keyword tags |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
