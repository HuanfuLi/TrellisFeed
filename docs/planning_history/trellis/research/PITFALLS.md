# Pitfalls Research

**Domain:** Cosmetic rewards shop + dynamic theming + animated companions/garden cosmetics added to a local-first Capacitor mobile learning app (Trellis v1.7)
**Researched:** 2026-05-20
**Confidence:** HIGH for project-specific codebase risks (sourced from reading live code); MEDIUM for animation/performance patterns (sourced from Capacitor/WebView documentation)

> Scope: pitfalls likely when adding a coin-purchasable cosmetic shop (themes, pets/companions, trellis/garden cosmetics) to the existing Trellis codebase. Every pitfall is tied to specific code files or load-bearing invariants already documented in CLAUDE.md. Generic "gamification is bad" warnings are not included — only concrete, prevention-actionable failure modes for THIS system.

---

## Critical Pitfalls

### Pitfall 1: Reward Shop Silently Re-Introduces Pushy Mechanics Through Cosmetic Framing

**What goes wrong:**
A cosmetic shop that technically sells no power-ups can still violate the non-pushy stance through five specific sub-patterns:

1. **Artificial scarcity / rotating stock:** "Limited time" items, countdown timers, or a rotating "daily shop" that expires — even if cosmetics only — create FOMO identical to Fortnite's item shop. The v1.6 guardrail test (`tests/services/privacy-guardrail.test.mjs`) codifies a no-streaks/leaderboards/stop-cues invariant; rotating stock and countdown timers are exactly the same class of mechanism.
2. **Grind pressure from coin earn rates:** If the cheapest meaningful cosmetic costs 30 coins and users earn 1 coin per harvested fruit, the shop becomes an engagement multiplier — users must open the app and complete reviews daily just to afford items. This is a mandated-goal pattern in disguise, which MEMORY.md explicitly flags as operator-rejected (`feedback_no_pushy_engagement_mechanics.md`).
3. **Social comparison:** Showing other users' equipped themes/pets, or displaying a "rare" badge on cosmetics owned by few users, re-introduces leaderboard psychology. Trellis is local-first with no backend, but the temptation is to at least show "X% of users own this" — which requires aggregated telemetry that the local-first architecture cannot support honestly.
4. **Loot boxes / randomized rewards:** Any "mystery pack," randomized unlock, or gacha mechanic — even fully cosmetic — is deceptive pattern class A per darkpattern.games and is the behavior Epic Games was fined for. The moment a purchase's outcome is non-deterministic, the ethics of the feature cross a clear line.
5. **Pay-to-remove friction:** If unattractive default themes/pets are shown to users as the "free" option while all polished cosmetics are locked, the shop is effectively a ransom on good UX rather than a reward for learning.

**Why it happens:**
Cosmetic shops have well-established engagement design playbooks from F2P games. Developers port those playbooks without noticing which elements violate the operator's stance. The stance is documented in CLAUDE.md feedback memory but is not baked into a test that covers the shop service specifically.

**How to avoid:**
- All cosmetics must have a fixed, always-available coin price. No timers, no rotation, no expiry.
- Display the earn rate and cost transparently in the shop UI ("You earn ~1 coin per harvest. This theme costs 10 coins.").
- Purchases are deterministic: pay price → receive exact cosmetic. No randomization at any layer.
- Never display social metrics (owned-by count, rarity tiers, leaderboard rankings).
- Default cosmetics must be genuinely usable; locked cosmetics are extras, not fixes.
- Extend the existing Phase 53 privacy-guardrail test with assertions against shop-specific pushy patterns: no `countdownTimer`, no `limitedStock`, no `rarityBadge`, no `rotatingStock`, no `mysteryPack` field or code path in the shop service.

**Warning signs:**
- Shop has a `expiresAt`, `stock`, `rarity`, or `featured` field in its data model.
- Coin earn rate was reduced or cosmetic prices raised during development "to keep users engaged longer."
- Shop UI has a "Come back tomorrow" message.
- Any cosmetic purchase result is non-deterministic.

**Phase to address:** Shop Data Model definition (first shop phase). The model itself must encode the non-pushy constraints before any UI is built.

---

### Pitfall 2: Double-Spend on Coin Purchase Due to Non-Atomic localStorage Read-Modify-Write

**What goes wrong:**
The current `trellisCreditsService` reads balance, adds, and writes in a synchronous sequence (`readTotal() + count → writeTotal()`). A purchase flow that reads balance, checks `balance >= price`, deducts the price, and marks the cosmetic as owned across two separate localStorage writes is not atomic. If the device suspends, the tab is backgrounded, or any async function yields between the deduct-write and the ownership-write, the user can end up with the coins deducted but the cosmetic not granted — or, if the order is reversed, the cosmetic granted but no coins deducted.

This is not a theoretical risk: Capacitor/Android apps are suspended by the OS at any time, and on-app-reboot localStorage can be in the state of the last successful write. The Capacitor issues tracker documents cases where abrupt process death mid-write leaves localStorage inconsistent.

