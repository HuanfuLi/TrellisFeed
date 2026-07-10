# Research Summary — Trellis v1.7 Cosmetic Rewards Shop

**Project:** Trellis v1.7
**Domain:** Local-first cosmetic rewards shop (coin-purchasable themes, pet companions, garden cosmetics)
**Researched:** 2026-05-20
**Scope note:** This research covers ONLY the cosmetic rewards shop (item 7 of the v1.7 milestone). The other six v1.7 areas are internal cleanup and hardening; they were intentionally not researched. This summary makes no claims about those areas.
**Confidence:** HIGH for stack integration, architecture patterns, and anti-feature identification; MEDIUM for economy balance and pet animation library choice

---

## Executive Summary

The v1.7 rewards shop gives Trellis's existing fruit credits a destination. Credits already exist (`trellis_fruit_credits`, `trellisCreditsService`). The shop adds a place to spend them on cosmetics: color themes, pet companions, and garden skins. No new earning mechanics are introduced. The earn-to-spend loop is: spaced-repetition completion to fruit harvest to credits to cosmetics. All four research files confirm the same architecture: a new `cosmeticsService` backed by a separate `trellis_cosmetics` localStorage key, a `ShopScreen` sub-route at `/settings/shop`, CSS class injection for themes, and SVG/CSS layers for garden cosmetics. No payment infrastructure, no backend, no new state management library.

The recommended build order is themes first. CSS custom-property theming requires zero new render infrastructure (the `:root` variable system is already in place), unblocks the full buy-preview-equip loop for validation, and is deliverable in a single focused phase. Pet companions and garden vine skins each require new render slots in existing screens and belong in a second phase after the core loop is trusted. The shop's non-pushy constraint — no scarcity timers, no loot boxes, no streak-linked cosmetics, no functional power-ups — is load-bearing and must be enforced in the data model before any UI is built.

The most operationally significant risks are: (1) the Header positioning invariant (no `transform`/`will-change`/`filter` on theme or pet wrapper ancestors, enforced since Phase 32.1 across six regressions); (2) the always-mounted stale-state pattern (PlannerScreen and HomeScreen read service state once at boot — equipped cosmetics and credit balance both need `COSMETICS_CHANGED` + `[location.pathname]` resync effects); (3) purchase atomicity (deduct-then-grant in a single logical write, never split across two `localStorage.setItem` calls); and (4) Android WASM validation for Rive if the pet route is chosen. All four are well-understood and preventable with the patterns documented in ARCHITECTURE.md and PITFALLS.md.

---

## Open Questions Requiring Operator Decisions

These must be resolved before or during requirements definition. They are not answerable from research alone.

### OQ-1: Economy Balance — Actual Earn Rate

**What the codebase actually does today:**
- Trellis harvest (`TrellisStatusPanel.handleHarvest`): `trellisCreditsService.add(count)` — awards **1 credit per fruit node** in the harvest batch. A user harvesting 3 ripe concepts gets 3 credits.
- Daily feed completion (`HomeScreen`): `trellisCreditsService.add(1)` — awards **1 credit once per day** when the daily read quota is met.

**The question:** Are these earn rates appropriate for the shop? The FEATURES research recommends 25–50 credits per harvest event, which is far higher than the current 1-per-node rate. At 1 credit per fruit node, a cheapest-tier item at 50 credits requires harvesting 50 individual concepts — many weeks of active use. At 5 credits per node it requires 10 harvests, which feels more rewarding for a new user.

**Decision needed:** Confirm or adjust per-harvest-node credit yield before pricing any shop items. The pricing tier table in FEATURES.md (Starter: 50–75 credits; Standard: 100–150; Premium: 200–250) was designed assuming a higher earn rate than the current 1-per-node. Either raise the earn rate or lower the price floor — decide both consistently.

### OQ-2: Shop Navigation Entry Point

Three options researched:

- `/settings/shop` sub-route (ARCHITECTURE recommendation): zero blast radius, consistent with existing sub-screen pattern, correct for an infrequently visited screen. Downside: slightly buried, user must open Settings to find it.
- 6th swipe tab: maximum discoverability. Downside: requires changes to `SwipeTabContainer` (hardcoded 5 slots), `BottomNavigation`, and `SCREEN_ROUTES` — high blast radius for an infrequently accessed screen.
- Harvest-nudge-only discovery (no dedicated nav entry): minimal surface area. Downside: shop only reachable after a harvest; new users with 0 credits have no way to browse.

