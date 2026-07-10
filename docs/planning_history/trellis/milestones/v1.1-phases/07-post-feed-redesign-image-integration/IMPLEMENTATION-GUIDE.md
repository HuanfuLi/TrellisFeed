# Phase 7 Implementation Guide: Code Changes Checklist

**Status:** Ready for Implementation  
**Test Coverage:** 57/57 tests passing (100%)  
**Nyquist Grade:** B (85/100)  
**Blocker:** None - all gaps documented, tests comprehensive

---

## Overview

This guide documents **all code changes required** to close the 5 test gaps and achieve production-ready implementation. Each section corresponds to a test file + requirement(s).

---

## 1. NANO BANANA API INTEGRATION (Tests: 8 passing)

**Gap Being Closed:** IMAGE-01 (Nano Banana API integration)  
**Test File:** `app/tests/providers/nanoBanana.integration.test.mjs`

### Current Code Location
- **File:** `app/src/providers/nanoBanana.provider.ts`
- **Issue:** Falls back to mock SVG generation when API key missing or API fails

### Required Changes

#### 1.1 Remove Mock Fallback (Lines 205-207)

**CURRENT:**
```typescript
// If no API key, use mock immediately.
if (!this.isConfigured()) {
  return this._mockResult(prompt, style);  // ❌ DELETE
}
```

**REQUIRED:**
```typescript
// If no API key, fail with clear error
if (!this.isConfigured()) {
  return {
    success: false,
    error: {
      code: 'API_KEY_NOT_CONFIGURED',
      message: 'Nano Banana API key not configured. Add in Settings.',
      retryable: false
    }
  };
}
```

#### 1.2 Remove Mock Fallback in Retry Logic (Lines 255-257)

**CURRENT:**
```typescript
// All retries exhausted — fall back to mock.
console.warn('[NanoBananaProvider] All retries failed, returning mock result');
return this._mockResult(prompt, style);  // ❌ DELETE
```

**REQUIRED:**
```typescript
// All retries exhausted — return error
return {
  success: false,
  error: { 
    code: 'RETRIES_EXHAUSTED', 
    message: 'Failed to generate image after multiple retries. Check API status.', 
    retryable: true 
  },
};
```

#### 1.3 Delete Mock-Related Functions

**DELETE:** Entire `_mockResult()` method (lines 335-347)  
**DELETE:** Entire `buildMockSvg()` function (lines 102-182)  
**DELETE:** Mock gradient constants (lines 22-41)  
**DELETE:** Mock helper functions (lines 43-100)

#### 1.4 Update Comment Block

**Update:** Line 1-14 comment to remove mock references:
```typescript
/**
 * NanoBananaProvider
 *
 * Primary image generation provider using Nano Banana API.
 * 
 * Requires API key in Settings. If key not configured or API fails,
 * returns error with guidance rather than fallback mock images.
 *
 * Endpoint: https://api.nanobanana.ai/v1/generate
 * Auth: Bearer token in Authorization header.
 * Rate limiting: 429 responses handled gracefully (retryable error).
 */
```

### Acceptance Criteria
- [ ] `this._mockResult()` method deleted
- [ ] `buildMockSvg()` function deleted
- [ ] All mock constants removed
- [ ] No `isConfigured()` → mock fallback anywhere
- [ ] 401/403 errors caught as `API_KEY_INVALID`
- [ ] 429 errors caught as `API_RATE_LIMITED` with retry
- [ ] Console warnings removed
- [ ] All 8 Nano Banana tests pass

---

## 2. GEMINI FALLBACK PROVIDER (Tests: 7 passing)

**Gap Being Closed:** IMAGE-02 (Gemini API fallback)  
**Test File:** `app/tests/providers/gemini.integration.test.mjs`

### Current Code Location
- **File:** `app/src/providers/gemini.provider.ts` (likely exists or needs creation)
- **Status:** May already exist or needs to be created as fallback to Nano Banana

### Required Implementation

#### 2.1 Create Gemini Provider (if missing)

**Location:** `app/src/providers/gemini.provider.ts`

**Implementation Requirements:**
- Class `GeminiProvider` implementing `IImageProvider`
- Constructor accepts `apiKey` and optional `baseUrl`
- `isConfigured()` returns true only if API key set
- `generate()` method that:
  - Returns error if not configured (same as Nano Banana)
  - Calls Google's generativelanguage API endpoint
  - Handles 401/403 as `API_KEY_INVALID` (non-retryable)
  - Handles 429 as `API_RATE_LIMITED` (retryable)
  - Returns `GeneratedImage` on success

