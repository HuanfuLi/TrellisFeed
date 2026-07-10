# Feature Research

**Domain:** Cosmetic rewards shop with earned single-currency economy — v1.7 Trellis
**Researched:** 2026-05-20
**Confidence:** HIGH for table-stakes shop UX and anti-feature identification; MEDIUM for economy balance specifics (earn-rate ratios are empirical, not universal); MEDIUM for differentiators tied to the trellis/garden metaphor (no direct comparator exists)

---

## Context Snapshot

Trellis already has:
- Fruit credits (`trellis_fruit_credits`) as an earned, single soft-currency — no real-money purchases exist or are planned
- Harvest flow: fully-reviewed concepts yield credits with fly-to-counter + confetti animation
- CSS-variable theming (`--primary-40`, `--surface`, etc.) already supports swapping color sets at the root
- Non-pushy engagement guardrail (LEARN-04/PRIVACY-01, v1.6): no streaks, no leaderboards, no stop cues tied to punishment, no public likes
- Trellis/garden visual metaphor across all surfaces

The shop gives fruit credits a purpose. It does not introduce new earning mechanics — credits exist already. The shop is purely a **destination for optional cosmetic expression**.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a user expects the moment a "shop" tab or icon appears. Missing any of these makes the shop feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Coin balance display in shop header** | User must know how much they can spend before browsing. Hidden balance creates anxiety. | LOW | Read from `trellis_fruit_credits` via `trellisCreditsService.getTotal()`. Display as "🍎 N credits" or equivalent icon+number. Update reactively when credits change (subscribe to `HARVEST_COMPLETED` event or use poll-on-focus). |
| **Browse all items in a grid/list** | Users need to see the catalog to feel the shop has content. A sparse or hidden catalog is a dead end. | LOW-MEDIUM | Grid layout grouped by category (Themes, Companions, Garden cosmetics). Each tile shows item name, preview thumbnail, and price or "Owned" badge. |
| **Preview before buying** | Users will not spend credits on something they cannot see. Preview-first is a universal shop norm. | MEDIUM | Tap item → full preview: larger visual, description, price. For themes: show a live preview of UI color swap. For pets/companions: show animation or static illustration. For garden cosmetics: show how the trellis/vine changes. |
| **Purchase confirmation dialog** | Accidental taps on mobile are common. An irreversible spend without confirmation erodes trust immediately. | LOW | Two-tap purchase: "Buy for N credits" button → confirmation sheet with item name, cost, and current balance. Single "Confirm" CTA + "Cancel". Do not use swipe-to-confirm (too complex per Baymard research). |
| **Owned vs. locked display state** | User must know at a glance what they already own vs. what still costs credits. Confusion here causes repeat-purchase attempts. | LOW | Owned items: replace price with "Owned" chip/badge + "Equip" button (if not currently active). Locked items: show price with coin icon. Insufficient funds: gray out price or show "Need N more credits". |
| **Equip / unequip owned item** | Owning something means nothing if there is no way to activate or deactivate it. | LOW-MEDIUM | Each owned item has an "Equip" state toggle. Only one item per category can be active at a time (one active theme, one active companion, one active garden skin). Currently-equipped item shows "Equipped" badge. |
| **Persist ownership and equipped state** | Closing and reopening the app must preserve what the user owns and what is active. | LOW | Store in localStorage under `trellis_shop_owned` (array of item IDs) and `trellis_shop_equipped` (map of category → item ID). Read on app boot; apply equipped theme on startup. |
| **Insufficient funds feedback** | User attempts to buy item they can't afford. App must explain clearly, not silently fail. | LOW | If credits < price: show "You need N more credits" inline. Optionally show path to earning (link to harvest). Do not disable the item tile entirely — show it, explain the deficit. |

### Differentiators (Competitive Advantage)