**Recommendation from research:** `/settings/shop`. Add a secondary harvest-moment nudge ("Visit Garden Shop") for discoverability.

**Decision needed:** Confirm `/settings/shop` or specify an alternative before the navigation scaffold phase.

### OQ-3: Cosmetic Item Names — i18n Keys vs. English-Only Branded Identifiers

Should cosmetic item names (e.g., "Autumn Garden", "Winter Frost", "Sakura Theme") be stored as i18n keys (four locale translations each, added to all bundles) or as English-only branded identifier strings (appear in English in all locales)?

Trade-offs:
- i18n keys: localized display names, 4x bundle entries per item, Sonnet subagent translate run required for each new item, some names may not translate well
- English-only branded: simpler, consistent with how "Trellis", "OpenAI", "Claude" are handled in i18n (never translated), no bundle overhead, but Chinese/Japanese/Spanish UIs show English cosmetic names

**Decision needed:** Explicit choice before the shop data model is locked. Either is acceptable but must be decided once and applied consistently. `bundle-parity.test.mjs` will block PRs if EN keys are added without all four bundles.

### OQ-4: Pet Implementation — Rive vs. CSS/SVG

Two viable options:

`@rive-app/react-canvas` (STACK recommendation): New 78KB WASM runtime, lazy-loaded. Android risk: MEDIUM — WASM fetch in Capacitor Android WebView has one known edge case (opaque response if `server.androidScheme` not set); requires device validation before ship. Capability: multi-state character rig (idle, tap reaction, celebrate, sleep) in a designer-authored `.riv` file.

CSS/SVG spritesheet `@keyframes steps()`: No new dependency, no Android risk. Capability: single-state idle loop only; no tap reactions; zero dependency, instant load.

**Decision needed:** Does the pet need multi-state animation? If yes, Rive is correct but requires Android WASM device validation before the pet phase ships. If the pet is a decorative bobbing sprite with no interactivity, CSS spritesheet is simpler and safer.

### OQ-5: Clear-All-Data and Purchased Cosmetics

Should "Clear All Data" in Settings wipe purchased cosmetics (owned inventory), or preserve them?

**Research recommendation:** Preserve owned cosmetics. Ownership is earned virtual goods (like a purchase receipt), not cached data. `SettingsDataScreen.clearAllData` currently removes all `trellis_` keys except `trellis_settings`; it must be updated to also exclude `trellis_cosmetics` if ownership is meant to survive. Equipped theme/pet preference can live in `trellis_settings` so it follows the user's normal "reset preferences" expectation.

**Decision needed:** Confirm "preserve owned cosmetics through Clear-All-Data" or choose a different behavior. This determines whether `trellis_cosmetics` is in the clear-all exclusion list — must be decided before the data model is finalized.

---

## Key Findings

### Recommended Stack

No new frameworks. The entire shop is buildable on the existing React 19 + TypeScript + framer-motion + localStorage + eventBus stack. One conditional addition: `@rive-app/react-canvas` (`^4.28.5`) if multi-state pet animation is required (see OQ-4). Without that, zero new production dependencies.

**Core technologies (all existing):**
- React 19 + TypeScript 5.9 — shop screen, purchase flow, all standard component patterns
- framer-motion `^12.39.0` (already installed) — purchase confirmation animations, stagger entrance for shop grid, coin-fly particle; sufficient for all shop UI motion
- CSS custom properties (`--primary-40`, `--surface`, etc.) — themes via `html.theme-forest {}` class injection; zero runtime cost, orthogonal to existing `.dark` class
- `eventBus` (`src/lib/event-bus.ts`) — `COSMETICS_CHANGED` (single event, `kind` discriminant) + `CREDITS_CHANGED`; existing typed pub/sub covers all cross-screen notification needs
- localStorage via new `cosmeticsService` — `trellis_cosmetics` key for owned inventory + equipped state; `trellis_fruit_credits` (existing) extended with `subtract(n)` method

**New dependency (conditional):**
- `@rive-app/react-canvas` — warranted only for multi-state pet character rig; lazy-loaded, WASM is 78KB; requires Android device validation before ship

**What not to add:** Payment SDKs (no real-money transactions), Redux/Zustand/Jotai (existing services + eventBus are sufficient), Lottie (no state machine advantage over Rive), heavy game engines (garden is SVG, not a game scene), CSS-in-JS theming libraries (CSS vars + class toggling is zero-runtime), backend/API server.

### Expected Features

