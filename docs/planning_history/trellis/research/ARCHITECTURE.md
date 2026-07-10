# Architecture Research

**Domain:** Local-first cosmetic rewards shop integration — Trellis v1.7
**Researched:** 2026-05-20
**Confidence:** HIGH (all integration points verified against live source files)

---

## Standard Architecture

### System Overview

```
+--------------------------------------------------------------------------+
| UI Layer (React 19)                                                       |
|                                                                           |
|  ShopScreen          PlannerScreen         SettingsScreen                 |
|  (new sub-route)     (garden render)       (theme picker row — unchanged) |
|        |                   |                        |                     |
|  +-----+-------------------+------------------------+------------------+  |
|  |         useCosmetics hook (new) + useLocation re-read pattern      |  |
|  +---------------------------------------------------------------------+  |
+-------------------------+-------------------------------------------------+
                          | calls
+-------------------------+-------------------------------------------------+
| Service Layer                                                             |
|                                                                           |
|  cosmeticsService  (new)                                                  |
|  getOwned() · getEquipped() · purchase() · equip() · unequip()           |
|  localStorage key: trellis_cosmetics                                      |
|         |                                                                 |
|         | calls                                                           |
|         v                                                                 |
|  trellisCreditsService  (existing — add subtract())                       |
|  getTotal() · add(n) · subtract(n)                                        |
|  localStorage key: trellis_fruit_credits                                  |
+-------------------------+-------------------------------------------------+
                          | emits
+--------------------------------------------------------------------------+
| Event Bus (existing eventBus)                                             |
|                                                                           |
|  COSMETICS_CHANGED  { kind: 'purchase' | 'equip' | 'unequip', ... }      |
|                                                                           |
|  Subscribers:                                                             |
|  - App.tsx: applyCosmetic('theme', ...) on kind=equip, category=theme     |
|  - PlannerScreen: setEquippedBg / setEquippedPet re-read                  |
|  - ShopScreen: balance badge re-read                                      |
+--------------------------------------------------------------------------+
                          | reads/writes
+--------------------------------------------------------------------------+
| Persistence (localStorage)                                                |
|                                                                           |
|  trellis_cosmetics         (new)  owned[] + equipped{theme,bg,pet}       |
|  trellis_fruit_credits  (existing, unchanged schema)                      |
+--------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `cosmeticsService` | Ownership and equip state, purchase transaction | New service; localStorage-backed; `ServiceResult<T>` return shape |
| `trellisCreditsService` | Coin balance | Existing; add `subtract(n)` method |
| `ShopScreen` | Browse/buy/equip UI | New sub-screen at `/settings/shop` |
| `TrellisBackground` | Background cosmetic dispatch | New component wrapping existing `TrellisBackgroundA` variant |
| `TrellisPet` | Pet overlay in garden hero | New component rendered inside `TrellisHero` |
| `lib/theme.ts: applyCosmetic` | Apply cosmetic theme class to `<html>` | New export alongside existing `applyTheme` |
| `App.tsx` COSMETICS_CHANGED subscriber | Theme equip propagation at root | New `useEffect` alongside existing OS dark-mode listener |

---

## Recommended Project Structure

New files only — existing files minimally modified:

```
app/src/
├── services/
│   ├── cosmetics.service.ts             NEW — owned/equipped state, purchase(), equip()
│   └── trellis-credits.service.ts       MODIFIED — add subtract(n)
├── components/trellis/
│   ├── TrellisBackground.tsx            NEW — dispatches to variant by equipped.background
│   ├── TrellisPet.tsx                   NEW — renders pet sprite by petId
│   └── variants/
│       ├── TrellisBackgroundA.tsx       existing (default)
│       ├── TrellisBackgroundSakura.tsx  NEW (example variant)
│       └── TrellisBackgroundNight.tsx   NEW (example variant)
├── screens/
│   └── ShopScreen.tsx                   NEW — /settings/shop route
├── lib/
│   └── theme.ts                         MODIFIED — add applyCosmetic()
└── types/index.ts                       MODIFIED — add COSMETICS_CHANGED to AppEvent union
```

Existing files with minimal changes:

| File | Change |
|------|--------|
| `app/src/types/index.ts` | Add `COSMETICS_CHANGED` to `AppEvent` union |
| `app/src/lib/theme.ts` | Add `applyCosmetic()` export |
| `app/src/main.tsx` | Boot-time `applyCosmetic` call (1 line) |
| `app/src/App.tsx` | Add `COSMETICS_CHANGED` subscriber for theme equip (1 `useEffect`) |
| `app/src/screens/SettingsScreen.tsx` | Add `MenuRow` entry for `/settings/shop` |
| `app/src/screens/PlannerScreen.tsx` | Add `equippedBg`/`equippedPet` state + re-read effects |
| `app/src/components/trellis/TrellisHero.tsx` | Replace `<TrellisBackgroundA />` with `<TrellisBackground />`; add `<TrellisPet />` |
| `app/src/index.css` | Add cosmetic theme CSS var override blocks |
| `app/src/App.tsx` (router) | Register `settings/shop` route |

---

## Architectural Patterns

### Pattern 1: Separate-Key Separate-Service for Earned Goods

**What:** Cosmetics ownership state lives in its own `localStorage` key (`trellis_cosmetics`) and its own service, not merged into `AppSettings`. `AppSettings` (key `trellis_settings`) is reset by "Reset All Settings". Owned items must survive that reset.

**When to use:** Any state representing earned or purchased virtual goods.

**Trade-offs:** One more service file. No migration complexity — `AppSettings.deepMerge` is never involved. `clearAllData` in `SettingsDataScreen` must explicitly clear the new key alongside other trellis_ keys.

### Pattern 2: Deduct-Then-Grant Purchase Atomicity

**What:** In `purchase()`, call `trellisCreditsService.subtract(cost)` first, then write ownership. If the ownership write fails (localStorage quota), the user loses coins without the item. The reverse failure (item granted, subtract fails) is worse for trust.

**When to use:** Any local-first coin spend without server-side rollback.

**Trade-offs:** On rare localStorage quota exhaustion between the two writes, coins are lost. Mitigate in Phase 2 by storing a `pendingRefund` field inside `trellis_cosmetics` that `cosmeticsService.load()` checks and re-credits on boot.

**Example:**

```typescript
purchase(id: string, cost: number): ServiceResult<{ newBalance: number }> {
  if (this.isOwned(id))
    return { success: false, error: { code: 'ALREADY_OWNED', message: '...', retryable: false } };
  const balance = trellisCreditsService.getTotal();
  if (balance < cost)
    return { success: false, error: { code: 'INSUFFICIENT_FUNDS', message: '...', retryable: false } };
  const newBalance = trellisCreditsService.subtract(cost);   // deduct FIRST
  const state = loadState();
  state.owned.push(id);
  writeState(state);                                          // grant SECOND
  eventBus.emit({ type: 'COSMETICS_CHANGED', payload: { kind: 'purchase', id } });
  return { success: true, data: { newBalance } };
}
```

### Pattern 3: CSS Class Injection for Cosmetic Themes

**What:** Cosmetic themes add a class to `<html>` (e.g. `theme-forest`) alongside the existing `dark` class. CSS vars are overridden per class in `index.css` using the same selector pattern the existing `.dark {}` block uses.

**When to use:** Any cosmetic that overrides global CSS custom properties without restructuring components.

**Trade-offs:** Pure CSS; no React re-render needed for variable changes. More CSS blocks per theme in `index.css` — if more than ~10 themes ship, split into `cosmetic-themes.css`.

**Example:**

```css
/* index.css */
html.theme-forest {
  --primary-40: #2E7D32;
  --primary-80: #81C784;
  --node-mint:   #A5D6A7;
}
html.dark.theme-forest {
  --primary-40: #66BB6A;
}
```

`applyTheme()` in `lib/theme.ts` stays unchanged — it manages `dark` only. A new `applyCosmetic('theme', id)` manages `theme-*` classes:

```typescript
const THEME_CLASS_PREFIX = 'theme-';
export function applyCosmetic(category: 'theme', id: string | null): void {
  const html = document.documentElement;
  Array.from(html.classList)
    .filter(c => c.startsWith(THEME_CLASS_PREFIX))
    .forEach(c => html.classList.remove(c));
  if (id) html.classList.add(`${THEME_CLASS_PREFIX}${id}`);
}
```

### Pattern 4: Always-Mounted Re-Read via COSMETICS_CHANGED + location

**What:** PlannerScreen is always-mounted. `useState(() => svc.get())` initializers run once at boot. Equipped cosmetics (background, pet) must be re-read in two places: (a) `useEffect` keyed on `location.pathname === '/planner'` catches mid-session changes made on another screen; (b) `eventBus.subscribe('COSMETICS_CHANGED', ...)` handles same-session equip without navigating away.

**When to use:** Any always-mounted screen reading from a service that can change while a different screen is active. This is the canonical pattern from `HomeScreen.tsx` (dailyReadService resync).

**Example:**

```typescript
// PlannerScreen.tsx
const [equippedBg, setEquippedBg] = useState(
  () => cosmeticsService.getEquipped().background ?? null
);
const location = useLocation();

