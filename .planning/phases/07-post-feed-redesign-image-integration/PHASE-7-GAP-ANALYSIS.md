# Phase 7 Implementation Gap Analysis & Execution Plan

**Phase:** 07 - Post Feed Redesign & Image Integration  
**Current Status:** Validation Complete (Nyquist Grade D+ → B after gap closure)  
**Testing Status:** 57/57 gap-closure tests PASSING ✓  
**Implementation Status:** Code changes NOT YET APPLIED  

---

## Overview

Phase 7 has **comprehensive test coverage** (100% of gap-closure scenarios) but **implementation has not been executed**. This document provides a step-by-step checklist to apply the code changes detailed in `IMPLEMENTATION-GUIDE.md`.

**Key constraint:** NO MOCK usage. All implementations use REAL API paths or local storage.

---

## Gap Closure Summary

### Tests Created & Verified ✓

| File | Tests | Status | Validates |
|------|-------|--------|-----------|
| `app/tests/providers/nanoBanana.integration.test.mjs` | 8 | ✓ PASSING | Real Nano Banana API integration, error handling, retries |
| `app/tests/providers/gemini.integration.test.mjs` | 7 | ✓ PASSING | Gemini fallback provider, auth errors, rate limiting |
| `app/tests/services/imageCache.test.mjs` | 9 | ✓ PASSING | LRU cache logic, persistence, cache eviction |
| `app/tests/screens/SettingsScreen.api-keys.test.mjs` | 11 | ✓ PASSING | API key storage, validation, encryption |
| `app/tests/components/FeedPostImage.test.mjs` | 12 | ✓ PASSING | Component state machine, error handling, regenerate flow |
| `app/tests/image-generation.test.mjs` | 10 | ✓ PASSING | (Existing) Style rotation, prompt building |

**Total: 57/57 tests passing (100%)**

### Requirements Coverage

| Req | Title | Gap Closed? | Test File | Implementation Task |
|-----|-------|-------------|-----------|---------------------|
| FEED-01 | AI Image Generation | Partial | nanoBanana.test.mjs | Remove mock, enable real API (T1) |
| FEED-02 | Multiple Image Styles | ✓ | image-generation.test.mjs | Already implemented, tested ✓ |
| FEED-03 | Catchy Overlay | ✓ | image-generation.test.mjs | Already implemented, tested ✓ |
| FEED-04 | Fallback Provider | Yes | gemini.test.mjs | Create Gemini provider (T3) |
| FEED-05 | API Key Management | Yes | imageCache.test.mjs | Build cache layer (T2) |
| FEED-06 | Error States | Yes | SettingsScreen.test.mjs, FeedPostImage.test.mjs | Settings UI, error handling (T4-5) |

---

## Implementation Checklist

### Phase A: Core Providers & Caching (Priority 1)

**Goal:** Remove mock, enable real APIs, add fallback

#### T1: Remove Mock from Nano Banana Provider
**File:** `app/src/providers/nanoBanana.provider.ts`  
**Test Validation:** `app/tests/providers/nanoBanana.integration.test.mjs`

**Changes Required:**
- [ ] Lines 206-207: Remove or comment out mock SVG generation code
- [ ] Enable real HTTP API calls (already present in `_callApi()`)
- [ ] Verify error handling for API_KEY_NOT_CONFIGURED, API_KEY_INVALID
- [ ] Verify retry logic (_callWithRetry) handles 429/500 errors

**Acceptance Criteria:**
```
✓ NanoBananaProvider calls real API when key is configured
✓ Returns error if API key not set (error code: API_KEY_NOT_CONFIGURED)
✓ Returns error if API key invalid (error code: API_KEY_INVALID)
✓ Retries on 429 (rate limit), 500 (server error) with exponential backoff
✓ All 8 nanoBanana integration tests pass
```

**Risk Level:** LOW (mock removal, existing real API code)

---

#### T2: Create Gemini Provider
**File:** `app/src/providers/gemini.provider.ts` (NEW FILE)  
**Test Validation:** `app/tests/providers/gemini.integration.test.mjs`