Features that make the Trellis shop feel coherent with its identity rather than bolted-on. These reinforce the learning metaphor and the non-pushy stance.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Theme skins that use existing CSS variables** | Because Trellis already uses CSS custom properties, a theme is just a root-level variable swap — zero extra render cost, zero layout changes. No other learning app competitor (Duolingo, Anki) offers truly seamless UI color theming via a shop. | MEDIUM | Define theme objects as CSS variable overrides: `{ '--primary-40': '#...', '--surface': '#...', ... }`. Apply to `:root` via `document.documentElement.style.setProperty`. At least 3–5 themes: Default, Dark (if not already present), Sage/Forest, Slate/Night, Warm/Amber. |
| **Companions tied to the garden metaphor** | A "pet" that lives in the existing trellis/vine canvas grounds the feature. The companion doesn't punish absence — it simply grows or shifts pose as the learner's vine grows. Reinforces the core metaphor without manipulation. | HIGH | Companion is displayed on HomeScreen or GraphScreen canvas. Uses leaf state (bud → green → fruit → harvest) to shift its appearance passively. Purchase unlocks the companion design; growth reflects real learning, not companion neglect mechanics. |
| **Garden cosmetics scoped to the trellis vine** | Trellis has an established vine/leaf/fruit visual vocabulary. Purchasable vine styles (e.g., different leaf shapes, fruit icons, branch styles) extend what the user already cares about. Directly tied to the existing graph metaphor. | HIGH | Replace default leaf/node icon assets with category-skinned equivalents. Requires a skin layer on GraphScreen's node rendering. Ship 2–3 vine skins at launch (default + 2 alternates). |
| **"Earned, not given" framing** | All items are earnable through learning. No random chance, no pay-to-win, no expiring freebies. The shop should be titled something like "Harvest Shop" or "Garden Market" — language that connects spending credits to earning them. | LOW | Copy/naming only. High leverage for coherence. "Fruit credits" earned → spent in "Garden Shop". The shop tab icon can use a harvest/coin motif consistent with existing harvest animation. |
| **Shop discovery through the harvest celebration** | The moment a user earns credits (fly-to-counter after harvest) is the highest-motivation moment to introduce the shop. A subtle "Visit shop" nudge at harvest reinforces the earn→spend loop without forcing navigation. | LOW | After successful harvest animation, show a one-line nudge: "You earned N credits — visit the Garden Shop." Tap dismisses. Does not interrupt the celebration, appears below the counter. |
| **No lock-out for slow earners** | All items remain permanently available. No item is ever removed from the catalog. Slow earners can save up without FOMO. | LOW | Purely an inventory/catalog design decision, but must be explicit and enforced. |

### Anti-Features (Commonly Requested, Often Problematic)

Every item in this list is something that could be requested during implementation, appears to add value, but violates either the non-pushy constraint, the local-first design, or sound economy design. Each must be explicitly rejected.