**Must have — table stakes (Phase 1, core shop loop):**
- Coin balance display in shop header — reactive to credit changes
- Browse catalog grid grouped by category — owned/locked/equipped states visible at a glance
- Item preview before purchase — live CSS-var theme preview for themes; illustration for companions
- Two-step purchase confirmation — "Buy for N credits" button to confirm sheet; no swipe-to-confirm
- Owned vs. locked display states — "Owned" chip replaces price; "Equip"/"Equipped" button per slot
- Equip/unequip for themes via CSS class injection — persisted in `trellis_cosmetics`, reapplied on boot before first render
- Persist ownership + equipped state — localStorage `trellis_cosmetics`; survives app restart
- Insufficient-funds feedback — "You need N more credits" inline; show the item, explain the deficit
- Harvest-moment shop nudge — one-line after harvest animation, dismiss on tap; the only in-app reference to the shop outside the shop itself
- "New items" badge on shop entry point — clears immediately on shop open

**Should have — differentiators (Phase 2):**
- Pet/companion render slot in `TrellisHero` — pose reflects vine leaf state (passive, not neglect-based)
- Garden background variants and vine skins — 2–3 variants at launch
- Additional color themes — expand from 3–5 to 6–8 based on feedback
- "Earned, not given" framing — copy as "Garden Shop" or "Harvest Shop"

**Defer to v2+:**
- Cross-device shop sync (requires auth + backend)
- Animated themes with particle effects (performance validation on low-end Android required)
- Sound packs (TTS/audio system audit required)
- Seasonal featured section (items highlighted not removed; permanent catalog still applies)

**Anti-features — must never be built:**
- Scarcity timers, countdown clocks, rotating daily stock
- Loot boxes / randomized purchase outcomes at any layer
- Limited-edition drops that disappear permanently
- Streak-linked cosmetics (streaks are prohibited project-wide)
- Social comparison, rarity tiers, "N users own this"
- Real-money credit purchases
- Daily login bonus credits (rewards presence, not learning)
- Credit-multiplier power-ups (a stop-cue by another name)
- Functional advantages bundled into cosmetic purchases
- Upsell banners or modal prompts in non-shop screens (one harvest nudge is the only permitted reference)

### Architecture Approach

The shop integrates as a thin service layer plus a new sub-screen on top of existing infrastructure. `cosmeticsService` (new) owns `trellis_cosmetics` — a separate key from `trellis_settings` so `settingsService.reset()` cannot wipe earned inventory. `trellisCreditsService` (existing) gains a `subtract(n)` method. Theme cosmetics propagate via `html.theme-forest` class injection (same mechanism as `.dark`). Garden cosmetics propagate via PlannerScreen state driven by `COSMETICS_CHANGED` events. The pet renders as a positioned overlay inside `TrellisHero`'s `position: relative; isolation: isolate` container at `zIndex: 25` (above `TrellisCanvas` at `zIndex: 20`).

**Major components:**
1. `cosmeticsService` — ownership ledger (`getOwned`, `getEquipped`, `purchase`, `equip`, `unequip`); all synchronous `ServiceResult<T>`; deduct-then-grant purchase order; static TypeScript catalog (no API)
2. `ShopScreen` at `/settings/shop` — browse/buy/equip UI; entry via `SettingsScreen` MenuRow
3. `lib/theme.ts: applyCosmetic()` — CSS class injection for theme cosmetics; called synchronously at boot and on `COSMETICS_CHANGED` equip events
4. `TrellisBackground` dispatcher + `TrellisPet` — pure render components receiving equipped IDs as props from PlannerScreen; no service calls inside
5. Static cosmetic catalog — TypeScript constant; item IDs stored in localStorage, definitions bundled with app
6. `COSMETICS_CHANGED` event (single event, `kind: 'purchase' | 'equip' | 'unequip'` discriminant) — follows `COLLECTIONS_CHANGED` precedent; do NOT add a parallel `THEME_CHANGED` event

**Build order (dependency-driven):**
1. `CosmeticsState` type + `COSMETICS_CHANGED` + `CREDITS_CHANGED` in `types/index.ts`
2. `cosmeticsService` + `trellisCreditsService.subtract()`
3. `applyCosmetic()` in `lib/theme.ts` + boot call + `App.tsx` subscriber
4. Cosmetic theme CSS var blocks in `index.css`
5. `TrellisBackground` dispatcher + `TrellisPet`
6. PlannerScreen resync wiring (state + effects)
7. `ShopScreen` + route + `SettingsScreen` MenuRow

### Critical Pitfalls