**Why it happens:**
Each service writes its own localStorage key independently. `trellisCreditsService` owns `trellis_fruit_credits`; a new cosmetics service would own `trellis_cosmetics_owned`. There is no cross-key transaction primitive in Web Storage.

**How to avoid:**
Write the purchase as a single atomic localStorage write to one key containing both the new balance and the updated ownership record. A single `localStorage.setItem(SHOP_STATE_KEY, JSON.stringify({ balance, owned }))` is atomic from the browser's perspective (either the full string is written or the old value remains). Never split a purchase across two `setItem` calls.

Alternatively, perform an idempotent purchase: write ownership first, then deduct — so a crash after granting but before deducting results in a "free" cosmetic (acceptable) rather than a lost coin (unacceptable). Idempotency key: `transactionId` stored alongside the purchased item prevents re-granting the same transaction if replayed on reboot.

**Warning signs:**
- `purchaseCosmetic` calls `trellisCreditsService.add(-price)` in one line and `cosmeticsService.markOwned(id)` in a separate line.
- Tests only simulate the happy path; no test suspends between the two writes.
- Balance and owned inventory are stored in different localStorage keys.

**Phase to address:** Shop Service foundation, before any purchase UI lands.

---

### Pitfall 3: Equipped Cosmetic References a Cosmetic That No Longer Exists After Clear-All-Data

**What goes wrong:**
The user equips a theme or pet, clears all data (Settings → Data → Clear All Data), then navigates to HomeScreen or PlannerScreen. The equipped cosmetic ID is stored in a `trellis_` key. After clear, all `trellis_` keys except `trellis_settings` are removed (see `SettingsDataScreen.tsx:55`). If the equipped cosmetic ID survives in `trellis_settings` (because settings are preserved through Clear-All-Data), the cosmetics service tries to resolve the cosmetic definition but finds no record and either throws or silently renders a blank.

Conversely, if the equipped cosmetic ID is stored outside `trellis_settings`, it is wiped — and then the app renders with whatever the hard-coded default is, without any notification to the user that they lost their selection.

**Why it happens:**
Clear-All-Data is implemented as a key prefix filter that preserves `trellis_settings`. New cosmetic keys added to the settings object survive, but new cosmetic keys stored separately are deleted. There is no reconciliation step that resets equipped cosmetics to defaults after a clear.

**How to avoid:**
Store the equipped cosmetic ID inside `trellis_settings` under `preferences.equippedTheme` / `preferences.equippedPet` so it is semantically a preference (survives clear). The cosmetic definitions and ownership inventory live in a separate `trellis_cosmetics` key that IS cleared.

On boot — and on every navigation to a screen that renders a cosmetic — resolve the equipped ID against the ownership store. If the equipped item is no longer owned (cleared), silently fall back to the default cosmetic and do not throw. The fallback should be a valid cosmetic, not `undefined`.

Add a test: run Clear-All-Data sequence, confirm the cosmetics service returns the default cosmetic for `resolveEquipped()`, and confirm no render error on PlannerScreen mount.

**Warning signs:**
- `resolveEquipped(id)` throws or returns `undefined` when `id` is not in the owned list.
- There is no fallback-to-default path in the cosmetic resolver.
- Clear-All-Data test does not cover the equipped-cosmetics surface.

**Phase to address:** Shop Data Model and persistence strategy, before any rendering integration.

---

### Pitfall 4: Purchased Theme Breaks the Header Positioning Invariant via `transform`/`will-change` on the Theme Root

**What goes wrong:**
Trellis's Header positioning system depends on a strict rule: no `transform`, `will-change`, `filter`, `contain`, or `perspective` on any ancestor of a `Header` component (CLAUDE.md "Header positioning — Phase 32.1 load-bearing"). A purchased theme that achieves a visual effect by adding one of these properties to a wrapper div — for example, a "Northern Lights" theme with a `filter: hue-rotate()` on the app root, or a CSS `backdrop-filter` applied to the layout container — silently re-parents the fixed-position Header's containing block. The Header will flicker or appear at the wrong position in the viewport, especially on Android Chromium WebView.

This regression already appeared five times in the commit history (`8df7980c`, `a7203a65`, `2dcef5d7`, `73d657a0`, `b4965feb`, `808c6e85`). Theme CSS is authored as a feature and the animation rule is buried in CLAUDE.md; a developer adding a "glowing" or "frosted glass" theme will not naturally know the constraint.

**Why it happens:**
CSS `filter`, `backdrop-filter`, `transform`, and `will-change: transform` all create a new containing block for `position: fixed` descendants. This is specified behavior, not a bug. It is invisible in desktop Chrome but causes visible jank or incorrect positioning in Android WebView because that engine's fixed-positioning optimization has lower tolerance for containing-block changes mid-animation.

**How to avoid:**
Define an explicit list of CSS properties that theme overrides may NOT use: `transform`, `will-change`, `filter`, `backdrop-filter`, `perspective`, `contain`. Document this in the theme authoring guide and enforce it in the theme schema validator.