| Feature | Why Requested | Why It Violates the Non-Pushy Stance | Alternative |
|---------|---------------|--------------------------------------|-------------|
| **Artificial scarcity timers ("Only 24 hours left!")** | Creates urgency, drives impulse spending. Common in Fortnite, Overwatch, seasonal shop rotations. | Directly manufactures anxiety. The operator has explicitly prohibited FOMO and stop-cue pressure. Scarcity timers are the canonical FOMO dark pattern. | Permanent catalog. No expiry on any item. Optional seasonal additions may exist but never disappear — they join the permanent catalog after any "seasonal" window. |
| **Loot boxes / randomized rewards** | Adds excitement and gambling-style dopamine. Monetarily effective in F2P games (FTC cited Epic/Fortnite). | Randomized outcomes for a fixed credit cost is functionally gambling-adjacent. It's manipulative and regulatorily risky. Completely antithetical to a learning app's trust premise. | Fixed-price catalog. User knows exactly what they're buying before spending. |
| **Exclusive limited-drops that disappear forever** | Creates collector urgency and social comparison ("they have it, I don't"). | FOMO is a negative emotion. This design class has been explicitly criticized across gaming communities (Darktide, Ashes of Creation forums) and is the most common cosmetic shop complaint. | Rotating featured items are fine for discoverability — but "featured" means "highlighted in the catalog this week," not "gone forever after this week." |
| **Social comparison / ownership display ("N users own this")** | Social proof. Feels like community. | Breaks local-first privacy. Requires a server. Creates status anxiety ("everyone has X, I don't"). Contradicts the explicit no-leaderboards/no-public-likes ruling from LEARN-04. | Ownership is fully private. No public display of what others own. |
| **Earn-rate inflation to sell credits for real money** | Revenue. If credits are scarce, users may pay. | Trellis is not monetized this way. Introducing real-money credit packs corrupts the "earned through learning" premise. Fruit credits should never be purchasable. | Credits earned only through genuine harvesting. Economy balance tuned to feel rewarding without paying. If monetary sustainability is needed, it's a separate future milestone with explicit design. |
| **Daily login bonus credits** | Rewards return visits, common in mobile games. | Login bonuses reward presence, not learning. This is the definition of a pushy engagement mechanic — credits for showing up, not for knowing. It decouples the currency from its meaning. | Credits earned only through harvest (completing spaced-repetition cycles for a concept). The earn mechanism IS the learning mechanism. |
| **Credit-multiplier power-ups ("earn 2x credits for 1 hour")** | Feels like a reward, motivates play sessions. | This is a stop-cue by another name — it creates time pressure ("I should keep harvesting while the multiplier is active"). Violates non-pushy stance. | Fixed earn rate. Harvesting a concept always yields the same credits. Predictability over pressure. |
| **Functional advantages bundled into cosmetic purchases ("premium theme unlocks extra graph filter")** | Increases perceived value of cosmetics. | Pay-to-progress is explicitly excluded from scope. Bundling functional advantages into cosmetic purchases blurs this line and creates "soft P2W." | Themes, companions, and garden cosmetics are purely visual. Zero functional difference in graph, review, feed, or podcast behavior. |
| **Streak-linked cosmetics ("7-day streak unlocks X")** | Ties cosmetics to engagement pattern. | Streaks are explicitly prohibited. Streak-tied cosmetics would reintroduce streak pressure through the back door. | Cosmetics unlockable only through credit purchases. Credits earned only through harvest. Harvest earned through genuine spaced repetition completion. |
| **Upsell prompts in unrelated screens ("Unlock more themes in the Shop!")** | Drives shop awareness, increases conversion. | Unsolicited upsells in the feed, review, or ask screens would be manipulative and feel like ads inside a learning tool. The operator has rejected pushy engagement repeatedly. | The one harvest-moment nudge (see Differentiators) is the only in-app shop reference outside the shop tab itself. No banners, no modal upsells in other screens. |
| **"New" badge that never clears** | Keeps shop tab feeling active. | If the badge never clears after visiting, it becomes notification spam. Manipulative attention mechanic. | "New" badge on the shop tab clears as soon as the user opens the shop. It appears only for genuinely new items added since the user last visited, not on a timer. |

---

## Feature Dependencies

```
[Ownership persistence]
    └──required by──> [Equip / unequip]
    └──required by──> [Owned vs locked display]
    └──required by──> [Browse catalog]

[Browse catalog]
    └──requires──> [Ownership persistence]
    └──requires──> [Item data (ID, name, price, category, preview asset)]
    └──unblocks──> [Preview before buy]
    └──unblocks──> [Purchase confirm]

[Preview before buy]
    └──requires──> [Browse catalog]
    └──requires──> [CSS variable theme switching] (for theme previews)
    └──unblocks──> [Purchase confirm]

[Purchase confirm]
    └──requires──> [Coin balance display]
    └──requires──> [Ownership persistence]
    └──requires──> [Preview before buy]
    └──unblocks──> [Equip / unequip]

[Equip / unequip]
    └──requires──> [Ownership persistence]
    └──requires──> [CSS variable theme switching] (themes)
    └──requires──> [Companion render slot] (companions)
    └──requires──> [Node skin layer on GraphScreen] (garden cosmetics)

[Coin balance display]
    └──requires──> [trellisCreditsService.getTotal()] — already exists

[CSS variable theme switching]
    └──requires──> [Theme definition objects]
    └──no new infrastructure needed — CSS vars already in place

[Companions]
    └──requires──> [Companion render slot on HomeScreen or GraphScreen]
    └──requires──> [Leaf state reading from trellis-state.service.ts]
    └──complex, should be Phase 2 of shop build]

[Garden vine skins]
    └──requires──> [Node skin layer on GraphScreen node rendering]
    └──requires──> [Asset variants per skin]
    └──complex, should be Phase 2 or Phase 3 of shop build]

[Harvest-moment shop nudge]
    └──requires──> [Shop route exists and is navigable]
    └──enhances──> [Browse catalog]
```