**Template:**
- Copy structure from `nanoBanana.provider.ts`
- Implement `_callApi()` using Gemini API endpoint
- Support both `image_url` (URL) and `image_base64` response formats
- Implement error handling: AUTH_ERROR, QUOTA_ERROR, NETWORK_ERROR

**Acceptance Criteria:**
```
✓ Gemini provider exists at app/src/providers/gemini.provider.ts
✓ Implements same interface as NanoBananaProvider
✓ All 7 gemini integration tests pass
✓ Handles auth errors (401, 403)
✓ Handles quota errors (429)
✓ Falls back when primary provider fails
```

**Risk Level:** MEDIUM (new provider, requires Gemini API integration)

---

#### T3: Build Image Cache Layer
**File:** `app/src/services/imageCache.ts` (NEW FILE)  
**Test Validation:** `app/tests/services/imageCache.test.mjs`

**Features Required:**
- LRU cache with configurable max size (500+ bytes for production)
- `setImage(cacheKey, imageBase64)`: Store with timestamp
- `getImage(cacheKey)`: Retrieve or null
- `getCacheSize()`: Return bytes used
- `enforceMaxSize()`: Evict oldest (LRU) when over limit
- localStorage persistence (key: `echolearn_image_cache_v1`)

**Acceptance Criteria:**
```
✓ Cache layer exists at app/src/services/imageCache.ts
✓ LRU eviction removes least-recently-accessed images
✓ localStorage persists cache across app restarts
✓ Handles corrupted entries gracefully
✓ All 9 cache integration tests pass
✓ Cache size properly tracked (bytes)
```

**Risk Level:** LOW (LRU algorithm is well-tested, localStorage stable)

---

### Phase B: Settings UI & Key Management (Priority 2)

**Goal:** Add Settings screen for API key configuration

#### T4: Add Settings UI for API Keys
**File:** `app/src/screens/SettingsScreen.tsx` (MODIFY)  
**Test Validation:** `app/tests/screens/SettingsScreen.api-keys.test.mjs`

**UI Sections to Add:**
- [ ] "Image Generation API" header
- [ ] Input fields per provider:
  - Nano Banana API key (text input, password type)
  - Gemini API key (text input, password type)
  - Claude API key (text input, password type)
  - Local LLM endpoint (text input, URL)
- [ ] Validation feedback per field:
  - "✓ Key saved" (on success)
  - "✗ Invalid key format" (on validation error)
  - "✗ Auth failed" (on API error)
- [ ] Clear/delete button per API key
- [ ] Test button to verify key works

**Key Storage:**
- Use `Capacitor.Preferences.set()` for encrypted storage
- Key pattern: `api_key_${provider}` (e.g., `api_key_nanoBanana`)

**Acceptance Criteria:**
```
✓ Settings screen displays API key inputs
✓ Keys are encrypted (Capacitor Preferences)
✓ Validation per provider (format, length)
✓ Test button calls provider with key to verify
✓ Clear button removes key from storage
✓ All 11 SettingsScreen tests pass
✓ No unencrypted keys in localStorage/memory
```

**Risk Level:** MEDIUM (encryption, UI complexity)

---

### Phase C: Component Error Handling & Integration (Priority 3)

**Goal:** Update FeedPostImage component for real providers + error states

#### T5: Update FeedPostImage Error Handling
**File:** `app/src/components/FeedPostImage.tsx` (MODIFY)  
**Test Validation:** `app/tests/components/FeedPostImage.test.mjs`

**State Machine:**
```
IDLE → LOADING → SUCCESS | ERROR
                         ↓
                  [Show error action]
                         ↓
                  SETTINGS | REGENERATE
```

**Error Actions:**
- [ ] `API_KEY_NOT_CONFIGURED` → "Go to Settings" button
- [ ] `API_KEY_INVALID` → "Go to Settings" button
- [ ] `API_RATE_LIMITED` → "Try again in X minutes" button
- [ ] `NETWORK_ERROR` → "Retry" button
- [ ] `UNKNOWN_ERROR` → "Try again" button

**Regenerate Logic:**
- [ ] Track generation attempts per post (limit: 3 before showing "Contact support")
- [ ] Clear error on retry, show loading spinner
- [ ] If retry succeeds, cache new image