Eleven pitfalls were identified. Top five by severity and likelihood:

1. **Pushy mechanics smuggled through cosmetic framing** — Scarcity timers, loot boxes, grind-tuned earn rates, and social comparison violate the operator's non-pushy stance documented in CLAUDE.md and MEMORY.md. Prevention: lock the data model to fixed-price permanent items before any UI; extend the Phase 53 privacy-guardrail test to assert no `countdownTimer`, `expiresAt`, `rarity`, `rotatingStock`, or `lootBox` fields exist in shop service code paths.

2. **Header positioning regression from theme or pet wrapper CSS** — A `transform`, `will-change`, `filter`, or `backdrop-filter` on any ancestor of a `Header` re-parents its fixed-position containing block, causing flicker on Android WebView. This regression has appeared six times in commit history (`8df7980c`, `a7203a65`, `2dcef5d7`, `73d657a0`, `b4965feb`, `808c6e85`). Prevention: theme CSS restricted to color/font/border-radius vars only; pet/ornament outer wrappers must never carry these properties; validate on a real Android device, not simulator.

3. **Purchase double-spend from split localStorage writes** — Balance deduction in `trellis_fruit_credits` and ownership grant in `trellis_cosmetics` are two separate `setItem` calls. A process suspension between them leaves coins deducted without item granted. Prevention: deduct-then-grant order (acceptable failure direction: coins lost, not item granted free); Phase 2 mitigation: `pendingRefund` field in `trellis_cosmetics` re-credited on boot.

4. **Always-mounted stale state for equipped cosmetics and credit balance** — PlannerScreen (`useState(() => trellisCreditsService.getTotal())` at line 38) and HomeScreen initialize state once at boot. A cosmetic equipped in ShopScreen will not appear in the garden without `COSMETICS_CHANGED` subscription or `[location.pathname]` resync effect. The credit balance also desynchronizes after purchase because `HARVEST_COMPLETED` is not the right event for a deduction. Prevention: add `CREDITS_CHANGED` event; add two-layer resync (event subscription + location effect) on all always-mounted screens rendering cosmetic state.

5. **Boot flash-of-unstyled-content for purchased themes** — Any theme applied in a `useEffect` arrives one frame late on Android WebView. Prevention: apply the cosmetic theme class synchronously in a `<head>` `<script>` block before React mounts (same approach as the existing dark/light toggle).

Additional pitfalls: pet animation jank on Android (gate on `AMBIENT_SWAY_THRESHOLD` from `trellis-perf-mask.ts`; animate `opacity`/`transform` only, never `width`/`height`/`color`); equipped cosmetic with no owned-inventory fallback after Clear-All-Data; missing locale bundle keys blocking PRs (`bundle-parity.test.mjs`); localStorage quota exhaustion from storing catalog blobs (store IDs only, bundle assets statically); Android WASM opaque response for Rive (self-host `.wasm` in `app/public/`, validate `server.androidScheme`).

---

## Implications for Roadmap

Based on combined research, the shop breaks naturally into a foundation lock, a core-loop phase, and a companion/garden phase.

### Phase A: Data Model + Service Foundation

**Rationale:** All subsequent phases depend on `CosmeticsState`, `cosmeticsService`, `trellisCreditsService.subtract()`, `COSMETICS_CHANGED` + `CREDITS_CHANGED` events, and the non-pushy data model constraints being locked first. The Clear-All-Data exclusion decision (OQ-5) must also be made here because it determines the key structure.

**Delivers:** `CosmeticsState` interface (`owned: string[]`, `equipped: { theme?, background?, pet?, leafStyle? }`); `cosmeticsService` with `purchase()` (deduct-then-grant), `equip()`, `unequip()`, `getOwned()`, `getEquipped()`, `isOwned()`; `trellisCreditsService.subtract(n)`; `COSMETICS_CHANGED` + `CREDITS_CHANGED` in `AppEvent` union; static cosmetic catalog type with 3–5 initial theme entries; `applyCosmetic()` in `lib/theme.ts` with synchronous boot call; cosmetic theme CSS var blocks in `index.css`.

**Avoids:** Double-spend (atomic purchase), Clear-All-Data breakage (separate key with confirmed exclusion), pushy mechanics (model-level guardrail and extended test), boot FOUC (synchronous class application).

**Operator decisions required before this phase:** OQ-1 (earn rate and price tier), OQ-3 (item names i18n vs. branded), OQ-5 (Clear-All-Data behavior).

**Research flag:** No research phase needed — all integration points verified against live code.

