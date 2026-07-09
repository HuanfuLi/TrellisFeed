# Stack Research

**Domain:** Local-first cosmetic rewards shop — coin-purchasable themes, pets/companions, and garden cosmetics on React 19 + Vite + Tailwind CSS 4 + Capacitor 8
**Researched:** 2026-05-20
**Confidence:** HIGH for all reuse-first decisions; MEDIUM for pet animation library choice (final decision depends on asset authoring workflow and designer preference)

## Scope

This research covers only what must be **added or changed** for v1.7's cosmetic rewards shop. Trellis's full existing stack (React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Capacitor 8, framer-motion 12, lucide-react, localStorage + SQLite, settingsService, eventBus) is already validated and must not be replaced or restructured.

Three shop categories to support:

1. **Themes / color skins** — dynamic CSS custom-property overrides beyond the existing two-theme (light/dark) system.
2. **Pets / companions** — collectible animated creature that lives near the Planner garden and unlocks cosmetic variants over time.
3. **Garden cosmetics** — pots, vine skins, fruit skins, backgrounds; layered SVG/CSS overlays on the existing Planner garden visual.

## Recommended Stack

### Core Technologies — All Reused, None Changed

| Technology | Version | Purpose | Why No Change Needed |
|------------|---------|---------|----------------------|
| React 19 | `^19.2.6` | UI composition | Shop screen, pet renderer, purchase flow all fit standard React component patterns. |
| TypeScript 5.9 | `~5.9.3` | Types | New service types fit existing `ServiceResult<T>` pattern; no schema-validation library needed for cosmetic purchases. |
| Vite 7 | `^7.3.1` | Build | Static asset handling (pet sprite PNGs, Rive `.riv` files if used) already supported via `import`/`URL`. |
| Capacitor 8 | `^8.3.3` | Native shell | No native plugin needed; shop data stays in localStorage. |
| Tailwind CSS 4 | `^4.3.0` | Utility | Used sparingly per project convention (most UI is inline styles + CSS vars). New theme blocks extend `index.css`, not Tailwind config. |
| framer-motion | `^12.39.0` (already installed) | Purchase animations, stagger entrance for shop grid, coin-fly particle | Already in `package.json`. Sufficient for all UI motion in the shop. No additional animation library needed for the shop UI itself. |
| lucide-react | `^0.575.0` (already installed) | Shop icons (lock, coin, checkmark, basket) | Existing icon vocabulary is adequate. |
| localStorage (via `trellisCreditsService` + `settingsService`) | — | Coin balance, owned inventory, equipped cosmetics | The coin store `trellis_fruit_credits` already exists. Ownership and equipped state go in new parallel localStorage keys (`trellis_shop_*`), following the same pattern. |
| `eventBus` (`src/lib/event-bus.ts`) | — | Broadcast `COSMETIC_PURCHASED`, `COSMETIC_EQUIPPED`, `CREDITS_CHANGED` | Existing typed pub/sub is exactly right for notifying PlannerScreen, HomeScreen, and SettingsScreen of theme/cosmetic changes without prop drilling. |

### New Supporting Libraries

Only one library addition is warranted. Everything else ships with existing tools.

| Library | Version | Purpose | Why Warranted |
|---------|---------|---------|---------------|
| `@rive-app/react-canvas` | `^4.28.5` | Animated pet/companion with interactive state machine (idle, happy, sleeping, level-up) | **Warranted only for the pet companion.** CSS spritesheet animation (`@keyframes steps()`) is sufficient for simple 2-frame idle animations but breaks down for multi-state character rigs (idle → tap → celebrate → sleep transitions). Rive's state machine covers all pet states in one `.riv` file, is designer-authored, ships a 78KB WASM runtime (lazy-loadable), and produces `.riv` files that are ~10× smaller than equivalent Lottie JSON. The `useRive` hook integrates cleanly with React. Code-split it with `React.lazy` so it does not affect app startup. |