Any visual effect that "needs" these properties must be implemented via a sibling element (same z-level as app content but not an ancestor of `Header`), an SVG background, or a pseudo-element below the Header z-level. The existing `sub-screen-in` keyframe comment in `index.css:486` shows this constraint already enforced for screen transition animations — theme CSS must follow the same rule.

Add a theme validation test: for every registered theme, parse its CSS variable overrides and assert none of the forbidden properties are set.

**Warning signs:**
- A theme defines a CSS class applied to `<html>` or `<body>` or the App root `<div>` that includes `filter:`, `backdrop-filter:`, `will-change:`, or `transform:`.
- Header jumps to top of viewport on Android when a particular theme is equipped.
- Theme UAT only runs in desktop browser, not on an Android device.

**Phase to address:** Theme data model and CSS authoring rules phase; also any phase that adds a new theme variant.

---

### Pitfall 5: Purchased Theme Does Not Propagate to Always-Mounted Screens Because the Theme Event Is Not Re-Read on Navigation

**What goes wrong:**
SwipeTabContainer mounts all five first-level screens (Home, Planner, Ask, Graph, Settings) once at boot. `useState(() => settingsService.getSync().preferences.equippedTheme)` initializers fire exactly once. If the user buys and equips a theme in the shop (a sub-screen), then navigates back to HomeScreen or PlannerScreen, those screens show the old theme because no re-read effect fired.

This is the canonical "always-mounted screen stale state" bug documented repeatedly in CLAUDE.md and MEMORY.md (`feedback_no_refresh_assumption.md`). It has hit review state, explored anchors, vine progress — and will hit equipped theme if the shop uses the same pattern.

**Why it happens:**
`applyTheme()` sets `document.documentElement.classList.toggle('dark', ...)` which is DOM-global and propagates immediately. But any in-React theme state (e.g., a theme name stored in component state to conditionally render cosmetic assets) will be stale. The same applies to any screen that derives its rendering from a purchased cosmetic ID stored in service state.

**How to avoid:**
Two layers of defense:

1. **DOM layer (already works for light/dark):** Keep the `applyTheme` pattern — theme classes set on `document.documentElement` propagate instantly to all CSS.
2. **React state layer (must be added):** For any React state that is derived from the equipped cosmetic (e.g., which pet SVG to render, which background asset to load), add a `[location.pathname]` resync effect on every always-mounted screen that renders cosmetics. Follow the HomeScreen canonical pattern (`useEffect(() => { syncCosmeticsFromService() }, [location.pathname])`).

Additionally, emit a `COSMETICS_CHANGED` event from the shop service after every equip/unequip action, and have cosmetic-rendering components subscribe to it — same pattern as `LOCALE_CHANGED` → re-read in `useTrellisData`.

**Warning signs:**
- Equipping a theme in the shop does not visually update PlannerScreen without navigating away and back twice.
- The equipped pet renders the old pet SVG on HomeScreen after equipping a new one in the shop.
- `useState(() => cosmeticsService.getEquipped())` in an always-mounted screen with no resync effect.

**Phase to address:** Shop integration with screens — must be validated with navigation tests, not just shop-screen tests.

---

### Pitfall 6: Continuous Pet/Companion Animation Causes Jank on the PlannerScreen Because It Shares the Trellis Canvas's Already-Saturated Animation Budget

**What goes wrong:**
TrellisCanvas already runs framer-motion animations on leaf nodes. The existing perf guard (`AMBIENT_SWAY_THRESHOLD = 20`, `TAP_ANIMATION_THRESHOLD = 30` in `trellis-perf-mask.ts`) was designed to cap animations per the known canvas leaf count. An animated pet or garden ornament added as a separate layer on the same PlannerScreen adds a continuous animation that was not accounted for in those thresholds.

On low-end Android devices, the WebView Chromium compositor has a limited number of GPU composite layers it can manage efficiently. Each `will-change: transform` or framer-motion `motion.div` creates a new composite layer. Adding a continuously-animating pet SVG on top of the trellis canvas can push the compositor over its threshold, causing the entire screen to drop frames.

**Why it happens:**
Pet animations seem isolated — "it's just one SVG." But the GPU layer budget is shared across the entire screen. The trellis canvas's leaf animations, the BottomNavigation, and the Header already consume composite layers. A pet with `animation: idle 2s ease-in-out infinite` running 60fps competes with all of them.

**How to avoid:**
- Animate pets using CSS `opacity` and `transform: translate/scale` only — these are the two properties that run on the compositor thread without triggering layout or paint.
- Never animate `width`, `height`, `top`, `left`, `border`, `color`, or `background-color` on a continuously-running pet animation.
- Gate continuous animation using the same `AMBIENT_SWAY_THRESHOLD` pattern from `trellis-perf-mask.ts`: if `leafCount > AMBIENT_SWAY_THRESHOLD`, reduce or disable pet ambient animation to preserve the leaf sway budget.
- Add a user preference to disable cosmetic animations (accessible for users with vestibular disorders and low-end devices).
- Extend the existing `trellis-perf-mask.ts` module to account for a pet/ornament animation slot, so the threshold logic is centralized.