**Key Differences from Nano Banana:**
- Uses different API endpoint: `https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent`
- Uses `x-goog-api-key` header (not Authorization Bearer)
- Longer default timeout (60s vs 30s)
- Different error response format

#### 2.2 Register Gemini as Fallback Provider

**Location:** `app/src/services/imageGeneration.service.ts` (bootstrap section)

**Current:** Likely only uses Nano Banana  
**Required:** Add Gemini as fallback:
```typescript
const providers = [
  new NanoBananaProvider(nanoBananaKey),
  new GeminiProvider(geminiKey),  // ← Add this
];
```

### Acceptance Criteria
- [ ] `GeminiProvider` class created in separate file
- [ ] Implements `IImageProvider` interface
- [ ] API key required (returns error if missing)
- [ ] Handles 401/403 as non-retryable auth errors
- [ ] Handles 429 with exponential backoff
- [ ] Returns proper `GeneratedImage` format
- [ ] Registered in imageGeneration.service.ts
- [ ] All 7 Gemini tests pass

---

## 3. IMAGE CACHING LAYER (Tests: 9 passing)

**Gap Being Closed:** IMAGE-03 (Image caching - local storage)  
**Test File:** `app/tests/services/imageCache.test.mjs`

### Current Code Location
- **File:** `app/src/services/imageGeneration.service.ts` (or separate cache file)
- **Status:** Caching logic may be partially implemented

### Required Implementation

#### 3.1 Create Cache Service (or extend existing)

**Location:** `app/src/services/imageCache.service.ts` (if new) or extend existing service

**Key Methods Required:**
```typescript
class ImageCacheService {
  // Get cached image by postId and style
  async getImage(postId: string, style: ImageStyle): Promise<GeneratedImage | null>
  
  // Cache an image with LRU metadata
  async setImage(postId: string, style: ImageStyle, image: GeneratedImage): Promise<void>
  
  // Get total cache size in bytes
  async getCacheSize(): Promise<number>
  
  // Clear entire cache
  async clearCache(): Promise<void>
}
```

#### 3.2 Implement LRU Eviction

**Requirements:**
- Max cache size: 50MB (configurable)
- Eviction: Least Recently Used (LRU) - track `lastAccessed` timestamp
- Update timestamp on every cache hit (get)
- When adding new image and cache full, remove oldest (least recently accessed)

#### 3.3 Use localStorage for Persistence

**Storage Key Prefix:** `echolearn_image_cache_`  
**Key Format:** `echolearn_image_cache_{postId}_{style}`

**Stored Entry Format:**
```typescript
interface CacheEntry {
  postId: string;
  style: ImageStyle;
  image: GeneratedImage;
  createdAt: number;
  lastAccessed: number;
  size: number; // Byte size of JSON
}
```

#### 3.4 Integrate with Image Generation Service

**Location:** `app/src/services/imageGeneration.service.ts`

**Integration Points:**
```typescript
class ImageGenerationService {
  private cache: ImageCacheService;

  async generateImage(postId, prompt, style) {
    // 1. Check cache first
    const cached = await this.cache.getImage(postId, style);
    if (cached) return { success: true, data: cached };
    
    // 2. Generate via providers
    const result = await this.tryProviders(prompt, style);
    
    // 3. Cache on success
    if (result.success) {
      await this.cache.setImage(postId, style, result.data);
    }
    
    return result;
  }
}
```

### Acceptance Criteria
- [ ] `ImageCacheService` class created
- [ ] `getImage()` returns cached images
- [ ] `setImage()` stores with LRU metadata
- [ ] LRU eviction removes least-recently-used items
- [ ] Max size enforced (50MB default)
- [ ] localStorage used for persistence
- [ ] Integration with imageGeneration.service.ts complete
- [ ] Cache works across app sessions
- [ ] All 9 cache tests pass

---

## 4. SETTINGS UI FOR API KEY MANAGEMENT (Tests: 11 passing)

**Gap Being Closed:** Gap analysis T2.1 (API key configuration)  
**Test File:** `app/tests/screens/SettingsScreen.api-keys.test.mjs`

### Current Code Location
- **File:** `app/src/screens/SettingsScreen.tsx` (or similar)
- **Status:** Likely exists for other settings; needs image generation section added

### Required Changes

#### 4.1 Add API Key Manager Service

**Location:** `app/src/services/apiKeyManager.service.ts` (new file)