### Dependency Notes

- **Themes are the lowest-friction Phase 1 item.** CSS variable infrastructure already exists. No new render slots needed. Preview is a simple variable swap. Start here.
- **Companions and vine skins require new render infrastructure** (a slot in HomeScreen/GraphScreen, a skinning layer on graph nodes). These belong in Phase 2 after the core shop loop (browse → preview → buy → equip) is proven.
- **Ownership persistence is the load-bearing primitive.** Everything else reads from it. Build and test this first.
- **Purchase confirm depends on coin balance display** — the dialog must show current balance and post-purchase balance.
- **Equip requires separate logic per category.** Themes apply CSS vars to `:root`. Companions need a render slot. Garden skins need a skin map in the graph renderer. Do not unify these into one "equip" function — let each category have its own apply mechanism.

---

## MVP Definition

### Launch With (v1.7 Phase 1 — Core Shop Loop)

The minimum that makes the shop feel real and non-broken. Validates the earn→spend loop end to end.

- [ ] **Item catalog data structure** — Define item schema: `{ id, category, name, description, price, previewAsset, cssVars? }`. Hardcode initial items (3–5 themes, no companions yet).
- [ ] **Ownership persistence service** — `shopService` with `getOwned()`, `purchase(itemId)`, `getEquipped(category)`, `equip(itemId)`. localStorage-backed (`trellis_shop_owned`, `trellis_shop_equipped`).
- [ ] **Coin balance display in shop** — Header area showing current credit balance, reactive to `HARVEST_COMPLETED`.
- [ ] **Browse catalog screen** — Grid by category. Owned items show "Equipped"/"Equip" badge. Locked items show price or "Need N more credits".
- [ ] **Item detail / preview screen** — Full preview with live CSS-var theme preview, description, cost, and buy CTA.
- [ ] **Purchase confirmation** — Two-step: "Buy for N credits" → confirm sheet → ownership granted, credits deducted.
- [ ] **Equip/unequip for themes** — Apply CSS variable overrides to `:root`. Persist equipped theme. Reapply on app boot (before first render to avoid flash-of-wrong-theme).
- [ ] **Harvest-moment shop nudge** — After harvest animation, show "You earned N credits" with optional "Visit Garden Shop" link. Dismiss on tap.
- [ ] **"New items" badge clears on shop open** — Badge appears if items were added since last visit; clears immediately on shop entry.

### Add After Validation (v1.7 Phase 2)

After the core loop is proven and users are earning/spending:

- [ ] **Companions** — Add companion render slot (HomeScreen sidebar or GraphScreen overlay). 2–3 companion designs. Companion pose shifts with vine leaf state (bud/green/fruit). Purchase and equip via shop.
- [ ] **Garden vine skins** — Add skin layer to GraphScreen node rendering. 2–3 vine skin variants. Purchase and equip via shop.
- [ ] **More theme variants** — Expand from 3 to 6–8 themes based on user feedback and design capacity.
- [ ] **Insufficient funds deep-link** — From shop item, tappable hint that explains "harvest a concept to earn credits" with link to planner/graph view.

### Future Consideration (v2+)