**Warning signs:**
- Pet component uses framer-motion `motion.div` with `animate={{ y: [0, -5, 0] }}` and `transition={{ repeat: Infinity }}` with no leaf-count gate.
- PlannerScreen frame rate drops visibly on Android when both the trellis canvas and pet are animating simultaneously.
- Developer tested animation on iOS simulator (smooth at 120fps metal) but not on a mid-range Android device.

**Phase to address:** Cosmetics rendering architecture, before building the pet animation system.

---

### Pitfall 7: A Pet or Garden Ornament Container With `transform`/`will-change` Is an Ancestor of a Header — Identical to the Theme Pitfall But Harder to See

**What goes wrong:**
This is a second instance of the Header containing-block re-parenting bug (Pitfall 4), but caused by the animated cosmetic element's wrapper rather than a theme class. If a pet component uses `will-change: transform` on a wrapper `<div>` that is placed in the PlannerScreen subtree above the route `<Outlet>` — which contains the sub-screen Header — the fixed Header for that sub-screen will flicker or jump.

Even if the pet wrapper is a sibling of the Outlet, a `transform: scale(1)` initial value on the pet wrapper still creates a containing block. `transform: scale(1)` is a common "prevent animation pop" trick that becomes a Header-positioning trap in this codebase.

**Why it happens:**
PlannerScreen is a first-level swipe-tab screen with an always-mounted slot. Sub-screens (settings sub-pages, AnchorDetailScreen, PostDetailScreen) render in the `<Outlet>` overlay (zIndex 50). If any element in the PlannerScreen subtree acquires a stacking context via `transform`, it can affect sub-screen Headers that portal to `document.body` differently than ones that depend on the slot's `translateZ(0)` containing block. The exact failure mode depends on z-index stacking, but it surfaces as Header appearing at the wrong position on Android.

**How to avoid:**
Pet and ornament components must never have `transform`, `will-change`, `filter`, `perspective`, or `contain` on their outer wrapper element when placed in a first-level swipe-tab screen. Animations must be on inner elements only, and those inner elements must not be ancestors of any `Header` render site.

Add a rule to the cosmetics architecture doc: "Cosmetic wrappers in swipe-tab screens: animate inner children only. Outer wrapper: `position: relative`, `overflow: visible`, no transform, no will-change."

**Warning signs:**
- `PlannerScreen` renders a `<motion.div>` wrapping a pet component as a sibling of `<TrellisHero>`.
- AnchorDetailScreen Header appears in the middle of the screen after opening while a pet is animating.
- Pet component uses `initial={{ scale: 0 }}` on the outermost element.

**Phase to address:** Cosmetics rendering architecture, with an explicit render-tree audit before shipping any pet/ornament.

---

### Pitfall 8: Balance Desync When a Screen Reads Credits From a Stale State Initializer

**What goes wrong:**
`PlannerScreen` initializes `credits` with `useState<number>(() => trellisCreditsService.getTotal())`. This fires once at mount (app boot). The shop sub-screen deducts coins on purchase. When the user navigates back to PlannerScreen, the displayed coin balance is stale — it shows the pre-purchase total because the initializer already ran.

The same applies to HomeScreen's `creditAwardedRef` pattern: the shop's coin deduction does not emit a `HARVEST_COMPLETED` event (that event means "coins were earned"), so HomeScreen's credit display will not update.

**Why it happens:**
This is the always-mounted stale-state pattern again, but specifically on the credits counter. Unlike explored anchors, which have a dedicated resync effect, the credits counter has no event or resync path other than `HARVEST_COMPLETED`.

**How to avoid:**
Introduce a `CREDITS_CHANGED` event (or extend `HARVEST_COMPLETED` to cover deductions with a `delta` field — negative for purchases, positive for harvests). Every always-mounted screen that displays a credit balance must subscribe to this event and re-read from `trellisCreditsService.getTotal()` on receipt.

Alternatively, if the credit display is only in PlannerScreen's header counter, add a `[location.pathname]` resync effect there alongside the `CREDITS_CHANGED` event subscription.

**Warning signs:**
- PlannerScreen coin counter shows the purchase-time balance after buying a cosmetic and navigating back.
- There is no `CREDITS_CHANGED` (or equivalent) event in `AppEvent` types.
- The shop service calls `trellisCreditsService.add(-price)` without emitting any event.

**Phase to address:** Shop service foundation, alongside the atomic purchase design (Pitfall 2).

---

### Pitfall 9: New Shop Locale Keys Missing From Non-English Bundles Blocks the PR