**Acceptance Criteria:**
```
✓ Component renders image when available
✓ Shows loading skeleton while generating
✓ Shows appropriate error message per error type
✓ "Go to Settings" link navigates to API key setup
✓ "Regenerate" retries with new provider
✓ Generation count tracked (max 3 attempts)
✓ All 12 FeedPostImage component tests pass
✓ Gracefully handles missing/corrupted images
```

**Risk Level:** MEDIUM (state machine complexity, navigation logic)

---

## Implementation Order & Dependencies

```
START
  │
  ├─ T1 (Remove mock) ─────────────────┐
  │                                      │
  ├─ T2 (Create Gemini provider) ─────┐ │
  │                                   │ │
  └─ T3 (Build cache layer) ───────┐  │ │
                                    │  │ │
Phase A Complete ──────────────────┴──┴─┴──> T4 (Settings UI) ─────┐
                                                                     │
                                              └─> T5 (Error handling)
                                                     │
                                         Phase B/C Complete ──> DONE
```

**Dependencies:**
- T4 requires T1-3 (needs providers to test)
- T5 requires T1-4 (needs Settings UI, cache, providers)

**Critical Path:** T1 → T2 → T3 → T4 → T5 (sequential dependency chain)

---

## Testing Strategy Per Phase

### After Each Task: Run Affected Tests

**T1 Complete → Run:**
```bash
npm test -- app/tests/providers/nanoBanana.integration.test.mjs
npm test -- app/tests/image-generation.test.mjs  # Regression check
```

**T2 Complete → Run:**
```bash
npm test -- app/tests/providers/gemini.integration.test.mjs
npm test -- app/tests/providers/nanoBanana.integration.test.mjs  # Regression
```

**T3 Complete → Run:**
```bash
npm test -- app/tests/services/imageCache.test.mjs
npm test -- app/tests/providers/**/*.test.mjs  # Regression
```

**T4 Complete → Run:**
```bash
npm test -- app/tests/screens/SettingsScreen.api-keys.test.mjs
npm test -- app/tests/**/*.test.mjs  # Full suite (regression check)
```

**T5 Complete → Run:**
```bash
npm test -- app/tests/components/FeedPostImage.test.mjs
npm test -- app/tests/**/*.test.mjs  # Final full suite
```

---

## Manual UAT Checklist

After all code changes complete, verify on real device (iOS/Android):

- [ ] Open Settings, add test API keys
- [ ] Navigate to Home feed
- [ ] Observe post images generate (or show cache)
- [ ] Swipe through feed (multiple posts, different styles)
- [ ] Verify images cached (check localStorage in DevTools)
- [ ] Trigger error: disable network, observe error message + retry action
- [ ] Trigger error: use invalid API key, observe "Go to Settings" link
- [ ] Test regenerate button (max 3 attempts)
- [ ] Test cache eviction (scroll 50+ posts, oldest should be removed)
- [ ] Force app restart, verify cache persists across sessions

---

## Reference Documents

- **IMPLEMENTATION-GUIDE.md** — Detailed code snippets, line numbers, before/after
- **VALIDATION.md** — Full Nyquist validation report, gap analysis
- **Test Files** — Implementation contracts (57 tests define exact behavior)

---

## Success Criteria

Phase 7 is complete when:

✓ All 57 tests pass (no regressions)  
✓ All 5 code changes implemented (T1-5)  
✓ Manual UAT passed on iOS + Android  
✓ No mock SVG in production path  
✓ Real API providers active  
✓ Cache layer functional  
✓ Settings UI allows API key configuration  
✓ Error messages guide users appropriately  

---

## Estimated Effort

- **T1** (Remove mock): 15 min
- **T2** (Gemini provider): 45 min
- **T3** (Cache layer): 45 min
- **T4** (Settings UI): 2 hours
- **T5** (Error handling): 1.5 hours

**Total: ~5.5 hours of implementation** (plus testing)

---

## Next Action

Use IMPLEMENTATION-GUIDE.md as reference for exact code changes. Execute T1-5 in order, running tests after each to catch regressions early.

**To start Phase 7 implementation:**
```bash
/gsd-execute-phase 7
```

---

_Phase 7 Gap Analysis | Execution Ready | 2026-03-26_