useEffect(() => {
  if (location.pathname === '/planner') {
    setEquippedBg(cosmeticsService.getEquipped().background ?? null);
  }
}, [location.pathname]);

useEffect(() => {
  return eventBus.subscribe('COSMETICS_CHANGED', () => {
    setEquippedBg(cosmeticsService.getEquipped().background ?? null);
  });
}, []);
```

---

## Data Flow

### Purchase Flow

```
User taps "Buy" in ShopScreen
    |
ShopScreen.handlePurchase(item)
    |
cosmeticsService.purchase(item.id, item.cost)
    |-- trellisCreditsService.subtract(cost)   --> writes trellis_fruit_credits
    |-- writeState({ owned: [..., id] })       --> writes trellis_cosmetics
    |
eventBus.emit({ type: 'COSMETICS_CHANGED', payload: { kind: 'purchase', id } })
    |-- ShopScreen subscriber  --> setBalance(trellisCreditsService.getTotal())
    |-- PlannerScreen subscriber --> setCredits(trellisCreditsService.getTotal())
         (PlannerScreen header badge reflects new balance immediately)
```

### Equip Flow

```
User taps "Equip" in ShopScreen
    |
cosmeticsService.equip('theme', 'forest')     --> writes equipped.theme in trellis_cosmetics
    |
