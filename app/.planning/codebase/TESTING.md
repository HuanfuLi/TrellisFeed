# Testing Patterns

**Analysis Date:** 2026-03-31

## Test Framework

**Runner:**
- Node.js native test runner (`node --test`)
- Config: none (uses Node.js built-in)
- Test files: `tests/**/*.test.mjs` (ES module format)

**Assertion Library:**
- `node:assert/strict` (native Node assertion, no external dependency)

**Run Commands:**
```bash
npm test              # Run all tests in tests/**/*.test.mjs
npm run build        # Includes TypeScript compilation check
npm run lint         # ESLint validation
```

## Test File Organization

**Location:**
- Separate from source; `tests/` directory mirrors `src/` structure
- Tests are colocated by domain, not by component location
- Directories: `tests/services/`, `tests/providers/`, `tests/components/`, `tests/screens/`, `tests/hooks/`, `tests/e2e/`

**Naming:**
- Pattern: `[name].test.mjs` (ES module, no TypeScript compilation)
- Examples: `canonical-knowledge.test.mjs`, `imageCache.test.mjs`, `suggestionScorer.test.mjs`

**Structure:**
```
tests/
├── canonical-knowledge.test.mjs          # Service unit tests
├── concept-feed.test.mjs
├── image-generation.test.mjs
├── services/
│   ├── imageCache.test.mjs
│   ├── suggestionScorer.test.mjs
│   ├── trajectoryAnalyzer.test.mjs
│   └── plannerAutoGen.test.mjs
├── providers/
│   ├── gemini.integration.test.mjs       # API integration tests
│   └── nanoBanana.integration.test.mjs
├── components/
│   └── FeedPostImage.test.mjs
├── screens/
│   └── SettingsScreen.api-keys.test.mjs
├── hooks/
└── e2e/
```

## Test Structure

**Suite Organization:**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';

// ── Test-specific mocks or utilities ──────────────────────────
class MockStorage {
  constructor() { this.data = {}; }
  setItem(key, value) { this.data[key] = String(value); }
  getItem(key) { return this.data[key] ?? null; }
  removeItem(key) { delete this.data[key]; }
  clear() { this.data = {}; }
}

// ── Test suite ────────────────────────────────────────────────
test('descriptive test name', () => {
  // Arrange
  const storage = new MockStorage();
  const service = new TestService(storage);

  // Act
  service.setItem('key', 'value');
  const result = service.getItem('key');

  // Assert
  assert.equal(result, 'value');
});

test('another test case', () => {
  // ...
});
```

**Patterns:**

**Arrange-Act-Assert (AAA):**
- Setup phase: create fixtures, initialize mocks, configure state
- Action phase: call the function/method under test
- Assert phase: check results with `assert.*` methods

**Test Factory/Maker Pattern:**
```javascript
const makeQuestion = (overrides = {}) => ({
  id: `q-${Math.random().toString(16).slice(2)}`,
  timestamp: Date.now(),
  date: '2026-03-22',
  content: 'What is spaced repetition?',
  answer: 'Spaced repetition revisits material over widening intervals.',
  keywords: ['memory', 'spacing'],
  reviewSchedule: { nextReviewDate: '2026-03-22', reviewCount: 0, easeFactor: 2.5 },
  createdAt: Date.now(),
  ...overrides,  // Override specific fields per test
});

test('projectQuestionToKnowledgeNode keeps fields', () => {
  const question = makeQuestion({ id: 'q-1', rootLabel: 'Memory' });
  const node = projectQuestionToKnowledgeNode(question);
  assert.equal(node.rootLabel, 'Memory');
});
```

## Mocking

**Framework:** Manual mocks (no external mock library)

**Patterns:**

**Mock Storage:**
```javascript
class MockStorage {
  constructor() { this.data = {}; }
  setItem(key, value) { this.data[key] = String(value); }
  getItem(key) { return this.data[key] ?? null; }
  removeItem(key) { delete this.data[key]; }
  clear() { this.data = {}; }
}

const storage = new MockStorage();
// Pass to service under test: new TestService(storage)
```

**Test Service Classes:**
- Implement service interface in test file (mirrors production interface)
- Used when testing localStorage-backed services
- Example: `TestImageCacheService` in `tests/services/imageCache.test.mjs` (281 lines)

**What to Mock:**
- localStorage (critical for persistence testing)
- HTTP clients (for provider/integration tests)
- Date/time (use fixed timestamps like `Date.now() - 86400000`)
- Complex external dependencies (image providers, LLM APIs)

**What NOT to Mock:**
- Business logic functions (test real implementation)
- Data structures and interfaces (test exact shapes)
- Utility functions like `buildCandidateContextPack()` (test real algorithm)

## Fixtures and Factories

**Test Data:**

Factory pattern for domain objects:
```javascript
const makeQuestion = (overrides = {}) => ({
  id: `q-${Math.random().toString(16).slice(2)}`,
  timestamp: Date.now(),
  content: 'What is spaced repetition?',
  answer: 'Spaced repetition revisits material over widening intervals.',
  keywords: ['memory', 'spacing'],
  reviewSchedule: { nextReviewDate: '2026-03-22', reviewCount: 0, easeFactor: 2.5 },
  createdAt: Date.now(),
  ...overrides,
});