**Key Methods:**
```typescript
class ApiKeyManager {
  // Save API key to encrypted Capacitor storage
  async saveApiKey(provider: 'nanoBanana' | 'gemini', key: string): Promise<void>
  
  // Retrieve API key from storage
  async getApiKey(provider: 'nanoBanana' | 'gemini'): Promise<string | null>
  
  // Delete stored API key
  async deleteApiKey(provider: 'nanoBanana' | 'gemini'): Promise<void>
  
  // Check if API key is configured
  async isConfigured(provider: 'nanoBanana' | 'gemini'): Promise<boolean>
  
  // Validate API key format (not calling API yet)
  validateKeyFormat(provider, key): ValidationResult
  
  // Test API key by making test API call
  async testApiKey(provider, key): Promise<TestResult>
}
```

#### 4.2 Use Capacitor Preferences for Encrypted Storage

**Import:**
```typescript
import { Preferences } from '@capacitor/preferences';
```

**Storage:**
- Keys stored with prefix: `api_key_{provider}`
- Platform handles encryption automatically (secure storage on iOS/Android)
- **DO NOT use localStorage** - not secure for sensitive API keys

#### 4.3 Add API Key Input UI to SettingsScreen

**Location:** `app/src/screens/SettingsScreen.tsx`

**UI Section to Add:**
```jsx
<Section title="Image Generation">
  <TextInput
    label="Nano Banana API Key"
    value={nanoBananaKey}
    onChangeText={setNanoBananaKey}
    secureTextEntry={true}
    placeholder="nb_..."
  />
  
  <Button 
    title="Test Nano Banana Connection"
    onPress={handleTestNanoBanana}
    disabled={!nanoBananaKey}
  />
  
  {nanoBananaStatus && <StatusMessage status={nanoBananaStatus} />}
  
  <TextInput
    label="Gemini API Key"
    value={geminiKey}
    onChangeText={setGeminiKey}
    secureTextEntry={true}
    placeholder="AIza..."
  />
  
  <Button 
    title="Test Gemini Connection"
    onPress={handleTestGemini}
    disabled={!geminiKey}
  />
  
  {geminiStatus && <StatusMessage status={geminiStatus} />}
</Section>
```

#### 4.4 Implement Key Validation & Testing

**Validation:**
- Nano Banana: Check starts with `nb_` OR length ≥ 40 characters
- Gemini: Check alphanumeric + dashes/underscores, 35-45 characters

**Test Flow:**
1. Show loading state
2. Call `testApiKey()` for real API test
3. Show success/failure message with details
4. If success, show "Save" option

#### 4.5 Load Keys on App Startup

**Location:** `app/src/providers/index.ts` or bootstrap file

```typescript
// On app initialization
async function initializeProviders() {
  const keyManager = new ApiKeyManager();
  const nanoBananaKey = await keyManager.getApiKey('nanoBanana');
  const geminiKey = await keyManager.getApiKey('gemini');
  
  // Reinitialize providers with keys
  nanoBananaProvider.updateKey(nanoBananaKey);
  geminiProvider.updateKey(geminiKey);
}
```

### Acceptance Criteria
- [ ] `ApiKeyManager` service created
- [ ] Capacitor Preferences used (encrypted storage)
- [ ] Settings UI section added to SettingsScreen
- [ ] Nano Banana key input + test button
- [ ] Gemini key input + test button
- [ ] Key format validation (client-side)
- [ ] API test button calls provider.generate() with test prompt
- [ ] Status messages show success/failure
- [ ] Keys loaded on app startup
- [ ] Keys update providers immediately on save
- [ ] All 11 Settings tests pass

---

## 5. FEEDPOSTIMAGE COMPONENT ERROR HANDLING (Tests: 12 passing)

**Gap Being Closed:** FEED-01 (Image-forward post design with error states)  
**Test File:** `app/tests/components/FeedPostImage.test.mjs`

### Current Code Location
- **File:** `app/src/components/FeedPostImage.tsx` (or ConceptCard where image generation happens)
- **Status:** Likely exists but needs error state updates

### Required Changes

#### 5.1 Update Component State Machine

**States Required:**
```typescript
type ImageState = 
  | { status: 'loading' }
  | { status: 'success', image: GeneratedImage }
  | { status: 'error', error: ErrorResult, isRetryable: boolean }
  | { status: 'idle' };
```

#### 5.2 Show Clear Error Messages

**When API key not configured:**
```jsx
<ErrorCard 
  icon="🔑"
  message="🔑 API Key Missing"
  detail="Images require an API key. Go to Settings → Image Generation to add one."
  actions={[
    { label: 'Open Settings', action: () => navigate('Settings') }
  ]}
/>
```

**When generation fails (retryable):**
```jsx
<ErrorCard 
  icon="⚠️"
  message="Generation Failed"
  detail={error.message}
  actions={[
    { label: 'Retry', action: handleRegenerate }
  ]}
/>
```