eventBus.emit({ type: 'COSMETICS_CHANGED',
                payload: { kind: 'equip', category: 'theme', id: 'forest' } })
    |-- App.tsx subscriber
    |       --> applyCosmetic('theme', 'forest')
    |       --> adds 'theme-forest' class to <html>
    |           CSS vars cascade immediately across all screens (no React re-render needed)
    |-- PlannerScreen subscriber
            --> setEquippedBg / setEquippedPet --> TrellisHero re-renders
```

### Boot-Time Cosmetic Restore

```
main.tsx boots
    |
applyTheme(settingsService.getSync().preferences.theme)   (existing — unchanged)
    |
cosmeticsService.getEquipped()                            (new)
    |
applyCosmetic('theme', equipped.theme ?? null)            (new)
    -- Cosmetic theme class applied before React renders; no FOUC
```

### Garden Cosmetic Re-Render (mid-session)

```
COSMETICS_CHANGED received by PlannerScreen subscriber
    |
setEquippedBg(cosmeticsService.getEquipped().background)
    |
PlannerScreen re-renders --> passes equippedBg prop to TrellisHero
    |
TrellisBackground(props.bgId) renders the new variant SVG
    -- No service call inside TrellisBackground; data flows top-down
```

---

## Integration Details per Question

### (1) Ownership / Equip State Schema

```typescript
// CosmeticsState — persisted as JSON in trellis_cosmetics
interface CosmeticsState {
  owned: string[];          // e.g. ['theme_forest', 'pet_owl', 'bg_sakura']
  equipped: {
    theme?: string | null;      // cosmetic id; null / undefined = default (no class)
    background?: string | null; // cosmetic id; null / undefined = TrellisBackgroundA
    pet?: string | null;        // cosmetic id; null / undefined = no pet
    leafStyle?: string | null;  // defer to Phase 2
  };
}

// Category type used in equip/unequip signatures
type CosmeticsCategory = 'theme' | 'background' | 'pet' | 'leafStyle';
```

Service surface:

```typescript
export const cosmeticsService = {
  getOwned(): string[],
  getEquipped(): CosmeticsState['equipped'],
  isOwned(id: string): boolean,
  purchase(id: string, cost: number): ServiceResult<{ newBalance: number }>,
  equip(category: CosmeticsCategory, id: string): ServiceResult<void>,
  unequip(category: CosmeticsCategory): ServiceResult<void>,
};
```

All methods synchronous (mirrors `trellisCreditsService` and `settingsService.getSync()` pattern). No async needed — localStorage reads are synchronous.

### (2) New Events

Add to `AppEvent` union in `app/src/types/index.ts`:

```typescript
| {
    type: 'COSMETICS_CHANGED';
    payload: {
      kind: 'purchase' | 'equip' | 'unequip';
      id?: string;
      category?: CosmeticsCategory;
    };
  }
