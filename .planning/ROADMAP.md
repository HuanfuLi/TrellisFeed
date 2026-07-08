# Roadmap: Trellis

## Milestones

- 🚧 **v1.7 Cleanup, Hardening & Rewards** — Phases 54–60 (in progress)
- ✅ **v1.6 Control, Graph Trust, Retrieval, and Ethical Engagement** — Phases 47–53 (shipped 2026-05-20)
- ✅ **v1.5 Curiosity Feed v2 + Tech-Debt Hardening** — Phases 37–46 (shipped 2026-05-13)
- ✅ **v1.4 Curiosity Feed Redesign + UI Polish** — Phases 28–36 (shipped 2026-05-08)
- ✅ **v1.0–v1.3** — earlier shipped milestones

## Overview

v1.7 follows v1.6's heavy feature push with two complementary tracks. First, a cleanup-and-hardening pass pays down accumulated tech debt, fixes confirmed bugs and carried-over debug sessions, tunes the numeric thresholds and recommendation/filter mechanisms, and sweeps UI polish and stale documentation. Second, a new cosmetic rewards shop gives the already-earned fruit credits a destination — coin-purchasable color themes, garden cosmetics, and a pet companion — built data-model-first to lock the non-pushy guardrail before any UI, then themes (lowest infrastructure cost), then pet/garden render work last. No new earning mechanics, no functional power-ups, no scarcity/FOMO mechanics: the reward-based, non-pushy stance is load-bearing throughout.

## Phases

**Phase Numbering:**