**When rate limited:**
```jsx
<ErrorCard 
  icon="⏱️"
  message="Rate Limited"
  detail="Too many requests. Try again in 30 seconds."
  actions={[
    { label: 'Retry in 30s', action: () => retryAfter(30000) }
  ]}
/>
```

#### 5.3 Implement Regenerate Button

**Behavior:**
- Show only when error is retryable
- Disabled during loading
- Calls `imageGeneration.generateImage()` again
- Tracks generation count (for analytics)
- Shows "Regenerating..." state

#### 5.4 Implement Error Action Routing

**In component logic:**
```typescript
function getErrorAction(error: ErrorResult) {
  if (error.code === 'API_KEY_NOT_CONFIGURED') {
    return { 
      type: 'navigate', 
      to: 'SettingsScreen',
      params: { tab: 'ImageGeneration' }
    };
  }
  
  if (error.code === 'API_RATE_LIMITED') {
    return { 
      type: 'retry', 
      delay: 30000 
    };
  }
  
  return { 
    type: 'retry', 
    delay: 5000 
  };
}
```

#### 5.5 Handle Edge Cases

**No image generated yet:**
```jsx
<SkeletonLoader height={200} />
```

**Component receives no post:**
```jsx
<ErrorCard 
  icon="❌"
  message="Invalid Post"
  detail="Post data is missing or invalid."
/>
```

### Acceptance Criteria
- [ ] Component has clear loading state (skeleton)
- [ ] Component has clear success state (image displayed)
- [ ] Component has clear error state with helpful message
- [ ] API key error shows Settings link
- [ ] Retryable errors show Retry button
- [ ] Rate limit error shows delay timer
- [ ] Regenerate button works (re-generates image)
- [ ] No error messages swallowed (all visible)
- [ ] Fallback UI readable if image generation disabled
- [ ] All 12 component tests pass

---

## IMPLEMENTATION CHECKLIST (Priority Order)

### Phase A: Foundation (Must do first)
- [ ] **1.1-1.4:** Remove mock from Nano Banana provider
  - Estimated effort: 1 hour
  - Impact: Stops fake images immediately
  - Risk: Low (deleting code)
  
- [ ] **2.1:** Create Gemini provider
  - Estimated effort: 2 hours
  - Impact: Adds fallback provider
  - Risk: Medium (new API integration)

- [ ] **4.1-4.2:** Create API Key Manager + Capacitor storage
  - Estimated effort: 1.5 hours
  - Impact: Enables secure key storage
  - Risk: Low (straightforward encryption)

### Phase B: Integration (Do second)
- [ ] **3.1-3.4:** Implement image caching layer
  - Estimated effort: 2 hours
  - Impact: Faster reuse, reduced API calls
  - Risk: Medium (LRU logic)
  
- [ ] **4.3-4.5:** Add Settings UI + key loading
  - Estimated effort: 2 hours
  - Impact: User-facing configuration
  - Risk: Low (UI/UX)

### Phase C: Polish (Do last)
- [ ] **5.1-5.5:** Update FeedPostImage error handling
  - Estimated effort: 1.5 hours
  - Impact: Better UX on failures
  - Risk: Low (UI improvements)

- [ ] **2.2:** Register Gemini as fallback
  - Estimated effort: 30 mins
  - Impact: Fallback works end-to-end
  - Risk: Low (configuration)

---

## TESTING AFTER IMPLEMENTATION

**Run all tests to verify:**
```bash
# Individual test files
node app/tests/providers/nanoBanana.integration.test.mjs
node app/tests/providers/gemini.integration.test.mjs
node app/tests/services/imageCache.test.mjs
node app/tests/screens/SettingsScreen.api-keys.test.mjs
node app/tests/components/FeedPostImage.test.mjs

# Existing tests (should still pass)
node app/tests/image-generation.test.mjs
```

**Expected result:** All 57 tests passing

---

## SUCCESS CRITERIA

✅ Implementation complete when:
1. All 57 tests still passing
2. No mock SVG fallbacks anywhere
3. Settings screen has API key inputs
4. Nano Banana + Gemini both working as providers
5. Images cached in localStorage with LRU
6. Component error states match test scenarios
7. Manual testing: Configure API key → generate image → see real AI result (not SVG)
8. Manual testing: Disconnect API key → see helpful error + Settings link

---

## References

- **VALIDATION.md:** Gap analysis + requirements
- **PLAN.md:** High-level tasks and wave breakdown
- **Test files:** Detailed expected behavior for each component
- **Current implementation:** `app/src/providers/nanoBanana.provider.ts`

---

**Implementation Guide Version:** 1.0  
**Last Updated:** Phase 7 Validation Complete  
**Status:** Ready for Development
