---
phase: 19
slug: web-search-integration-for-ask-and-feed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) + manual verification |
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
| 19-01-01 | 01 | 1 | WEB-04 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 2 | WEB-01,WEB-02 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 2 | WEB-03 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-04-01 | 04 | 3 | NEWS-01,NEWS-02,NEWS-03,NEWS-04 | compile+visual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (TypeScript compilation).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM autonomously invokes web search | WEB-01 | Requires LLM interaction | Ask a current-events question, verify search is triggered |
| Globe toggle forces web search | WEB-02 | UI interaction | Toggle globe on, ask any question, verify web results included |
| Inline citations with sources | WEB-03 | Visual check | Verify [1][2] links appear in response, collapsible sources section shows URLs |
| Search API returns results | WEB-04 | External API | Configure API key, verify search results return in Ask screen |
| AI posts enriched with web context | NEWS-01 | Content check | Check AI posts contain current/web-sourced information |
| News posts appear in feed | NEWS-02 | Visual check | Verify newspaper-style news cards in feed |
| Daily background fetch | NEWS-03 | Timing check | Wait for daily refresh, verify 2-3 news posts generated |
| Newspaper card styling | NEWS-04 | Visual check | Verify headline-forward, serif font, source attribution on news cards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