- Integer phases (54, 55, 56): Planned milestone work (continued from v1.6, which ended at Phase 53)
- Decimal phases (54.1, 54.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### 🚧 v1.7 Cleanup, Hardening & Rewards (In Progress)

- [ ] **Phase 54: Code Quality, Bugs & Tech Debt** - Inventory and resolve high-priority tech debt, audit and fix bugs, close carried-over debug sessions, verify auto-gen podcast on device
- [ ] **Phase 55: Algorithm & Mechanism Tuning** - Review and tune numeric thresholds with documented rationale; test and tune filter, recommendation, feed randomizer, and "like" mechanisms; fix the curiosity-feed buffer-queue refill reliability bug; migrate the heavy store layer to SQLite-primary
- [ ] **Phase 55.1 (INSERTED): Device-Test Bug Fixes** - Fix four on-device-test regressions: cross-session LLM response leakage, provider/locale-triggered text-art post truncation, Ask-screen nav-bar keyboard flicker, and the first-tap-dismisses-keyboard send bug
- [ ] **Phase 56: UI Polish & Documentation** - Sweep screens against a polish checklist, fix animations and navigation paths, archive/update stale docs, verify CLAUDE.md against code
- [ ] **Phase 57: Rewards Foundation — Data Model & Service** - Lock cosmeticsService, credit subtraction, events, theme CSS blocks, Clear-All-Data preservation, and the non-pushy guardrail before any UI
- [ ] **Phase 58: Rewards Core Shop Loop — Themes** - ShopScreen browse/preview/buy/equip with color themes, dual entry points, always-mounted resync, and 4-locale UI strings
- [ ] **Phase 59: Rewards Pet Companion & Garden Cosmetics** - CSS/SVG idle pet behind a render abstraction plus garden/trellis cosmetics rendering in the Planner garden

## Phase Details

### Phase 54: Code Quality, Bugs & Tech Debt

**Goal**: The codebase is measurably cleaner after v1.6 — confirmed bugs fixed, high-priority debt paid down, deferred test failures resolved or formally re-accepted, and the carried-over debug threads closed.
**Depends on**: Nothing (first v1.7 phase)
**Requirements**: QUALITY-01, QUALITY-02, QUALITY-03, TECHDEBT-13, TECHDEBT-14
**Success Criteria** (what must be TRUE):

  1. Accumulated v1.4–v1.6 tech debt is inventoried in a prioritized list and the high-priority items are resolved (or explicitly re-accepted with rationale)
  2. The two carried-over debug sessions (`feed-not-auto-populating-after-force-new-day`, `vine-chip-not-clearing-after-force-new-day`) are root-caused and either fixed or moved to `debug/resolved/`
  3. Auto-generated podcast is verified working on a real device and any defects found are fixed
  4. Known-deferred test failures (e.g. the stale `buildFallbackPosts` test contract) are resolved or formally re-accepted with documented rationale, and the full suite + `tsc` are green
  5. Bugs surfaced by a logic/edge-case/race-condition audit are fixed and covered by tests where practical

**Plans**: 8 plans (4 original + 4 gap-closure, all Wave 1 / parallel — disjoint files)

- [x] 54-01-PLAN.md — Close out QUALITY-02 debug sessions, QUALITY-03 podcast todo, TECHDEBT-14 green-suite re-acceptance
- [x] 54-02-PLAN.md — QUALITY-01 whole-codebase bug audit + behavior-observing regression tests
- [x] 54-03-PLAN.md — TECHDEBT-13 scored severity x reach tech-debt inventory (deliverable)
- [x] 54-04-PLAN.md — TECHDEBT-13 top-tier resolution: delete dead code, clear lint, operator decision

### Phase 55: Algorithm & Mechanism Tuning

**Goal**: The app's numeric thresholds and signal-driven mechanisms behave as intended and are tuned with documented, test-backed rationale rather than guesswork; the heavy store layer escapes the localStorage quota by migrating to a SQLite-primary backend.
**Depends on**: Phase 54
**Requirements**: TUNE-01, TUNE-02, TUNE-03
**Success Criteria** (what must be TRUE):

  1. Classification-dedup and filter cosine-similarity thresholds are reviewed and set to documented values, and the cosine-similarity threshold cache-miss todo is resolved
  2. The filter mechanism is exercised against expected behavior (off-topic, on-topic, malicious) and any threshold drift is corrected without re-opening the buried-payload evasion surface
  3. The recommendation, feed-randomizer, and "like"-signal mechanisms are tested against expected behavior and tuned, with each tuned constant accompanied by a rationale comment
  4. The curiosity-feed buffer queue reliably refills: swipe-for-more serves the intended batch (8 posts) whenever the derived list has unread capacity, and the intermittent under-refill (1 / 4 / 0 new posts) is root-caused — queue-size check + refill-threshold + walker-batch interaction fixed and covered by regression tests
  5. The heavy/growing text stores migrate off localStorage to a SQLite-primary backend (WASM SQLite in the browser, native on device) with the synchronous service-read API preserved via an in-memory mirror, embedding vectors stored as Float32 BLOBs, a clean cutover, and the delete-guard + always-mounted resync intact (folded scope, D-09..D-13)

**Plans**: 6 plans

- [x] 55-01-PLAN.md — Wave 0 test scaffolds + @sqlite.org/sqlite-wasm OPFS spike (migration go/no-go gate)
- [x] 55-02-PLAN.md — In-memory embed cache + pipeline hand-off (TUNE-01, folded cache-miss todo)
- [x] 55-03-PLAN.md — Threshold audit: per-threshold debug knobs + malicious clamp + golden fixtures (TUNE-01/02, security)
- [x] 55-04-PLAN.md — Like-signal → derived-list multiplicity boost + STYLE_WEIGHTS/trajectory verify-and-keep (TUNE-02)
- [x] 55-05-PLAN.md — Storage migration to SQLite-primary (WASM backend, Float32 BLOB, clean cutover, delete-guard) (TUNE-01)
- [x] 55-06-PLAN.md — Feed buffer-queue refill reliability: root-cause the intermittent 1/4/0-post under-refill, fix the size-check + refill-threshold + walker-batch interaction, add regression tests (TUNE-03)

### Phase 55.1 (INSERTED): Device-Test Bug Fixes

**Goal**: Four regressions surfaced by on-device testing are root-caused and fixed: chat answers never cross sessions, persisted post content survives provider/locale switches intact, and the Ask-screen keyboard interaction is stable (no nav-bar flicker, send works on first tap).
**Inserted**: 2026-05-21, after Phase 55, from a device-test session. Sits before Phase 56 because two of the four are correctness/blocker bugs (response leakage, can't-send-on-first-tap), not cosmetic polish.
**Depends on**: Phase 55 (current code baseline)
**Requirements**: BUGFIX-01, BUGFIX-02, BUGFIX-03, BUGFIX-04 (original); BUGFIX-05, BUGFIX-06, BUGFIX-07 (device-test follow-ons folded in via gap closure 2026-05-21); BUGFIX-08 (low-latency post-body model — new feature, gap closure round 4)
**Success Criteria** (what must be TRUE):

  1. A streaming LLM answer is bound to the session it was requested for: the rapid ask → new-session → ask → new-session sequence never renders a prior session's response under a different session's question. The leak is root-caused (request→session binding in `useQuestions`/`session.service`, and/or aborting the in-flight stream on session switch) and covered by a regression test. (BUGFIX-01)
  2. Switching the LLM provider (e.g. to Gemini) or the locale does NOT mutate or truncate already-generated posts: existing text-art posts that showed full sentences keep their full text and never collapse to a few words / a single token. The corrupting trigger is identified and persisted post content is treated as immutable by provider/locale change handlers. Covered by a test that exercises a provider/locale change against existing posts. (BUGFIX-02)
  3. On the Ask screen, opening the keyboard raises the input island smoothly with NO bottom-navigation-bar flicker (the nav bar does not animate up/down during the keyboard transition). Consistent with the existing SwipeTabContainer keyboard/resize and root-overflow invariants (CLAUDE.md). (BUGFIX-03)
  4. On the Ask screen, tapping Send while the keyboard is open sends the message on the FIRST tap — the tap is not consumed by keyboard dismissal (e.g. fire on pointer-down / preserve input focus so the send handler runs before blur). (BUGFIX-04)
  5. (Gap closure) The Ask-screen input bar animates smoothly to its keyboard-open position instead of teleporting, with the nav instant-hide fix preserved. (BUGFIX-05 / GAP-A)
  6. (Gap closure) The Planner trellis stays smooth on large graphs and with Trellis Dev Mode on — leaf framer-motion animations pause when the Planner is off-screen so they don't starve the compositor during cross-screen swipes; leaf-state semantics unchanged. (BUGFIX-05 / GAP-B, re-targeted round 4 — render/animation layer, not the build path)
  7. (Gap closure) The ~1-min cold-start first-LLM-response is instrumented, the measured stall localized and fixed; warm responses stay fast. (BUGFIX-06 / GAP-C)
  8. (Gap closure) The Home 'Nothing new today' empty-state no longer contradicts a populated feed (hidden or localized reword across all 4 bundles). (BUGFIX-07 / GAP-D)
  9. (Gap closure, round 4) A separate user-configurable low-latency generation model can be set; when configured, the on-open one-shot generators (post body, news essay, post-context Q&A) stream from it with thinking/reasoning disabled so the body starts streaming immediately on tap-in; falls back to the main model when unset, and Ask Q&A keeps the main model. (BUGFIX-08 / GAP-E)

**Plans**: 11 plans

- [x] 55.1-01-PLAN.md — BUGFIX-01: bind streaming answer to originating session (origin-gated persist + abort-on-switch)
- [x] 55.1-02-PLAN.md — BUGFIX-02: stop provider/locale switch from truncating text-art posts (reject-empty gate + persist-merge guard + Gemini budget/thinkingConfig)
- [x] 55.1-03-PLAN.md — BUGFIX-03: useKeyboard hysteresis so the bottom nav doesn't flicker on keyboard open
- [x] 55.1-04-PLAN.md — BUGFIX-04: Send fires on pointerdown+preventDefault (first-tap send) via shared submitMessage
- [x] 55.1-05-PLAN.md — GAP-A (BUGFIX-05): animate ChatInput reposition on keyboard open (CSS transition off visualViewport; preserves nav instant-hide + ChatInput/overflow invariants)
- [x] 55.1-06-PLAN.md — GAP-B (BUGFIX-05): profile Planner trellis at scale FIRST, then fix the measured bottleneck (recompute throttle / memoized leaf state / batched blossom writes / memoized leaf render)
- [x] 55.1-07-PLAN.md — GAP-C (BUGFIX-06): instrument cold-start first-ask FIRST, then fix the measured stall (boot warm-up of the dominant phase); byte-stable prompt + malicious gate preserved
- [x] 55.1-08-PLAN.md — GAP-D (BUGFIX-07): fix Home empty-state contradiction (hide-when-feed-nonempty OR localized reword across 4 bundles)
- [x] 55.1-09-PLAN.md — GAP-B (BUGFIX-05) RE-TARGET: pause trellis leaf framer-motion animations when Planner is off-screen (shouldAnimateTrellis gate, render-layer fix; 55.1-06 optimized the bypassed build path)
- [x] 55.1-10-PLAN.md — GAP-E (BUGFIX-08) NEW: configurable low-latency generation model for on-open post-body/news/context-QA, thinking disabled per provider, falls back to main model; 4-bundle i18n
- [x] 55.1-11-PLAN.md — GAP-A (BUGFIX-05) ATTEMPT 2: drive ChatInput position continuously off visualViewport so the bar follows the keyboard frame-by-frame (decay approach from 55.1-05 rejected)

**UI hint**: yes (issues 3 + 4 are Ask-screen keyboard/layout)

### Phase 56: UI Polish & Documentation

**Goal**: Screens look and feel finished within the Android WebView budget, navigation is sound end-to-end, and the project's documentation reflects the current state of the code.
**Depends on**: Phase 54
**Requirements**: POLISH-01, POLISH-02, POLISH-03, DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):

  1. Screens are swept against a UI-polish checklist and identified spacing/alignment/visual-hierarchy issues are fixed
  2. Missing or janky animations and transitions are added or fixed across screens within the Android WebView performance budget
  3. Navigation is audited end-to-end and wrong, dead-end, or broken back-button paths are fixed
  4. Stale documents in `Documents/` and `.planning/` are archived or updated to reflect current state
  5. CLAUDE.md load-bearing sections are verified against the current code and any drift is corrected

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 56-01-PLAN.md — Read-only audit: produce 56-FINDINGS.md (scored polish/animation/navigation findings + doc-staleness inventory) and 56-CLAUDE-DRIFT-REPORT.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 56-02-PLAN.md — Operator triage checkpoint: record approved worklist into 56-TRIAGE.md (per-jank remove-vs-simplify, per-drift approved direction)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 56-03-PLAN.md — Animation/visual polish fixes (POLISH-01/02): jank keyframes → compositor-safe, prefers-reduced-motion, approved hex→token
- [x] 56-04-PLAN.md — Navigation / Android back-button reconciliation (POLISH-03) on approved findings; preserve single global back handler + Header portal split
- [ ] 56-05-PLAN.md — Doc archival to Legacy via git mv (DOCS-01) + confirm-first CLAUDE.md drift corrections (DOCS-02)

**UI hint**: yes

### Phase 57: Rewards Foundation — Data Model & Service

**Goal**: The cosmetic-shop data layer is locked and trustworthy — ownership and credits mutate atomically, earned cosmetics survive Clear-All-Data, themes apply without a boot flash, and the non-pushy stance is codified in a test before any UI exists.
**Depends on**: Phase 54 (clean baseline); independent of Phases 55–56
**Requirements**: REWARDS-08
**Success Criteria** (what must be TRUE):

  1. `cosmeticsService` (over a new `trellis_cosmetics` localStorage key, separate from settings) exposes synchronous `purchase`/`equip`/`unequip`/`getOwned`/`getEquipped`/`isOwned`, with `trellisCreditsService.subtract()` added and purchase using deduct-then-grant so there is no double-spend
  2. `COSMETICS_CHANGED` (with `kind` discriminant) and `CREDITS_CHANGED` events exist in the `AppEvent` union, and theme CSS-variable blocks plus a synchronous boot-time `applyCosmetic()` apply an equipped theme before first render (no FOUC)
  3. Clear-All-Data preserves purchased cosmetics — the reset path excludes `trellis_cosmetics`
  4. A guardrail test (extending the v1.6 Phase 53 guardrail) asserts the shop data model has no scarcity-timer / `expiresAt` / `rarity` / `rotatingStock` / `lootBox` / streak-linked / functional-power-up fields, and that earn rates remain harvest + daily-read only

**Plans**: TBD

### Phase 58: Rewards Core Shop Loop — Themes

**Goal**: A user can spend earned credits end-to-end — browse the catalog, preview, confirm a purchase, and equip a color theme that applies app-wide — reachable from both a garden entry point and a post-harvest nudge, with all UI chrome localized.
**Depends on**: Phase 57
**Requirements**: REWARDS-01, REWARDS-02, REWARDS-03, REWARDS-04, REWARDS-07, REWARDS-09
**Success Criteria** (what must be TRUE):

  1. User can open the shop, see their fruit-credit balance, and browse a catalog of cosmetics grouped by category with owned / locked / equipped states clearly shown
  2. User can preview a cosmetic, confirm a two-step purchase that decrements the balance atomically and grants ownership, and sees clear insufficient-funds feedback when they can't afford an item
  3. User can equip and unequip an owned color theme and it applies app-wide via the CSS-variable system, independent of the light/dark setting and persisting across restart
  4. The shop is reachable from a Planner/garden entry point AND from a one-line nudge after the harvest celebration, and the credit balance + equipped theme stay in sync on always-mounted screens (PlannerScreen/HomeScreen) via `COSMETICS_CHANGED`/`CREDITS_CHANGED` + `[location.pathname]` resync
  5. All new shop UI strings land in all four locale bundles (en/zh/es/ja) and `bundle-parity.test.mjs` passes; cosmetic item names remain English branded identifiers

**Plans**: TBD
**UI hint**: yes

### Phase 59: Rewards Pet Companion & Garden Cosmetics

**Goal**: A user can personalize the Planner garden with a purchasable pet companion and garden/trellis cosmetics that render in the garden visual without regressing Header positioning or animation performance.
**Depends on**: Phase 58
**Requirements**: REWARDS-05, REWARDS-06
**Success Criteria** (what must be TRUE):

  1. User can purchase and equip trellis/garden cosmetics (backgrounds, pots, vines, fruit skins) that render in the Planner garden via a `TrellisBackground` dispatcher
  2. User can purchase and equip a pet/companion that appears in the garden, rendered as a CSS/SVG idle animation behind a render abstraction that leaves room for a future Rive upgrade (Rive itself deferred to v2 / REWARDS-F1)
  3. Equipped garden cosmetics and pet stay in sync with shop changes on the always-mounted PlannerScreen, and equipping a cosmetic introduces no Header-positioning regression (no `transform`/`will-change`/`filter` on Header ancestors) and no animation jank (pet animation gated on the perf-mask threshold, animating `opacity`/`transform` only)

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 54 → 55 → 55.1 → 56 → 57 → 58 → 59

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 54. Code Quality, Bugs & Tech Debt | v1.7 | 5/4 | Complete    | 2026-05-21 |
| 55. Algorithm & Mechanism Tuning | v1.7 | 7/6 | Complete    | 2026-05-21 |
| 55.1. Device-Test Bug Fixes (INSERTED) | v1.7 | 11/11 | Complete   | 2026-05-22 |
| 56. UI Polish & Documentation | v1.7 | 4/5 | In Progress | - |
| 57. Rewards Foundation — Data Model & Service | v1.7 | 0/TBD | Not started | - |
| 58. Rewards Core Shop Loop — Themes | v1.7 | 0/TBD | Not started | - |
| 59. Rewards Pet Companion & Garden Cosmetics | v1.7 | 0/TBD | Not started | - |

## Shipped Phases (archived)

<details>
<summary>✅ v1.6 — Control, Graph Trust, Retrieval, and Ethical Engagement (Phases 47–53) — SHIPPED 2026-05-20</summary>

- [x] Phase 47: Filter Redesign — Off-Topic + Malicious Prompt Prevention (6/6 plans) — FILTER-01..05
- [x] Phase 48: Graph Command Service and Trust Invariants (4/4 plans) — GRAPH-01..04
- [x] Phase 49: Graph Correction UI (6/6 plans) — GRAPHUI-01..03
- [x] Phase 50: Retrieval and Library Foundation (13/13 plans) — RETRIEVE-01..02
- [x] Phase 51: Concept Dashboard and Recovery Surfaces (1/1 plan) — RETRIEVE-03..04
- [x] Phase 52: Podcast Quality Defaults and Learner Controls (6/6 plans) — PODCAST-01..05
- [x] Phase 53: Provider Privacy + Non-Pushy Guardrail (3/3 plans) — LEARN-04, PRIVACY-01

Full detail: `.planning/milestones/v1.6-ROADMAP.md` · Phase artifacts: `.planning/milestones/v1.6-phases/`

</details>

Earlier milestones: `.planning/milestones/v1.5-ROADMAP.md`, `v1.4-ROADMAP.md`, `v1.0-ROADMAP.md`.