```

One event, discriminated by `kind` and `category`. Follows the `COLLECTIONS_CHANGED` precedent (same file, line 765). Do NOT add a separate `THEME_CHANGED` event — that would be a semantic duplicate for the `kind: 'equip', category: 'theme'` case, violating the "one signal per semantic event" rule in CLAUDE.md.

Do NOT reuse `HARVEST_COMPLETED` for purchase — that event means "coins earned (direction: in)"; purchase is coins spent (direction: out). They are different semantic events.

### (3) Equipped Theme Propagation

Theme cosmetics propagate via the CSS class injection pattern (Pattern 3 above). Two call sites:

- **Boot:** `main.tsx` — one new line after the existing `applyTheme(...)` call.
- **Equip:** `App.tsx` — one new `useEffect` subscribing to `COSMETICS_CHANGED`. Filters to `kind === 'equip' && category === 'theme'`.

The existing SettingsScreen "Theme" row (`light / dark / system`) is entirely separate — it controls light/dark/system structural theme. Cosmetic color themes are a different axis and live only in ShopScreen. No changes to the existing theme picker.

**Garden cosmetics** (background, pet) propagate via PlannerScreen state (Pattern 4 above). `TrellisHero` receives `equippedBg` and `equippedPet` as props from PlannerScreen. Inside `TrellisHero`:

```tsx
<TrellisBackground bgId={equippedBg} />        {/* replaces <TrellisBackgroundA /> */}
{equippedPet && <TrellisPet petId={equippedPet} />}
```

`TrellisBackground` is a dispatcher — reads `bgId` prop, renders the matching variant SVG, falls back to `<TrellisBackgroundA />` for unknown/null. No service calls inside this component.

`TrellisPet` renders a positioned SVG/CSS animation at `position: absolute; bottom: 8px; right: 8px; zIndex: 25` inside `TrellisHero`'s `position: relative; isolation: isolate` container. This sits above `TrellisCanvas` (zIndex 20) and below nothing — the hero is a contained stacking context.

### (4) Shop UI Navigation

**Placement:** Sub-route `/settings/shop`, registered in `App.tsx` alongside the other settings sub-routes:

```typescript
{ path: 'settings/shop', element: <PageTransition><ShopScreen /></PageTransition> },
```

Entry point from `SettingsScreen.tsx` as a new `MenuRow`:

```tsx
<MenuRow
  icon={<ShoppingBag size={20} />}
  label={t('settings.menu.shop')}
  onClick={() => navigate('/settings/shop')}