### Phase B: Core Shop Loop (Themes)

**Rationale:** Themes have the lowest infrastructure cost (no new render slots) and prove the full buy-preview-equip-persist loop end-to-end with real users before investing in companion and garden skin infrastructure.

**Delivers:** `ShopScreen` at `/settings/shop` (browse grid, item detail with live theme preview, purchase confirmation, equip/unequip); `SettingsScreen` MenuRow entry + `App.tsx` router registration; PlannerScreen + HomeScreen `COSMETICS_CHANGED` event subscription + `[location.pathname]` resync effects for credit balance and equipped cosmetics; harvest-moment shop nudge; "New items" badge; all shop locale strings in all four bundles (`bundle-parity.test.mjs` must pass).

**Avoids:** Always-mounted stale state (resync effects and event subscriptions wired), Header positioning regression (theme CSS property audit before ship), missing locale bundles (EN-first workflow with Sonnet subagent before PR).

**Operator decision required before this phase:** OQ-2 (navigation entry point — confirm `/settings/shop` or specify alternative).

**Research flag:** No research phase needed. CSS class injection, sub-route navigation, and always-mounted resync are canonical patterns in this codebase with documented examples.

### Phase C: Pet Companion + Garden Cosmetics

**Rationale:** Both require new render infrastructure. Pets need a slot inside `TrellisHero`. Garden backgrounds require a `TrellisBackground` dispatcher replacing the hardcoded `TrellisBackgroundA`. Build after Phase B validates that users are engaging with the earn-to-spend cycle.

**Delivers:** `TrellisPet` component inside `TrellisHero` (`position: absolute; bottom: 8px; right: 8px; zIndex: 25`); `TrellisBackground` dispatcher replacing hardcoded `TrellisBackgroundA`; 2–3 background variants; pet animation (Rive or CSS sprite per OQ-4); PlannerScreen `equippedBg` + `equippedPet` state + resync effects; pet ambient animation gated on `AMBIENT_SWAY_THRESHOLD` from `trellis-perf-mask.ts`.

**Avoids:** Header positioning regression from pet wrapper (outer wrapper has no `transform`/`will-change`; animate inner children only); pet animation jank (perf-mask gate; `opacity`/`transform` only); Android WASM validation for Rive (device test before ship).

**Operator decision required before this phase:** OQ-4 (Rive vs. CSS sprite).

**Research flag:** Targeted validation needed if Rive is chosen — validate `@rive-app/react-canvas` WASM fetch in Capacitor Android WebView on a real mid-range Android device before committing to this path. If CSS sprite is chosen, no research needed.

### Phase Ordering Rationale

- Phases A to B to C are strictly ordered by dependency: service before UI, themes before companions (infrastructure cost).
- Phase A has no UI deliverable. It can overlap with Phase B if operator decisions (OQ-1, OQ-3, OQ-5) are resolved before work starts.
- Phase C is the natural v1.7 scope boundary. Vine skins and animated themes belong in a future milestone.
- The FEATURES.md dependency graph confirms this order: ownership persistence is the root; browse catalog depends on it; equip for companions and garden vine skins are late leaves requiring Phase C infrastructure.

### Research Flags

**No additional research needed:**
- Phase A (service foundation) — all patterns verified against live code
- Phase B (shop UI + themes) — CSS class injection, sub-route navigation, and always-mounted resync are canonical documented patterns

**Phase C — targeted validation needed (Rive path only):**
- Validate `@rive-app/react-canvas` WASM fetch in Capacitor Android WebView: set `server.androidScheme`, self-host `.wasm` in `app/public/`, test on a real mid-range Android device. If validation fails, default to CSS spritesheet.
- Pet animation perf budget: manual test with 20+ trellis leaves and active pet animation on a mid-range Android device; confirm above 45fps or adjust `AMBIENT_SWAY_THRESHOLD`.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All integration points verified against live source files. Android WASM validation for Rive is MEDIUM. |
| Features | HIGH for table stakes and anti-features; MEDIUM for economy balance | Anti-feature list grounded in operator's documented stance and regulatory precedent. Economy balance is empirical — requires product decision (OQ-1) and playtest validation. |
| Architecture | HIGH | All findings verified against live source files. Service patterns, event shape precedents, z-index values, and clear-all-data behavior sourced from actual code. |
| Pitfalls | HIGH for codebase-specific risks; MEDIUM for animation/performance | Codebase pitfalls sourced from live code and documented regression commit history. Animation/performance guidance sourced from Capacitor documentation. |