- [ ] **Seasonal featured items** — A "featured this season" section in the catalog. Items are highlighted for a season but added permanently to the catalog (never removed). No FOMO.
- [ ] **Animated themes** — Subtle background particle effects or vine growth animations as premium theme variants. Requires performance validation on low-end Android WebView.
- [ ] **Sound packs** — Different harvest celebration sounds or ambient garden sounds. Requires TTS/audio system audit.
- [ ] **Cross-device shop sync** — Ownership synced across devices. Requires auth + backend milestone, out of scope for local-first v1.7.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Ownership persistence service | HIGH (foundational) | LOW | P1 |
| Coin balance display in shop | HIGH | LOW | P1 |
| Browse catalog screen | HIGH | LOW-MEDIUM | P1 |
| Item detail / preview | HIGH | MEDIUM | P1 |
| Purchase confirmation | HIGH | LOW | P1 |
| Equip/unequip themes via CSS vars | HIGH | LOW-MEDIUM | P1 |
| Themes (3–5 initial) | HIGH | MEDIUM (design) | P1 |
| Harvest-moment shop nudge | MEDIUM | LOW | P1 |
| New-items badge (clears on open) | MEDIUM | LOW | P1 |
| Companions | HIGH | HIGH | P2 |
| Garden vine skins | MEDIUM-HIGH | HIGH | P2 |
| Additional theme variants | MEDIUM | LOW-MEDIUM | P2 |
| Insufficient-funds earn hint | MEDIUM | LOW | P2 |
| Seasonal featured section | LOW-MEDIUM | LOW | P3 |
| Animated themes | LOW | HIGH | P3 |
| Sound packs | LOW | MEDIUM | P3 |
| Cross-device shop sync | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.7 shop launch — establishes the earn→spend loop
- P2: Add once core loop is trusted — expands categories to companions and garden skins
- P3: Defer — either high cost, low immediate value, or requires infrastructure outside v1.7 scope

---

## Economy Balance Guidance

This section is MEDIUM confidence — no universal earn-to-cost ratio exists. The following is a synthesized framework from game economy design research (Machinations.io, Iron Source LevelUp) adapted for Trellis's single-currency, learn-only earn mechanic.

### The non-pushy constraint changes the calculus

Standard F2P economy design uses "pinch points" to keep users motivated to play more. Trellis must NOT do this — credits earned through learning should feel rewarding, not strategically rationed to drive more app opens. The goal is:

- **Fast enough**: A new user should be able to afford at least one item within their first 2–3 harvests
- **Meaningful enough**: The full catalog should not be trivially exhausted in a week
- **Never grindy**: No item should feel like it requires obsessive harvesting to afford

### Anchor: what is a harvest worth?

A harvest occurs when a concept reaches "fruit" leaf state (7+ days in blossom, all children reviewed, avg ease > 2.5). This is genuine multi-day learning work. A harvest event is therefore high-value signal — rarer and more earned than, say, completing a lesson. It should award more credits than a Duolingo daily-goal gem chest (which awards 5–15 gems).

**Recommended harvest award: 25–50 credits per concept harvested.**

Rationale: A learner who actively uses Trellis might harvest 1–3 concepts per week. At 25–50 credits each, they accumulate 25–150 credits per week.

### Anchor: what should items cost?

With a 25–50 credit weekly earn rate, a tiered pricing structure that feels fair:

| Tier | Price | Earn time (weekly active learner) | Examples |
|------|-------|-----------------------------------|---------|
| Starter | 50–75 credits | 1–3 weeks | Simple color theme, basic companion |
| Standard | 100–150 credits | 2–6 weeks | Richer theme, expressive companion design |
| Premium | 200–250 credits | 4–10 weeks | Complex garden vine skin, premium companion |

**Key principle: the cheapest item in each category should be reachable within 1–2 weeks for a moderately active learner.** If the cheapest theme costs 500 credits and a learner earns 50/week, that is 10 weeks for a single theme — frustrating. If it costs 50, that is one good week of learning — rewarding.

### Avoid overflow / devaluation

If a user has harvested 50 concepts (a very engaged learner), they may hold 1,250–2,500 credits. The catalog must have enough items to spend into, or credits feel meaningless (the "millionaire on a desert island" Duolingo critique). Plan for at least 15–20 purchasable items across all categories at launch of Phase 2 (once companions and vine skins are live). Phase 1 can start with 5–8 themes.

### Do not add a credit sink that isn't a cosmetic

The only valid credit sink is cosmetic shop purchases. Do not add "spend credits to unlock a bonus review session" or "spend credits to skip a review" — these are functional advantages. Do not add "spend credits for a streak freeze" — Trellis has no streaks. The earn→spend loop must remain: **learning → harvest → credits → cosmetics**.

---

## Competitor / Ecosystem Analysis