// Usage:
const question = makeQuestion({ id: 'q-1', title: 'Forgetting curve' });
const duplicateQuestion = makeQuestion({ content: 'What is the forgetting curve?' });
```

**Location:**
- Factories defined at top of test file (after imports)
- Shared fixtures for multiple test suites could be in `tests/fixtures/` (not currently used)
- Each test file self-contained with its own makers

## Coverage

**Requirements:** None enforced by CI/CD

**View Coverage:**
- Not configured; test runner doesn't generate coverage reports
- Coverage assessment is manual (examine test-to-code mapping)

**Current Status:**
- Service layer: well-tested (canonical knowledge, image cache, suggestion scoring)
- Components: selectively tested (FeedPostImage, SettingsScreen API key handling)
- Integration tests: present for external APIs (Gemini, NanoBanana)
- Hooks: minimally tested (state mutation difficult to test in Node)

## Test Types

**Unit Tests:**
- Scope: single function or service method
- Approach: mock dependencies (storage, time, external APIs)
- Example: `tests/canonical-knowledge.test.mjs` tests pure functions like `buildCandidateContextPack()`, `decideIngestionOutcome()`
- File: `canonical-knowledge.test.mjs` (170 lines, 8 test cases)

**Integration Tests:**
- Scope: full service or multiple related functions
- Approach: use real implementations, mock only external network/storage
- Example: `tests/providers/gemini.integration.test.mjs` tests actual Gemini API calls with real credentials
- File: `tests/providers/gemini.integration.test.mjs` (276 lines)

**Provider/API Tests:**
- Scope: external service integration (LLM, image generation)
- Approach: real HTTP calls with test credentials
- Tests: success paths, error handling, timeout behavior
- Files:
  - `tests/providers/gemini.integration.test.mjs` — Gemini API
  - `tests/providers/nanoBanana.integration.test.mjs` — NanoBanana image API
  - `tests/image-generation.test.mjs` — Full image generation flow

**E2E Tests:**
- Scope: end-to-end user flows
- Status: directory exists (`tests/e2e/`) but appears unused or minimal
- Framework: not configured; would require browser automation (Playwright, Cypress)

**Component Tests:**
- Scope: UI component behavior and rendering
- Example: `tests/components/FeedPostImage.test.mjs` (251 lines)
  - Tests image rendering with fallbacks
  - Tests error handling and retry logic
- Approach: manual DOM assertions or snapshot checks (minimal in current suite)

## Common Patterns

**Async Testing:**
```javascript
test('async operation completes successfully', async () => {
  const service = new TestService();
  const result = await service.someAsyncMethod();
  assert.equal(result.success, true);
  assert.ok(result.data);
});
```

**Error Testing:**
```javascript
test('returns error for missing card', () => {
  const cards = [];
  const result = submitReview('missing-id', 5, cards);
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
  assert.equal(result.error.retryable, false);
});
```

**Array/Object Assertions:**
```javascript
test('finds candidates with matching keywords', () => {
  const questions = [
    makeQuestion({ id: 'q-1', keywords: ['memory', 'forgetting'] }),
    makeQuestion({ id: 'q-2', keywords: ['ml', 'optimization'] }),
  ];
  const pack = buildCandidateContextPack('forgetting curve', questions);
  assert.ok(pack.candidates.some((c) => c.id === 'q-1'));
});
```

**Time-Dependent Tests:**
```javascript
test('scheduling respects pinned status', () => {
  const card = makeFlashcard({ pinned: true });
  const { days } = calcNextInterval(card.reviewSchedule.reviewCount, 5, card.easeFactor, card.pinned);
  // Pinned cards always return tomorrow (1 day)
  assert.equal(days, 1);
});
```

**Setup/Teardown Patterns:**
- Minimal use; factories handle setup
- Teardown: typically not needed (no global state)
- For localStorage tests: `storage.clear()` called at end of test if needed

## Test Examples

**Unit Test Example:**
File: `tests/canonical-knowledge.test.mjs` (lines 28-43)
```javascript
test('projectQuestionToKnowledgeNode keeps canonical review and placement fields', () => {
  const question = makeQuestion({
    id: 'q-1',
    rootLabel: 'Memory',
    branchLabel: 'Forgetting',
    clusterLabel: 'Recall difficulty',
    placementReason: 'Grouped with forgetting-related concepts.',
  });
  const node = projectQuestionToKnowledgeNode(question);

  assert.equal(node.id, 'q-1');
  assert.equal(node.rootLabel, 'Memory');
  assert.equal(node.branchLabel, 'Forgetting');
  assert.equal(node.clusterLabel, 'Recall difficulty');
  assert.equal(node.reviewSchedule.nextReviewDate, '2026-03-22');
});
```

**Integration Test Example:**
File: `tests/image-generation.test.mjs` (212 lines)
- Tests full image generation pipeline
- Mocks HTTP responses
- Validates cache invalidation
- Tests recovery from provider failures

**Cache Test Example:**
File: `tests/services/imageCache.test.mjs` (281 lines)
- Tests localStorage persistence
- LRU eviction logic
- Cache hit/miss detection
- Size quota enforcement
- Mock storage implementation

## Current Test Coverage

**Well-Tested Areas:**
- `src/services/canonical-knowledge.service.ts` — 8 tests covering ingestion logic, review map building, candidate context packing
- `src/services/` (image cache, suggestion scoring) — 500+ lines of test code
- `src/providers/` (Gemini, NanoBanana) — integration tests with real API calls

**Minimally Tested:**
- React hooks (`src/state/`) — integration with services tested; hook state mutations difficult in Node
- Components — FeedPostImage tested; most UI components untested in Node (require browser)
- Screens — SettingsScreen API key flow tested; navigation and state flows minimally tested

**Untested Areas:**
- Voice recording/transcription integration (`src/lib/voice-recorder.ts`)
- Native Capacitor APIs (requires Android/iOS environment)
- E2E user flows (no Playwright/Cypress configured)

## Test Statistics

- Total test files: 9 (.mjs) + related fixtures
- Total test code: ~2,750 lines of .mjs test files
- Test commands: `npm test` (runs all .mjs tests)
- No coverage reporting tool configured

---

*Testing analysis: 2026-03-31*