**Overall confidence:** HIGH for decisions that can be made from research. MEDIUM for economy balance calibration and Android Rive WASM behavior.

### Gaps to Address

- **Economy balance (OQ-1):** Current earn rate (1 credit per fruit node, 1 credit per daily read completion) is lower than FEATURES research assumed when proposing price tiers. Operator must decide earn rate and item pricing simultaneously — they are coupled.

- **Android Rive WASM (if OQ-4 selects Rive):** Must be validated on a real device before Phase C ships. If impractical before Phase C begins, default to CSS sprite and defer Rive.

- **Vine skin graphics:** Research documents the SVG symbol/use pattern but does not specify how many variants ship or what the visual design is. Design dependency, not a technical unknown.

- **Transition from 1-credit earn rate:** If the operator raises the per-harvest credit yield, this requires a code change to `TrellisStatusPanel.handleHarvest`. Low-risk transition but should be called out explicitly in the requirements document.

---

## Sources

### Primary (HIGH confidence — live codebase reads)

- `app/src/components/trellis/TrellisStatusPanel.tsx` — confirmed per-harvest credit yield: `trellisCreditsService.add(count)` where `count = fruitNodes.length` (1 credit per fruit node)
- `app/src/screens/HomeScreen.tsx:759` — confirmed daily read completion yield: `trellisCreditsService.add(1)` (1 credit once per day)
- `app/src/services/trellis-credits.service.ts` — existing `add()` clamp logic; extension point for `subtract(n)`
- `app/src/types/index.ts:728-794` — `AppEvent` union; `COLLECTIONS_CHANGED` with `kind` as precedent; confirmed `CREDITS_CHANGED` and `COSMETICS_CHANGED` do not yet exist
- `app/src/lib/theme.ts` — `applyTheme` class-toggling pattern; extension point for `applyCosmetic()`
- `app/src/index.css:486-493` — load-bearing "no transform on Header ancestor" comment; CSS var vocabulary; `data-theme` vs class decision informed by existing `@custom-variant dark` declaration
- `app/src/components/trellis/TrellisCanvas.tsx` — `AMBIENT_SWAY_THRESHOLD = 20`; framer-motion leaf animation layer
- `app/src/services/trellis-perf-mask.ts` — `TAP_ANIMATION_THRESHOLD = 30`; perf gate pattern for pet animation gating
- `app/src/screens/settings/SettingsDataScreen.tsx:52-71` — Clear-All-Data removes all `trellis_` keys except `trellis_settings`
- `app/src/screens/PlannerScreen.tsx:38` — stale `useState(() => trellisCreditsService.getTotal())` initializer; gap to fill
- `app/src/components/trellis/TrellisHero.tsx` — `position: relative; isolation: isolate` confirmed; `TrellisBackgroundA` render point; pet z-index insertion point at `zIndex: 25`
- `app/src/App.tsx:296-323` — router sub-screen registration pattern; `applyTheme` call site at boot
- `CLAUDE.md` — Header positioning Phase 32.1 rules (six regression commit hashes cited); always-mounted re-read canonical pattern; i18n workflow; non-pushy engagement stance

### Secondary (MEDIUM confidence)

- Rive official docs (https://rive.app/docs/runtimes/react/react) — `useRive` hook, state machines, `@rive-app/react-canvas` React integration
- Pixel Point blog on Rive optimizations — WASM is 78KB; lazy-load and self-host pattern for Capacitor
- Capgo: Ultimate Guide to Animation Performance in Capacitor Apps — `will-change` overuse overhead; `opacity`/`transform` as compositor-safe properties
- Iron Source LevelUp game economy design — earn/spend ratio framework (F2P context, adapted for non-pushy constraint)
- darkpattern.games: Artificial Scarcity — countdown timers, rotating shops as documented dark patterns
- Tailwind CSS v4 docs — `@custom-variant` and CSS variable theming; class vs. `data-theme` attribute decision

### Tertiary (LOW confidence — community sentiment, illustrative)

- Ashes of Creation forums / Darktide Steam discussions — player sentiment against limited-drop cosmetics; illustrative of permanent catalog rationale
- Capacitor issues tracker #636 — localStorage inconsistency on abrupt process death; cited for double-spend atomicity pitfall

---

*Research completed: 2026-05-20*
*Scope: Trellis v1.7 cosmetic rewards shop only — other v1.7 areas (internal cleanup/hardening) were intentionally not researched*
*Ready for roadmap: yes, pending operator decisions on OQ-1 through OQ-5*
