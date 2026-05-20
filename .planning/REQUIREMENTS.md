# Requirements: Trellis — v1.7 Cleanup, Hardening & Rewards

**Defined:** 2026-05-20
**Core Value:** AI-powered personalized learning that respects user attention — reward-based, non-pushy, local-first.

## v1 Requirements

Requirements for milestone v1.7. Each maps to exactly one roadmap phase.

Six areas are internal cleanup/hardening (POLISH, DOCS, TECHDEBT, QUALITY, TUNE); one is a new feature (REWARDS — a coin-purchasable cosmetic shop).

### UI Polish

- [ ] **POLISH-01**: Screens are swept against a UI-polish checklist; identified rough/skipped refinements (spacing, alignment, visual hierarchy) are fixed
- [ ] **POLISH-02**: Missing or janky animations and transitions are identified and added/fixed across screens, within the Android WebView performance budget
- [ ] **POLISH-03**: Navigation is audited end-to-end; wrong, dead-end, or broken back-button paths are fixed

### Documentation

- [ ] **DOCS-01**: Stale documents in `Documents/` and `.planning/` are archived or updated to reflect current state
- [ ] **DOCS-02**: CLAUDE.md load-bearing sections are verified against current code; any drift is corrected

### Tech Debt

- [ ] **TECHDEBT-13**: Accumulated tech debt across v1.4–v1.6 is inventoried, prioritized, and high-priority items are resolved
- [ ] **TECHDEBT-14**: Known-deferred test failures (e.g. the stale `buildFallbackPosts` test contract) are resolved or formally re-accepted with documented rationale

### Code Quality & Bugs

- [ ] **QUALITY-01**: The codebase is audited for bugs (logic errors, edge cases, race conditions) and confirmed bugs are fixed
- [ ] **QUALITY-02**: Carried-over debug sessions are resolved (`feed-not-auto-populating-after-force-new-day`, `vine-chip-not-clearing-after-force-new-day`)
- [ ] **QUALITY-03**: Auto-generated podcast is verified working on device and any defects are fixed

### Tuning & Mechanisms

- [ ] **TUNE-01**: Numeric algorithm thresholds (cosine similarity for classification dedup and the filter, etc.) are reviewed and tuned with documented rationale; the cosine-similarity threshold cache-miss todo is resolved
- [ ] **TUNE-02**: Filter, recommendation, feed randomizer, and "like" signal mechanisms are tested and tuned against expected behavior

### Rewards Shop

- [ ] **REWARDS-01**: User can view their coin (fruit credit) balance and browse a catalog of purchasable cosmetics
- [ ] **REWARDS-02**: User can preview a cosmetic before buying and complete a purchase with a confirmation step; the balance decrements atomically and ownership is granted with no double-spend
- [ ] **REWARDS-03**: User can equip and unequip owned cosmetics, with owned / locked / equipped states clearly shown
- [ ] **REWARDS-04**: User can purchase and equip color themes that apply app-wide via the CSS-variable theming system, independent of the light/dark setting
- [ ] **REWARDS-05**: User can purchase and equip trellis/garden cosmetics (backgrounds, pots, vines, fruit skins) that render in the Planner garden visual
- [ ] **REWARDS-06**: User can purchase and equip a pet/companion that appears in the garden, rendered as a CSS/SVG idle animation behind a render abstraction that leaves room for a future Rive upgrade
- [ ] **REWARDS-07**: Shop is reachable from a Planner/garden entry point and from a one-line nudge after the harvest celebration
- [ ] **REWARDS-08**: Purchased cosmetics persist across Clear-All-Data (rewards are earned, not cache), and the shop respects the non-pushy stance (no scarcity timers, loot boxes, streak-linked items, or functional power-ups) — codified as a guardrail test extension
- [ ] **REWARDS-09**: All new shop UI strings land in all 4 locale bundles (en/zh/es/ja); cosmetic item names remain English branded identifiers

## v2 Requirements

Deferred to future milestones.

### Rewards

- **REWARDS-F1**: Rive-based interactive pet with a multi-state rig (idle / tap / celebrate / sleep), pending Android WASM device validation
- **REWARDS-F2**: Empirical economy re-tuning after 2–3 weeks of real usage data (earn rate vs. price calibration)
- **REWARDS-F3**: Seasonal or rotating cosmetic sets (only if reconcilable with the no-FOMO / permanent-availability stance)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Functional power-ups / pay-to-progress (extra generations, boosts purchasable with coins) | Violates the reward-based, non-pushy design stance (v1.6 LEARN-04/PRIVACY-01); creates earning pressure |
| Scarcity timers, limited drops, loot boxes, randomized rewards | Dark-pattern FOMO mechanics; conflict with non-pushy stance and permanent-availability ethic |
| Streak-linked, login-bonus, or time-multiplier coin earning | No streaks/daily-goals ruling; coins are earned only through genuine learning (harvest + daily read) |
| Real-money purchases / payment SDK | Local-first, no backend, no monetization in scope |
| Social comparison, rarity tiers, leaderboards for cosmetics | No leaderboards/public-likes ruling |
| Backend-hosted cosmetic catalog / CMS | Local-first; catalog is a static in-repo TypeScript constant |
| Translating cosmetic item names | Treated as branded identifiers (consistent with the never-translate proper-nouns rule) |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POLISH-01 | TBD | Pending |
| POLISH-02 | TBD | Pending |
| POLISH-03 | TBD | Pending |
| DOCS-01 | TBD | Pending |
| DOCS-02 | TBD | Pending |
| TECHDEBT-13 | TBD | Pending |
| TECHDEBT-14 | TBD | Pending |
| QUALITY-01 | TBD | Pending |
| QUALITY-02 | TBD | Pending |
| QUALITY-03 | TBD | Pending |
| TUNE-01 | TBD | Pending |
| TUNE-02 | TBD | Pending |
| REWARDS-01 | TBD | Pending |
| REWARDS-02 | TBD | Pending |
| REWARDS-03 | TBD | Pending |
| REWARDS-04 | TBD | Pending |
| REWARDS-05 | TBD | Pending |
| REWARDS-06 | TBD | Pending |
| REWARDS-07 | TBD | Pending |
| REWARDS-08 | TBD | Pending |
| REWARDS-09 | TBD | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 after initial definition*
