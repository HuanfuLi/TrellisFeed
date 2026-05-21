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
- [ ] **Phase 55: Algorithm & Mechanism Tuning** - Review and tune numeric thresholds with documented rationale; test and tune filter, recommendation, feed randomizer, and "like" mechanisms; migrate the heavy store layer to SQLite-primary
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
**Plans**: 4 plans
- [x] 54-01-PLAN.md — Close out QUALITY-02 debug sessions, QUALITY-03 podcast todo, TECHDEBT-14 green-suite re-acceptance
- [x] 54-02-PLAN.md — QUALITY-01 whole-codebase bug audit + behavior-observing regression tests
- [x] 54-03-PLAN.md — TECHDEBT-13 scored severity x reach tech-debt inventory (deliverable)
- [x] 54-04-PLAN.md — TECHDEBT-13 top-tier resolution: delete dead code, clear lint, operator decision

### Phase 55: Algorithm & Mechanism Tuning
**Goal**: The app's numeric thresholds and signal-driven mechanisms behave as intended and are tuned with documented, test-backed rationale rather than guesswork; the heavy store layer escapes the localStorage quota by migrating to a SQLite-primary backend.
**Depends on**: Phase 54
**Requirements**: TUNE-01, TUNE-02
**Success Criteria** (what must be TRUE):
  1. Classification-dedup and filter cosine-similarity thresholds are reviewed and set to documented values, and the cosine-similarity threshold cache-miss todo is resolved
  2. The filter mechanism is exercised against expected behavior (off-topic, on-topic, malicious) and any threshold drift is corrected without re-opening the buried-payload evasion surface
  3. The recommendation, feed-randomizer, and "like"-signal mechanisms are tested against expected behavior and tuned, with each tuned constant accompanied by a rationale comment
  4. The heavy/growing text stores migrate off localStorage to a SQLite-primary backend (WASM SQLite in the browser, native on device) with the synchronous service-read API preserved via an in-memory mirror, embedding vectors stored as Float32 BLOBs, a clean cutover, and the delete-guard + always-mounted resync intact (folded scope, D-09..D-13)
**Plans**: 5 plans
- [ ] 55-01-PLAN.md — Wave 0 test scaffolds + @sqlite.org/sqlite-wasm OPFS spike (migration go/no-go gate)
- [ ] 55-02-PLAN.md — In-memory embed cache + pipeline hand-off (TUNE-01, folded cache-miss todo)
- [ ] 55-03-PLAN.md — Threshold audit: per-threshold debug knobs + malicious clamp + golden fixtures (TUNE-01/02, security)
- [ ] 55-04-PLAN.md — Like-signal → derived-list multiplicity boost + STYLE_WEIGHTS/trajectory verify-and-keep (TUNE-02)
- [ ] 55-05-PLAN.md — Storage migration to SQLite-primary (WASM backend, Float32 BLOB, clean cutover, delete-guard) (TUNE-01)

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
**Plans**: TBD
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
Phases execute in numeric order: 54 → 55 → 56 → 57 → 58 → 59

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 54. Code Quality, Bugs & Tech Debt | v1.7 | 5/4 | Complete    | 2026-05-21 |
| 55. Algorithm & Mechanism Tuning | v1.7 | 0/5 | Not started | - |
| 56. UI Polish & Documentation | v1.7 | 0/TBD | Not started | - |
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