### Development Tools — No Change

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` with esbuild tsx loader | Unit tests for shop service logic | Follow existing `tests/services/` pattern for `cosmetic-shop.service.ts`. Test purchase deduction, inventory serialization, re-equip on boot. |
| ESLint / TypeScript | Regression guard | Add source-reading negative assertion that `trellisCreditsService.add()` is never called inside shop purchase path (debits only, no credit grants at purchase). |

## Installation

```bash
# Only new production dependency
npm install @rive-app/react-canvas
```

No dev-dependency additions needed.

## Integration Points with Existing Stack

### 1. Coin Balance — Extend `trellisCreditsService`

`trellis_fruit_credits` already stores the balance. The shop needs a `spend(amount)` method:

```ts
// Extend trellisCreditsService (src/services/trellis-credits.service.ts)
spend(amount: number): ServiceResult<number> {
  const current = readTotal();
  if (current < amount) return { success: false, error: { code: 'INSUFFICIENT_CREDITS', ... } };
  const next = current - Math.max(0, Math.floor(amount));
  writeTotal(next);
  return { success: true, data: next };
}
```

Return `ServiceResult<number>` (new balance) so the UI can update the coin counter optimistically. The debit and purchase write must happen atomically in the same synchronous block — localStorage writes are synchronous so no transaction machinery is needed.

### 2. Ownership + Equipment State — New `cosmetic-shop.service.ts`

New localStorage keys, following `trellis_*` convention:

| Key | Shape | Purpose |
|-----|-------|---------|
| `trellis_shop_owned` | `string[]` (cosmetic IDs) | Purchased items; append-only |
| `trellis_shop_equipped` | `Record<SlotName, string>` | Currently active cosmetic per slot |

`SlotName = 'theme' | 'pet' | 'pot' | 'vine' | 'fruit' | 'background'`

Service methods: `getOwned()`, `getEquipped()`, `purchase(id)` (calls `trellisCreditsService.spend`, appends to owned), `equip(slot, id)` (validates ownership, writes equipped), `isOwned(id)`. All synchronous, all return `ServiceResult<T>`.

Catalog of available cosmetics lives as a **static TypeScript constant** (no API, no CMS). Each `CosmeticItem` has `{ id, name, slot, cost, unlockRequirement? }`. Static catalog means no network, no backend, and no localStorage bloat for catalog data.

### 3. Dynamic Theming Beyond Light/Dark — Pure CSS Custom Properties

The existing two-theme system uses `document.documentElement.classList.toggle('dark', ...)` in `src/lib/theme.ts`. Color themes extend this using a `data-theme` attribute on `<html>`:

```css
/* In src/index.css — add after the .dark block */
[data-theme="forest"] {
  --primary-40: #2E7D32;
  --primary-80: #81C784;
  --primary-90: #C8E6C9;
  --surface: #F1F8E9;
  --surface-variant: #DCEDC8;
  /* ...override only what changes */
}

[data-theme="ocean"] {
  --primary-40: #0277BD;
  --primary-80: #4FC3F7;
  /* ... */
}
```

`theme.ts` gets a new `applyColorTheme(themeId: string)` that does:

```ts
document.documentElement.dataset.theme = themeId === 'default' ? '' : themeId;
```

The dark-mode class and the `data-theme` attribute are **orthogonal** — a user can pick "Forest" theme and dark mode simultaneously. The `.dark` block overrides light defaults, and `[data-theme="forest"]` overrides the palette. Both apply to the same `:root` element. No Tailwind config change needed. No additional library needed.

Equipped theme is stored in `trellis_shop_equipped.theme`. `App.tsx` or a new `ThemeProvider` component reads it on mount and re-applies on `COSMETIC_EQUIPPED` events.

### 4. Pet/Companion Animation — `@rive-app/react-canvas`

The pet lives in the Planner screen near the garden visual. It is lazy-loaded:

```tsx
// src/components/PetCompanion.tsx
import { lazy, Suspense } from 'react';
const PetCanvas = lazy(() => import('./PetCanvas'));