/>
```

**Why not a Planner surface:**
- Planner is the garden management screen (trellis, dying/dead nodes, suggested moves). Adding a shop panel onto it mixes "manage learning" with "browse cosmetics" — different intents, different contexts.
- The tap→shop interaction model from the Planner would require a new panel/modal, which is more complex than a standard sub-screen nav.

**Why not a 6th swipe tab:**
- Adding a tab requires changes to `SwipeTabContainer` (which hardcodes 5 slots), `BottomNavigation`, and the `SCREEN_ROUTES` constant — high blast radius for an infrequently accessed screen.
- Sub-routes are the established pattern for infrequently visited screens. The shop is not a daily destination.

**Build order for navigation:**

| Step | Deliverable | Dependency |
|------|-------------|------------|
| 1 | `CosmeticsState` type + `COSMETICS_CHANGED` event in `types/index.ts` | None |
| 2 | `cosmeticsService` + `trellisCreditsService.subtract()` | Step 1 |
| 3 | `applyCosmetic()` in `lib/theme.ts` + boot call in `main.tsx` + subscriber in `App.tsx` | Step 2 |
| 4 | Cosmetic theme CSS var blocks in `index.css` | Step 3 |
| 5 | `TrellisBackground` dispatcher + variant files; `TrellisPet` | Step 2 |
| 6 | PlannerScreen re-read wiring (state + effects) | Steps 2, 5 |
| 7 | `ShopScreen` + route in `App.tsx` + `MenuRow` in `SettingsScreen.tsx` | Steps 2–6 |

### (5) Transaction Safety

The `purchase()` method on `cosmeticsService` is the single atomic boundary:

1. Read balance from `trellisCreditsService.getTotal()`.
2. Guard: already owned → return `ALREADY_OWNED` error (idempotent).
3. Guard: insufficient funds → return `INSUFFICIENT_FUNDS` error.
4. `trellisCreditsService.subtract(cost)` — writes `trellis_fruit_credits`.
5. Write ownership into `trellis_cosmetics`.
6. Emit `COSMETICS_CHANGED`.

**No double-spend:** the `isOwned()` guard at step 2 blocks a re-purchase attempt. If the UI calls `purchase()` twice concurrently (tap race), the second call returns `ALREADY_OWNED` immediately because step 4 has already written the ownership record.

**Why no true atomic lock is needed:** `trellisCreditsService.subtract()` is synchronous and runs in the same JS event loop turn as the ownership write. There is no async gap between steps 4 and 5 — no user action can interleave. The only failure mode is a `localStorage.setItem` error (storage quota) at step 5 after step 4 already decremented the balance. This is the accepted deduct-then-grant failure direction.

**`trellisCreditsService.subtract(n)` implementation:**

The current `add(count)` clamps `Math.max(0, Math.floor(count))` and silently drops negatives. Add `subtract`:

```typescript
subtract(cost: number): number {
  const current = readTotal();
  const deduct = Number.isFinite(cost) ? Math.max(0, Math.floor(cost)) : 0;
  const next = Math.max(0, current - deduct);  // never below 0
  writeTotal(next);
  return next;
},
```

Do NOT extend `add()` to accept negatives — callers of `add()` (harvest flow) rely on the positive-only clamp. A named `subtract()` is clearer at call sites.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current local-first single device | localStorage is sufficient; coin and cosmetics state are tiny |
| Future shared account / cloud sync | Cosmetics state would need server-side ownership record; `trellis_cosmetics` becomes a cache of server truth |
| Future commercial mode (real currency) | `purchase()` must move to a server-side transaction; local service becomes optimistic update only |

---

## Anti-Patterns

### Anti-Pattern 1: Putting Cosmetics in AppSettings

**What people do:** Add an `owned: string[]` field to `AppPreferences` or `AppSettings`.
**Why it's wrong:** `settingsService.reset()` wipes `AppSettings` to defaults — the user's earned items disappear. `AppSettings.deepMerge` does not protect arrays from being replaced by defaults.
**Do this instead:** Separate `trellis_cosmetics` key, separate service, never touched by settings reset.

### Anti-Pattern 2: Two Events for One Signal

**What people do:** Add a separate `THEME_CHANGED` event for theme equips alongside `COSMETICS_CHANGED`.
**Why it's wrong:** CLAUDE.md rule: "one signal per semantic event." `COLLECTIONS_CHANGED` with `kind` is the established precedent. Two events let subscribers desync from emitters.
**Do this instead:** Single `COSMETICS_CHANGED` with `kind` + `category` discriminant. Subscribers filter inline.

### Anti-Pattern 3: Missing Always-Mounted Re-Read

**What people do:** `const equipped = cosmeticsService.getEquipped()` at the top of a component body, no subscription or location effect.
**Why it's wrong:** PlannerScreen is always-mounted. `useState(() => svc.get())` initializers run once at boot. A pet equipped while on ShopScreen will not appear in the garden until the user force-quits and relaunches.
**Do this instead:** `useEffect` on `[location.pathname]` for on-navigation re-read, plus `eventBus.subscribe('COSMETICS_CHANGED', ...)` for mid-session updates.

### Anti-Pattern 4: Grant-Before-Deduct Purchase Order

**What people do:** Write `owned.push(id)` first, then `subtract(cost)`.
**Why it's wrong:** If `subtract` fails, the user has the item for free. For a local app this is minor now, but the failure direction should favor the user losing coins (support-recoverable) over getting free goods (trust problem for any future commercial mode).
**Do this instead:** Deduct coins first, grant ownership second. Comment the failure direction at the call site.

### Anti-Pattern 5: Cosmetic Themes via `data-theme` Attribute

**What people do:** `document.documentElement.setAttribute('data-theme', 'forest')` with `[data-theme="forest"]` CSS selectors.
**Why it's wrong:** The existing theme system uses class toggling (`dark` class on `<html>`). Tailwind's `@custom-variant dark (&:is(.dark *))` at the top of `index.css` integrates with the class system. Attribute selectors create a parallel specificity system and would need additional `@custom-variant` declarations to interoperate with dark mode.
**Do this instead:** Additional class on `<html>` (`theme-forest`) alongside `dark`. Override CSS vars under `html.theme-forest { }` and `html.dark.theme-forest { }`.

### Anti-Pattern 6: Service Logic Inside TrellisBackground / TrellisPet

**What people do:** Have `TrellisBackground` call `cosmeticsService.getEquipped()` internally to decide which variant to render.
**Why it's wrong:** The component would not react to changes — it would freeze on boot state. Also breaks the "components receive data, services own data" boundary.
**Do this instead:** PlannerScreen holds `equippedBg` and `equippedPet` state, re-reads via event and location, and passes as props. Components are pure renderers.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `cosmeticsService` ↔ `trellisCreditsService` | Direct synchronous call (`subtract` / `getTotal`) | No event bus between services — bus is UI-layer only |
| `ShopScreen` ↔ `cosmeticsService` | Direct method calls; `ServiceResult<T>` return | Mirrors existing service consumer pattern |
| `cosmeticsService` ↔ `PlannerScreen` / `App.tsx` | `COSMETICS_CHANGED` event | Screens never import each other |
| `lib/theme.ts` ↔ `App.tsx` | Import `applyCosmetic`; call on event | Identical to existing `applyTheme` integration |
| `TrellisHero` ↔ cosmetic renders | Props `equippedBg` + `equippedPet` from PlannerScreen | Data flows down; no service calls inside child components |
| `SettingsDataScreen` clear-all | Must remove `trellis_cosmetics` alongside other keys | New key must be registered in the clear-all path |

### External Services

None — the shop is fully local. No payment processors, no CDN for cosmetic assets. All cosmetic graphics are bundled SVG/CSS, consistent with the local-first, privacy-preserving architecture.

---

## Sources

All findings verified against live source files:

- `/Users/Code/EchoLearn/app/src/services/trellis-credits.service.ts` — coin balance pattern; `add()` clamp logic to extend with `subtract()`
- `/Users/Code/EchoLearn/app/src/services/settings.service.ts` — why `AppSettings` is wrong for owned goods; reset() behavior
- `/Users/Code/EchoLearn/app/src/types/index.ts` lines 728–793 — `AppEvent` union; `COLLECTIONS_CHANGED` with `kind` as precedent
- `/Users/Code/EchoLearn/app/src/lib/theme.ts` — `applyTheme`; extension point for `applyCosmetic`
- `/Users/Code/EchoLearn/app/src/screens/SettingsScreen.tsx` — `MenuRow` pattern; existing theme picker (light/dark/system row must remain unchanged)
- `/Users/Code/EchoLearn/app/src/screens/PlannerScreen.tsx` — credits state pattern; `TrellisHero` mounting; always-mounted context; no existing `useLocation` re-read (gap to fill)
- `/Users/Code/EchoLearn/app/src/components/trellis/TrellisHero.tsx` — `TrellisBackgroundA` render point; `position: relative; isolation: isolate` confirmed for pet overlay z-index
- `/Users/Code/EchoLearn/app/src/components/trellis/TrellisCanvas.tsx` — SVG at `zIndex: 20`; pet overlay must be `zIndex: 25`
- `/Users/Code/EchoLearn/app/src/components/trellis/TrellisStatusPanel.tsx` — `HARVEST_COMPLETED` emit precedent; `onCreditsChange` callback pattern
- `/Users/Code/EchoLearn/app/src/state/useTrellisData.ts` — `eventBus.subscribe` pattern for always-mounted hooks
- `/Users/Code/EchoLearn/app/src/App.tsx` lines 296–323 — router sub-screen route registration; `applyTheme` call site (boot); OS dark-mode listener pattern to extend
- `/Users/Code/EchoLearn/app/src/index.css` lines 1–200 — `.dark {}` override pattern; CSS var vocabulary; `isolation: isolate` does not create containing block for `fixed` — confirmed pet uses `absolute` not `fixed`

---

*Architecture research for: local-first cosmetic rewards shop (Trellis v1.7)*
*Researched: 2026-05-20*