| Feature | Ecosystem Pattern | Trellis Approach |
|---------|-------------------|------------------|
| Currency earn mechanism | Duolingo: daily goal XP → gem chest (5–15 gems). Forest/Flora: focus timer → tree grows. | Trellis: spaced repetition completion → harvest → credits. Earn rate tied directly to learning depth, not app-open frequency. |
| Shop catalog | Duolingo: Duo costumes (3), app themes (none), streak freezes (functional). Widely criticized as under-populated. | Trellis: start with 3–5 themes, expand to companions + vine skins. Avoid Duolingo's mistake of too few cosmetics and too many functional items. |
| Preview before buy | Most mobile game shops: tap item → detail view with "Buy" CTA. Fortnite: live outfit preview on character model. | Trellis themes: live CSS-var preview on shop item detail screen. Companions/skins: static illustration with description. |
| Owned vs locked | Standard mobile game: locked = padlock icon + price; owned = "Equip" button + owned badge. | Same pattern, using Trellis CSS-var styling. "Owned" chip replaces price; "Equip"/"Equipped" button per category. |
| Anti-FOMO design | Rocket League cosmetic shop: rotating items create FOMO (widely criticized). Stardew Valley: no shop FOMO, buy at any time, timeless availability. Fortnite Item Shop: timed exclusives, high FOMO. | Trellis: Stardew Valley model. All items permanently available. No timers. No limited drops. |
| Pet/companion design | Tamagotchi: punishment for neglect. Duolingo Owl: mild streak guilt. Flora: tree grows with focus. Otto: pet health tied to self-care tasks. | Trellis: companion pose reflects vine growth (earned learning milestone), not neglect. Never punishes absence. |

---

## Sources

- [Duolingo Shop critique — duoplanet.com](https://duoplanet.com/we-need-to-talk-about-the-duolingo-shop/) — MEDIUM confidence — user/community analysis, not official Duolingo design rationale
- [Game economy design essentials, Iron Source LevelUp — Medium](https://medium.com/ironsource-levelup/game-economy-design-essentials-part-2-best-practices-81a51d7e7ee9) — MEDIUM confidence — industry practitioner, not peer-reviewed
- [How to price items in free-to-play games — JBDev, Unity LevelUp](https://medium.com/ironsource-levelup/how-to-price-items-in-free-to-play-games-c200648ab8b9) — MEDIUM confidence — F2P practitioner guidance
- [Game economy design in Free-to-Play games — Machinations.io](https://machinations.io/articles/game-economy-design-free-to-play-games) — MEDIUM confidence — taps/sinks model widely cited
- [Pet Companion Design: The Duolingo Owl Effect — Yu-kai Chou](https://yukaichou.com/advanced-gamification/the-pet-companion-design-in-gamification/) — MEDIUM confidence — gamification theory practitioner
- [Dark patterns in social media, gaming, e-commerce — Fair Patterns](https://www.fairpatterns.ai/post/dark-patterns-social-media-gaming-and-e-commerce) — HIGH confidence — regulatory-aligned, FTC-cited cases
- [Please stop the FOMO cosmetic shop — Ashes of Creation forums](https://forums.ashesofcreation.com/discussion/52147/please-stop-the-fomo-cosmetic-shop) — LOW confidence (community opinion) — illustrates player sentiment against limited-drop cosmetics
- [Remove the FOMO in the paid Cosmetic Shop — Warhammer 40K Darktide](https://steamcommunity.com/app/1361210/discussions/0/597388342426883764/) — LOW confidence (community opinion) — same pattern
- [Loyalty UX checklist — Voucherify](https://www.voucherify.io/blog/loyalty-programs-ux-and-ui-best-practices) — MEDIUM confidence — UX practitioner, loyalty program design
- [Confirmation dialogs — UX Planet](https://uxplanet.org/confirmation-dialogs-how-to-design-dialogues-without-irritation-7b4cf2599956) — HIGH confidence — established UX pattern literature
- [In-App Purchasing UX guidelines — Amazon Developer](https://developer.amazon.com/docs/in-app-purchasing/iap-ux-design-guidelines.html) — HIGH confidence — official platform documentation
- Trellis codebase: `app/src/services/trellis-state.service.ts` (leaf state), `app/src/services/trellis-credits.service.ts` (credit persistence), `CLAUDE.md` harvest flow, CSS variable list

---
*Feature research for: Trellis v1.7 cosmetic rewards shop*
*Researched: 2026-05-20*