**What goes wrong:**
The `bundle-parity.test.mjs` test asserts that `en.json`, `zh.json`, `es.json`, and `ja.json` have identical key sets. Adding shop strings to `en.json` without simultaneously adding them to all three other bundles causes the test to fail and blocks the PR. Because the shop has many strings (item names, descriptions, shop section headers, purchase confirmations, empty states), the translation gap is large and easy to overlook.

Additionally, cosmetic item names ("Autumn Garden", "Winter Frost", "Sakura Theme") may be tempting to translate literally — but per the i18n workflow, proper nouns and branded names must NOT be translated. "Trellis" itself must not appear differently in non-English bundles. Item names that are conceptually branded should follow the same rule.

**Why it happens:**
Shop development happens in English first. Translations are added as a separate step that is easy to defer. `bundle-parity.test.mjs` is unforgiving — even one missing key blocks CI.

**How to avoid:**
Follow the EN-first workflow from CLAUDE.md exactly:
1. Add all shop keys to `en.json` first.
2. Before opening a PR, run the Sonnet subagent (`app/scripts/translate-locales.md`) for `zh`, `es`, `ja`.
3. Human-review for: proper nouns not translated (Trellis, Autumn Garden if it's a product name), interpolation placeholders (`{{count}}`, `{{price}}`), Spanish length (+20%).
4. Commit all 4 bundles in the same PR.

For cosmetic item names specifically: decide at the data model level whether item names are i18n keys (localized display names) or identifier strings (non-translated). Choosing i18n keys for item names adds 4x the bundle entries. Choosing identifier strings means item names appear in English in all locales. Either is acceptable — but the decision must be explicit.

**Warning signs:**
- `bundle-parity.test.mjs` fails after adding shop strings to `en.json`.
- A cosmetic item's display name is stored as a raw string in the item definition rather than a `t()` key.
- Chinese or Japanese UI shows English cosmetic names because translations were deferred.

**Phase to address:** First shop UI phase that adds user-visible strings.

---

### Pitfall 10: Dynamic Theme Causes Flash-of-Unstyled-Content on App Boot

**What goes wrong:**
The existing `applyTheme()` runs inside a `useEffect` in `App.tsx`, which fires after the first render. For light/dark mode this is fine because the default `:root` CSS variables are the light theme, and the `.dark` class is applied synchronously before first paint via Capacitor's WebView preload. But a purchased theme that applies additional CSS variable overrides via JavaScript after mount will show a flash: the user sees the default theme for a frame, then the purchased theme. On Android WebView, which has slower first-paint characteristics than desktop, this flash is perceivable and looks like a bug.

**Why it happens:**
CSS custom property overrides applied via `element.style.setProperty` execute on the JS thread, after the browser has already composited the first frame from static CSS. Any theme initialization that runs in a `useEffect` is guaranteed to arrive one frame late.

**How to avoid:**
Apply purchased theme CSS variable overrides in the `<head>` as a `<style>` tag injected synchronously during the HTML loading phase, or as inline `style` attributes on `<html>` before React hydrates. In Capacitor, this means the `index.html` should read `localStorage.getItem('trellis_settings')` in a `<script>` tag in `<head>` (not deferred) and apply theme classes synchronously.

Alternatively, confine purchased themes to a CSS class on `<html>` (e.g., `class="theme-autumn"`) and define all theme variables inside `.theme-autumn {}` blocks in `index.css`. The class application can then be done in the same synchronous script block as the dark/light toggle, eliminating the flash.

**Warning signs:**
- A noticeable 1-2 frame flash of the default green theme before the purchased theme renders on app open.
- Theme initialization code is inside `useEffect(() => { ... }, [])` with no synchronous predecessor.
- Purchased theme CSS variables are set with `document.documentElement.style.setProperty` after mount.

**Phase to address:** Theme CSS architecture phase (ahead of any purchased theme being shippable).

---

### Pitfall 11: Cosmetic Inventory Bloats localStorage and Hits Quota

**What goes wrong:**
If cosmetic definitions (item catalog) are stored in localStorage alongside ownership records, and catalog items include image data, SVG strings, or large description blobs, the `trellis_cosmetics` key can grow large. The Web Storage spec limits localStorage to approximately 10 MiB per origin (`QuotaExceededError`). The existing `trellis-credits.service.ts` already handles quota errors silently with a `try/catch` — but silent failure on a purchase means the coin is deducted but the cosmetic data is not written.

**Why it happens:**
It is convenient to store the full cosmetic definition (including rendered SVG or base64 thumbnail) alongside the ownership record. Each new theme or pet adds another blob to localStorage.

**How to avoid:**
Store only the item catalog identifiers and ownership flags in localStorage. Keep catalog definitions (SVG markup, theme variable maps, description text) as static imports bundled with the app or in IndexedDB for larger assets. The ownership record needs only: `{ ownedIds: string[], equippedTheme: string, equippedPet: string }`. Never store image data or SVG strings in localStorage.

Measure localStorage usage in `SettingsDataScreen` cache stats after adding cosmetics — the existing `cacheStats` i18n namespace suggests this screen already shows some size metrics.

**Warning signs:**
- `trellis_cosmetics` grows by more than ~200 bytes per item.
- Cosmetic catalog definitions are fetched from the service at runtime rather than from static imports.
- Purchase sometimes silently fails on a device that has used the app heavily (large question store).

**Phase to address:** Shop Service data model, before catalog is authored.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Separate localStorage keys for balance and ownership | Simple services | Double-spend risk on purchase; see Pitfall 2 | Never for a purchase that deducts and grants atomically |
| Cosmetic item names as raw strings (not i18n keys) | Saves bundle work | English names in all locales; hard to localize later | Acceptable if item names are intentionally branded/untranslated |
| Applying purchased theme CSS vars in `useEffect` | Easy to implement | Flash-of-unstyled-content on boot; see Pitfall 10 | Never; always apply synchronously before first paint |
| Animating pets with `motion.div` at the outer wrapper level | Quick framer-motion integration | Header positioning regressions + composite layer budget exceeded; see Pitfalls 6, 7 | Never on the outer cosmetic wrapper in swipe-tab screens |
| Storing full SVG or catalog definitions in localStorage | Single source, offline-ready | localStorage quota exceeded; purchase fails silently; see Pitfall 11 | Never for large blobs |
| Re-using `HARVEST_COMPLETED` event for coin deductions | Avoids new event type | Credit counter shows wrong balance after purchase; see Pitfall 8 | Never — semantics are incompatible (earned vs. spent) |
| Grind-tuned coin earn rates to "keep users engaged" | Temporarily higher engagement | Violates operator's non-pushy stance; operator has rejected this category of mechanic multiple times | Never |
| Time-limited rotating shop items | Drives daily engagement | FOMO dark pattern; identical to Fortnite item shop mechanics the operator explicitly rejects | Never |

---

## Integration Gotchas

Common mistakes when connecting the shop to existing Trellis systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Shop purchase → credits balance | Split write across two localStorage keys | Single atomic write to one key containing both balance and ownership; or idempotent write (ownership first, deduct second) |
| Shop equip → always-mounted screens | Assume CSS propagation is sufficient for React state | Emit `COSMETICS_CHANGED` event; add `[location.pathname]` resync effects on PlannerScreen, HomeScreen |
| Purchased theme → dark mode interplay | Theme overrides only light-mode CSS vars | Each purchased theme must define both `:root.theme-X {}` and `:root.theme-X.dark {}` variable sets, or provide explicit dark-mode adjustments |
| Pet animation → trellis canvas perf guard | Pet animates independently of leaf count | Gate pet ambient animation on the same `AMBIENT_SWAY_THRESHOLD` from `trellis-perf-mask.ts`; add pet budget to the threshold calculation |
| Shop theme CSS → Header positioning | Theme applies `filter` or `will-change` to app root | Theme CSS restricted to color/font/border-radius vars only; forbidden properties list enforced at schema validation |
| Clear-All-Data → cosmetic ownership | Equipped preference survives in `trellis_settings`, owned inventory wiped in `trellis_cosmetics` | Resolver must fall back to default cosmetic gracefully when owned inventory is empty |
| Shop locale keys → bundle parity | EN keys added without running Sonnet translate subagent | Run translate workflow before PR; add all 4 bundles in one commit |
| Privacy guardrail test → shop service | New shop code not covered by Phase 53 guardrail | Extend guardrail test to assert no pushy patterns (countdownTimer, rotatingStock, lootBox) in shop service code paths |

---

## Performance Traps

Patterns that work in development but fail on real Android devices.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Continuous pet animation with no leaf-count gate | PlannerScreen drops below 30fps on mid-range Android when trellis canvas has 15+ leaves | Gate on `AMBIENT_SWAY_THRESHOLD`; animate opacity/transform only | Any device where WebView compositor is constrained (most Android mid-range) |
| `will-change: transform` on pet wrapper element | Header flicker; composite layer count exceeds GPU budget | Restrict `will-change` to inner animation targets only; outer wrapper has no transform property | Immediately on first Android test |
| Purchased theme CSS var overrides applied in `useEffect` | 1-2 frame flash of default theme on cold start | Apply theme class synchronously in `<head>` script before React mounts | Every cold start on low-end Android (slower first-paint) |
| Cosmetic SVG/image assets stored as base64 in localStorage | `QuotaExceededError` on purchase; silent data loss | Store only IDs in localStorage; bundle assets statically or use IndexedDB | After ~50 owned cosmetics, or sooner if questions store is large |
| Polling `trellisCreditsService.getTotal()` in a render function | Unnecessary localStorage reads on every render of the credits counter | Read once in state + resync on `CREDITS_CHANGED` event | High-frequency re-renders (e.g., during harvest animation) |

---

## UX Pitfalls

Common user experience mistakes for this specific feature domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Shop requires many taps to reach a cosmetic | Users don't discover or use the shop | Place shop entry point on PlannerScreen near the credits counter; cosmetics apply to visible trellis |
| Equipped cosmetic looks identical to default on small screens | Users feel purchases are worthless | Ensure each cosmetic has perceptible visual distinction at PlannerScreen's SVG canvas scale |
| No preview before purchase | User buys wrong item, feels cheated | Show a live preview of the cosmetic applied to the trellis canvas before coin deduction |
| Insufficient coin earn rate transparency | Users grind without understanding when they can afford anything | Show estimated earn rate ("~1 coin/day if you harvest regularly") alongside shop prices |
| Dark mode + purchased light theme conflicts | Theme looks broken in dark mode | Each theme must specify dark-mode-compatible variable overrides; test in both modes before shipping |
| Shop empty state when user has 0 coins | Feels like a dead end, discourages learning | Empty state should explain how coins are earned (harvest ripe anchors on Planner) and link there |

---

## "Looks Done But Isn't" Checklist

- [ ] **Atomic purchase:** Balance deduction and ownership grant happen in a single `localStorage.setItem` call (or idempotent ownership-first order). No scenario leaves coins deducted without ownership granted.
- [ ] **Clear-All-Data fallback:** After clearing data, all cosmetic-rendering screens show a valid default cosmetic with no error thrown.
- [ ] **Stale balance:** PlannerScreen coin counter updates on navigation back from shop (has `[location.pathname]` resync or `CREDITS_CHANGED` event subscription).
- [ ] **Always-mounted equip propagation:** Equipping a theme or pet in the shop is reflected on HomeScreen and PlannerScreen immediately on navigation back — tested with navigation, not just shop-screen render.
- [ ] **Header positioning intact:** Android WebView Header does not flicker after purchasing any theme or when a pet is actively animating. Verified on a real Android device, not simulator.
- [ ] **No forbidden CSS properties:** Every purchased theme's CSS variable block is free of `transform`, `will-change`, `filter`, `backdrop-filter`, `perspective`, `contain` on `html`/`body`/App-root ancestors.
- [ ] **Dark mode per-theme:** Every theme has variable definitions for both light and dark variants. Equipping a theme while dark mode is active shows correct colors.
- [ ] **Pet animation gated:** Pet ambient animation is disabled or reduced when `leafCount > AMBIENT_SWAY_THRESHOLD`. PlannerScreen with 20+ leaves and an animated pet stays above 45fps on a mid-range Android test device.
- [ ] **Bundle parity:** `bundle-parity.test.mjs` passes after all shop strings are added. All 4 locale bundles committed in the same PR.
- [ ] **Non-pushy invariants:** Extended guardrail test asserts no `countdownTimer`, `expiresAt`, `rarity`, `rotatingStock`, or `lootBox` field exists in shop service code paths.
- [ ] **No boot flash:** Cold-starting the app with a purchased theme equipped shows the purchased theme on the first frame with no flash of the default green theme.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-spend left coins deducted without cosmetic granted | LOW | Write a one-time boot migration that checks for negative balance or missing cosmetic grant; on mismatch, re-grant cosmetic (accept the "free" recovery) |
| Cosmetic ownership lost after Clear-All-Data | LOW | Expected behavior for a clear; show "Cosmetics cleared" in Clear-All-Data toast alongside existing "Data cleared" message; no recovery needed if fallback-to-default is implemented |
| Header flicker introduced by a theme's CSS | MEDIUM | Identify the forbidden property in the theme's variable block; replace with a non-creating-block alternative (SVG, pseudo-element, sibling overlay) |
| PlannerScreen jank from pet animation | LOW-MEDIUM | Add leaf-count gate to pet animation immediately; reduce animation to opacity-only as a fallback |
| Bundle parity failure blocked a PR | LOW | Run Sonnet translate subagent for missing locales; add keys; push to branch |
| Flash-of-unstyled-content on boot | MEDIUM | Move theme class application from `useEffect` to synchronous `<head>` script |
| localStorage quota exceeded on purchase | MEDIUM | Ship patch that moves cosmetic SVG/catalog definitions to static imports; migration strips stored blobs |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pushy shop mechanics (FOMO, grind, loot boxes) | Shop Data Model + Privacy Guardrail Extension | Guardrail test asserts no countdown/rotation/rarity/loot fields; coin earn rate and price balance reviewed by operator |
| Double-spend on purchase | Shop Service Foundation | Purchase test with simulated mid-write suspension; balance + ownership verified in single key |
| Cosmetic lost after Clear-All-Data | Shop Service Foundation | Test: clear all data, call `cosmeticsService.resolveEquipped()`, assert returns valid default |
| Theme breaks Header positioning | Theme CSS Architecture | Theme validation test: no forbidden properties; Android WebView Header regression test |
| Equipped theme not propagating to always-mounted screens | Shop-to-Screen Integration | Navigation test: equip in shop → navigate to PlannerScreen → assert new theme class on root |
| Pet animation jank on Android | Cosmetics Rendering Architecture | PlannerScreen perf test: 20 leaves + pet animation; gate logic coverage in `trellis-perf-mask.ts` |
| Pet wrapper is Header ancestor via `transform` | Cosmetics Rendering Architecture | Render-tree audit before shipping any pet; Header position test on Android |
| Balance desync on always-mounted screens | Shop Service + CREDITS_CHANGED event | Source-reading test: PlannerScreen subscribes to `CREDITS_CHANGED`; balance matches after purchase |
| Missing locale bundles | First Shop UI Phase | `bundle-parity.test.mjs` must pass in CI |
| Boot FOUC for purchased themes | Theme CSS Architecture | Cold-start test on Android: no frame with default theme visible before purchased theme |
| localStorage quota exceeded | Shop Data Model | Size budget test: owned cosmetics record stays under 5 KB regardless of catalog size |

---

## Sources

**Codebase sources (HIGH confidence):**
- `app/src/services/trellis-credits.service.ts` — Current non-atomic read-modify-write for credits; quote source for Pitfall 2.
- `app/src/lib/theme.ts` + `app/src/App.tsx:342-364` — `applyTheme` runs in `useEffect`; `document.documentElement.classList.toggle`; Pitfalls 5 and 10.
- `app/src/index.css:486-493` — Load-bearing comment "Opacity-only — DO NOT add transform here. The wrapper that runs this animation hosts position:fixed Header descendants"; Pitfalls 4 and 7.
- `app/src/components/trellis/TrellisCanvas.tsx` — `AMBIENT_SWAY_THRESHOLD = 20`, framer-motion leaf animations; Pitfall 6.
- `app/src/services/trellis-perf-mask.ts` — `TAP_ANIMATION_THRESHOLD = 30`, `leafAnimationMask`; Pitfall 6.
- `app/src/screens/settings/SettingsDataScreen.tsx:52-71` — Clear-All-Data removes all `trellis_` keys except `trellis_settings`; Pitfall 3.
- `app/src/screens/HomeScreen.tsx:655,670,756-759` — `creditAwardedRef`, resync effect pattern, `trellisCreditsService.add`; Pitfall 8.
- `app/src/screens/PlannerScreen.tsx:38` — `useState(() => trellisCreditsService.getTotal())` stale initializer; Pitfall 8.
- `app/src/components/trellis/TrellisStatusPanel.tsx:46-53` — `handleHarvest` non-atomic add + event emit; Pitfall 2 analogue.
- `app/src/types/index.ts:728-794` — `AppEvent` union; confirms no `CREDITS_CHANGED` or `COSMETICS_CHANGED` event exists yet; Pitfall 8.
- `CLAUDE.md` — "Header positioning Phase 32.1 load-bearing" (Pitfalls 4, 7); "Always-mounted screens must explicitly re-read service state" (Pitfalls 5, 8); "No-refresh assumption" (Pitfalls 5, 8); "i18n Workflow" (Pitfall 9); "bundle-parity.test.mjs" (Pitfall 9).
- `~/.claude/projects/-Users-Code-EchoLearn/memory/MEMORY.md` — `feedback_no_pushy_engagement_mechanics.md` (Pitfall 1); `feedback_no_refresh_assumption.md` (Pitfalls 5, 8).

**External sources (MEDIUM confidence):**
- [darkpattern.games — Artificial Scarcity](https://www.darkpattern.games/pattern/27/artificial-scarcity.html) — Documents countdown timers, fake stock, rotating shops as artificial scarcity; Pitfall 1.
- [ACM fines Epic for targeting children (Stibbe)](https://www.stibbe.com/publications-and-insights/game-over-for-dark-patterns-acm-fines-epic-for-unfairly-targeting) — Regulatory action on cosmetic shop FOMO mechanics including limited-time countdowns; Pitfall 1.
- [Ultimate Guide to Animation Performance in Capacitor Apps (Capgo)](https://capgo.app/blog/ultimate-guide-to-animation-performance-in-capacitor-apps/) — WebView overhead per frame, `will-change` overuse overhead, opacity/transform as safe GPU-accelerated properties, continuous animation battery drain; Pitfalls 6 and 7.
- [Improving CSS performance of Cordova/Capacitor apps (blog.hao.dev)](https://blog.hao.dev/improving-css-performance-of-cordova-apps-on-android-tvs/) — composite layer limits, translateZ(0) forcing composite layers, memory pressure on mobile GPU; Pitfall 7.
- [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) — localStorage is synchronous, can block JS; Pitfall 11.
- [MDN Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — ~10 MiB per origin limit, `QuotaExceededError`; Pitfall 11.
- [localStorage lost on Capacitor reboot — ionic-team/capacitor issue #636](https://github.com/ionic-team/capacitor/issues/636) — Confirms abrupt process death can leave localStorage in partial-write state; Pitfall 2.

---
*Pitfalls research for: Trellis v1.7 cosmetic rewards shop, dynamic theming, and animated companion/garden cosmetics on local-first Capacitor mobile app*
*Researched: 2026-05-20*