export function PetCompanion({ petId }: { petId: string }) {
  return (
    <Suspense fallback={<div style={{ width: 80, height: 80 }} />}>
      <PetCanvas petId={petId} />
    </Suspense>
  );
}
```

```tsx
// src/components/PetCanvas.tsx
import { useRive } from '@rive-app/react-canvas';

export default function PetCanvas({ petId }: { petId: string }) {
  const { RiveComponent } = useRive({
    src: `/pets/${petId}.riv`,   // Vite static assets
    stateMachines: 'PetMachine',
    autoplay: true,
  });
  return <RiveComponent style={{ width: 80, height: 80 }} />;
}
```

WASM loads once and is cached by the Rive runtime across all `useRive` instances on the page. Preload with `<link rel="preload">` if Planner load time measurement shows visible delay.

**When CSS spritesheet suffices instead:** If the team produces only a simple 2-frame idle PNG spritesheet (no designer tooling for Rive), a 20-line CSS `@keyframes steps()` component is better — zero dependency, instant load. Use Rive when you need the state machine (idle → tap reaction → celebrate). Use CSS sprite for a purely decorative bobbing pet with no interactivity.

### 5. Garden Cosmetics (Pots, Vine Skins, Backgrounds) — CSS + SVG Layers

The existing Planner garden visual uses CSS custom properties for colors and SVG elements for vines/fruit. Garden cosmetics work as **CSS variable overrides + SVG `<use>` symbol swaps**:

- **Backgrounds / surface tints:** Override `--surface`, `--surface-variant`, or add new cosmetic-specific CSS vars (`--garden-bg`) via `document.documentElement.style.setProperty()` when a background cosmetic is equipped.
- **Vine / fruit skins:** Define named SVG `<symbol>` elements for each skin variant in a hidden `<svg>` at the app root. Equipped skin changes which `href` the garden uses in its `<use>` references. No new library.
- **Pots:** Pure SVG component variants. The shop equips a `potVariant` prop that the Planner garden component reads from `cosmeticShopService.getEquipped().pot`.

All garden cosmetic state is read once on Planner mount and refreshed on `COSMETIC_EQUIPPED` event via the `[location.pathname]` `useEffect` resync pattern (canonical pattern from `HomeScreen.tsx`).

### 6. Event Bus — New Events

Add to `AppEvent` union in `src/types/index.ts`:

```ts
| { type: 'COSMETIC_PURCHASED'; payload: { id: string; slot: SlotName } }
| { type: 'COSMETIC_EQUIPPED'; payload: { slot: SlotName; id: string } }
| { type: 'CREDITS_CHANGED'; payload: { balance: number } }
```

`CREDITS_CHANGED` allows the coin counter in the Shop screen header and the Planner screen to stay in sync without prop drilling.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| CSS `data-theme` attribute + custom properties | Dedicated theming library (next-themes, styled-components ThemeProvider) | Use a theming library only if Trellis adds server-side rendering or needs theme hydration. For a local-first Capacitor app, direct `dataset.theme` manipulation is simpler and has zero bundle cost. |
| `@rive-app/react-canvas` for pet | `react-lottie-player` (lottie-web wrapper, ~82KB gzip) | Use Lottie if the design team already works in After Effects + Bodymovin and doesn't want to learn Rive. Lottie has a larger existing asset library on LottieFiles. Tradeoff: larger runtime, no built-in state machine, animation files are larger. |
| `@rive-app/react-canvas` for pet | CSS spritesheet `@keyframes steps()` | Use CSS sprite if the pet is purely decorative (single idle loop, no tap reaction). Zero dependency, zero WASM, trivial implementation. Only inadequate if multi-state character rig is required. |
| `@rive-app/react-canvas` for pet | framer-motion keyframes on an SVG | Use framer-motion (already installed) for simple path morphs or scale/bounce. Adequate for abstract creatures; breaks down for frame-by-frame character animation. |
| Static TypeScript catalog | CMS / remote catalog API | Use a remote catalog only if cosmetics need server-side gating (e.g., seasonal events, A/B pricing). For a local-first no-backend app the static catalog is correct. |
| `trellis_shop_*` localStorage keys | Extend `trellis_settings` | Extending settings is tempting but mixes concerns. Shop state (owned inventory) is not a preference; it is append-only ledger data. Separate keys keep the `settingsService.reset()` safe (a reset should not wipe the shop inventory). |
| Separate `trellis_shop_owned` key | SQLite table | Use SQLite only if inventory grows beyond ~200 items. At shop launch, serialized ID arrays in localStorage are adequate. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any payment SDK (RevenueCat, Stripe, IAP) | Rewards are earned through learning, never purchased with real money. No payment infrastructure exists or is needed. | `trellisCreditsService.spend()` |
| Backend / API server | Local-first — user data and purchases are device-local. No sync, no cloud. | localStorage with `trellis_shop_*` keys |
| Redux / Zustand / Jotai | Existing services + eventBus already provide reactive state. Adding a global store creates parallel ownership. | `cosmeticShopService` + `eventBus` subscription + route resync `useEffect` |
| `@lottiefiles/react-lottie-player` | Deprecated; `@lottiefiles/dotlottie-react` is its replacement, but either adds ~82KB gzip runtime without the state machine advantage that justifies Rive. If Lottie-based assets exist, `react-lottie-player@2.1.0` (the mifi fork) is still maintained but adds the same runtime weight. | Rive (state machine needed) or CSS sprite (decorative only) |
| Heavy game engine (Phaser, Three.js, PixiJS) | Massive bundle for what is a cosmetic layer on a learning app. Garden visuals are simple SVG compositions, not a game scene graph. | SVG symbols + CSS custom properties |
| `@capacitor/purchases` or native IAP plugin | No real-money transactions; earned coins only. Plugin would trigger App Store billing review. | None |
| Persistent pet growth server-side state | No backend; pet growth tracks locally via time-in-app or review milestones stored in localStorage | New `trellis_pet_state` localStorage key |
| Color theme CSS-in-JS runtime | `document.documentElement.dataset.theme` + CSS blocks in `index.css` is already zero-runtime. CSS-in-JS adds bundle overhead for no benefit in a CSS-var-first project. | Extend `index.css` + `applyColorTheme()` in `theme.ts` |

## Stack Patterns for This Feature

**Adding a new color theme skin:**
1. Add a `[data-theme="name"]` block to `src/index.css` overriding only changed CSS vars.
2. Add an entry to the static cosmetic catalog with `slot: 'theme'`.
3. `applyColorTheme(id)` in `theme.ts` sets `document.documentElement.dataset.theme`.
4. No build step, no Tailwind config change, no library import.

**Adding a new pet:**
1. Author `.riv` file in Rive editor with `PetMachine` state machine (idle, happy, sleeping states).
2. Drop `.riv` in `app/public/pets/`.
3. Add catalog entry with `slot: 'pet'`, reference file name.
4. `PetCompanion` component picks up the new pet by `petId` prop automatically.

**Adding a garden cosmetic (pot, vine, fruit):**
1. Define SVG `<symbol id="pot-clay">` etc. in a shared `GardenSymbols.tsx` mounted once at app root.
2. Equipped cosmetic ID drives `href` in `<use href="#pot-clay">` within the Planner garden component.
3. No CSS var change needed unless it is also a color variant.

**Purchase flow pattern:**
1. User taps "Buy" → `cosmeticShopService.purchase(id)` → calls `trellisCreditsService.spend(cost)`.
2. On success: append to `trellis_shop_owned`, emit `COSMETIC_PURCHASED`, emit `CREDITS_CHANGED`.
3. On failure (`INSUFFICIENT_CREDITS`): show toast, no state change.
4. Auto-equip on first purchase per slot (UX: immediate gratification).

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `@rive-app/react-canvas@^4.28.5` | React 19, Vite 7, Capacitor 8 WebView | WASM loads via fetch; works in Capacitor WebView. Self-host the WASM file (`@rive-app/canvas/rive.wasm`) in `app/public/` to avoid CDN dependency. Check `capacitor.config.ts` `server.androidScheme` if WASM fetch returns opaque response on Android. |
| framer-motion `^12.39.0` (existing) | React 19 | Already validated in v1.4–v1.6. No version change needed for shop animations. |
| CSS `data-theme` on `<html>` | Tailwind CSS 4 `@custom-variant dark` | The existing `@custom-variant dark (&:is(.dark *))` declaration in `index.css` is orthogonal to `data-theme`; both can be active simultaneously. Verify that adding `[data-theme="X"]` blocks after `.dark` does not accidentally reset dark-mode vars back to light values — only override vars that differ from the base theme, not all vars. |

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Coin balance extension (`trellisCreditsService.spend`) | HIGH | Pattern is already implemented; adding `spend()` is symmetric to existing `add()`. |
| Ownership/equipment localStorage service | HIGH | Mirrors `trellisCreditsService` and `settingsService` patterns exactly; no new complexity. |
| CSS `data-theme` multi-theme system | HIGH | Verified against Tailwind CSS 4 docs and existing `index.css` structure; `data-theme` + `.dark` are orthogonal. |
| Garden cosmetic SVG layering | HIGH | SVG symbols + `<use>` is a well-established pattern; existing Planner SVG structure supports it. |
| `@rive-app/react-canvas` for pet animation | MEDIUM | Library is well-documented and React-compatible; MEDIUM because WASM fetch in Capacitor Android WebView has one known edge case (opaque response if server scheme not set). Validate on Android device before ship. |
| Pet animation CSS-sprite fallback | HIGH | Zero-dependency CSS `@keyframes steps()` is fully understood; confirmed adequate for single-state idle pet. |
| framer-motion sufficiency for shop UI | HIGH | Already running at v12.39.0; variants, spring, and stagger cover purchase confirmations and shop grid. |

## Sources

- Local repo inspection 2026-05-20: `app/src/services/trellis-credits.service.ts`, `app/src/services/settings.service.ts`, `app/src/lib/theme.ts`, `app/src/lib/event-bus.ts`, `app/src/index.css`, `app/src/types/index.ts`, `app/package.json`.
- Context7 `/mifi/react-lottie-player` — lazy load pattern, LottiePlayerLight CSP-safe build, npm install; verified 2026-05-20.
- Context7 `/grx7/framer-motion` — variants, spring animation, staggered children; confirmed existing install at `^12.39.0` is current.
- Rive official docs: https://rive.app/docs/runtimes/react/react — `useRive` hook, state machines, `@rive-app/react-canvas` React integration.
- Pixel Point blog on Rive optimizations: https://pixelpoint.io/blog/rive-react-optimizations/ — WASM is 78KB, lazy-load + self-host pattern.
- DEV Community: https://dev.to/uianimation/rive-vs-lottie-which-animation-tool-should-you-use-in-2025-p4m — Rive state machine advantage vs Lottie for character animation, 2025.
- Medium (Ramin Yavari): https://medium.com/@sir.raminyavari/theming-in-tailwind-css-v4-support-multiple-color-schemes-and-dark-mode-ba97aead5c14 — `data-theme` attribute pattern in Tailwind CSS v4; confirmed CSS-only, no library.
- Tailwind CSS v4 official docs: https://tailwindcss.com/docs/theme — `@custom-variant` and CSS variable theming.
- npm registry 2026-05-20: `@rive-app/react-canvas@4.28.5`, `react-lottie-player@2.1.0`, `@lottiefiles/dotlottie-react@0.19.3`, `framer-motion@12.39.0`.

---
*Stack research for: Trellis v1.7 cosmetic rewards shop*
*Researched: 2026-05-20*
