---
phase: 07-post-feed-redesign-image-integration
plan: gap
type: gap-closure
completed: 2026-03-26

key-files:
  modified:
    - app/src/providers/nanoBanana.provider.ts
    - app/src/providers/gemini.provider.ts
    - app/src/components/FeedPostImage.tsx
    - app/src/types/index.ts
    - app/src/services/mock/settings.mock.ts
    - app/src/services/imageGeneration.bootstrap.ts
    - app/src/screens/SettingsScreen.tsx

decisions:
  - "Switched mock SVG encoding from btoa+base64 to encodeURIComponent+charset=utf-8 data URI — simpler and handles all Unicode"
  - "Replaced emoji icon chars in mock SVGs with ASCII text labels to fully eliminate non-ASCII in the SVG string"
  - "Gap 3 and Gap 4 landed in a single commit — primaryProvider type, defaults, bootstrap logic, and Settings UI must be consistent"
  - "Bootstrap 'auto' mode: only registers providers that have keys configured, so mock fallback only fires when no keys are present"
---

# Phase 7 Gap Closure Summary

**4 UAT-identified bugs fixed — mock SVG encoding, retry button bubbling, provider selection UI, and Gemini-only bootstrap activation**

## Gaps Fixed

### Gap 1: Mock Encoding Error (btoa non-ASCII)
**Root cause:** `buildMockSvg()` embedded emoji characters (📊, 🎨, 📸, etc.) and the ellipsis `…` (U+2026) directly into an SVG string, then passed that string to `btoa()`. `btoa` only accepts Latin-1 (0–255); anything outside that range throws `InvalidCharacterError`.

**Fix:** Replaced `btoa(svg)` with `encodeURIComponent(svg)` and switched to a `charset=utf-8` data URI (`data:image/svg+xml;charset=utf-8,...`). Replaced emoji icon characters with ASCII text labels (`[chart]`, `[art]`, `[photo]`, etc.) and replaced `…` with `...` so the SVG itself is pure ASCII — no encoding surprises possible.

**Files modified:**
- `app/src/providers/nanoBanana.provider.ts` — `buildMockSvg` function
- `app/src/providers/gemini.provider.ts` — `buildMockSvg` function

**Commit:** `d039a98c`

---

### Gap 2: Event Bubbling on Retry Button
**Root cause:** The `Retry` button in `ImageError` (inside `FeedPostImage.tsx`) had a plain `onClick={onRetry}` handler. Click events bubble up to the parent `ConceptCard` wrapper, which has its own click handler that navigates to Post Detail.

**Fix:** Changed the onClick handler to `(e) => { e.stopPropagation(); onRetry(); }` — stops the event from reaching any ancestor before invoking the retry callback.

**Files modified:**
- `app/src/components/FeedPostImage.tsx` — `ImageError` retry button

**Commit:** `9dfafed0`

---

### Gap 3: Provider Selection in Settings
**Root cause:** Settings screen had no way to choose which provider (Nano Banana vs Gemini) should be primary. Provider order was hardcoded in `bootstrapImageGeneration()`.

**Fix:**
- Added `ImageProviderPrimary` type (`'nanoBanana' | 'gemini' | 'auto'`) to `src/types/index.ts`
- Added `primaryProvider` field to `ImageGenerationSettings` interface (default: `'auto'`)
- Updated `settings.mock.ts` default value accordingly
- Added a "Primary Provider" `SelectInput` dropdown to the Image Generation section in `SettingsScreen.tsx` with three options: Auto (use available keys), Nano Banana (primary), Gemini. Changing the dropdown immediately saves and re-bootstraps.

**Files modified:**
- `app/src/types/index.ts`
- `app/src/services/mock/settings.mock.ts`
- `app/src/screens/SettingsScreen.tsx`

**Commit:** `946fbc75`

---

### Gap 4: Configuration Sync (Gemini not activating when NanoBanana absent)
**Root cause:** `bootstrapImageGeneration()` always registered both providers in the order `[NanoBanana, Gemini]`, regardless of which keys were present. When only a Gemini key was configured, NanoBanana (unconfigured) was still first in the array and its `isConfigured()` returned false — the service tried NanoBanana first, got a mock fallback, and never tried Gemini. The user's real Gemini key was never used.

**Fix:** Bootstrap now evaluates `isConfigured()` on each provider and orders/filters them based on the `primaryProvider` setting:
- `'auto'`: only includes providers that have keys; if only Gemini key is present, only Gemini is registered
- `'gemini'`: Gemini goes first; if Gemini key is absent but NanoBanana key is present, NanoBanana is used
- `'nanoBanana'`: NanoBanana goes first; symmetric to above
- When neither key is present: both providers are registered (both return graceful mock output)

**Files modified:**
- `app/src/services/imageGeneration.bootstrap.ts`

**Commit:** `946fbc75` (same commit as Gap 3 — type/defaults/bootstrap/UI must stay consistent)

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `d039a98c` | fix | Gap 1 — ASCII-safe mock SVG encoding |
| `9dfafed0` | fix | Gap 2 — Retry button event propagation |
| `946fbc75` | feat | Gap 3 + 4 — Provider selection UI + bootstrap fix |

## Success Criteria Verification

- [x] Gap 1: `encodeURIComponent` + `charset=utf-8` — no non-ASCII in btoa path
- [x] Gap 2: `e.stopPropagation()` on Retry onClick — navigation not triggered
- [x] Gap 3: Primary Provider dropdown in Settings with 3 options wired to settings + bootstrap
- [x] Gap 4: Bootstrap correctly places Gemini first (or exclusively) when NanoBanana key is absent

## Known Stubs

None — all gaps are fully resolved. Mock images render as colored gradient SVGs with ASCII text labels.
