# Coding Conventions

**Analysis Date:** 2026-03-31

## Naming Patterns

**Files:**
- Components: PascalCase, one per file (e.g., `ChatInput.tsx`, `HomeScreen.tsx`)
- Services: camelCase with `.service.ts` suffix (e.g., `flashcard.service.ts`, `review.service.ts`)
- Mock services: camelCase with `.mock.ts` suffix (e.g., `settings.mock.ts`, `question.mock.ts`)
- Utilities/helpers: camelCase (e.g., `event-bus.ts`, `date.ts`, `toast.ts`)
- Types: consolidated in `src/types/index.ts`, `carousel.ts`, `planner.ts`
- Hooks: camelCase with `use` prefix in `src/state/` (e.g., `useQuestions.ts`, `useReview.ts`)
- Test files: same name as source with `.test.mjs` suffix (e.g., `canonical-knowledge.test.mjs`)

**Functions & Methods:**
- camelCase: `chatCompletion()`, `startVoiceRecording()`, `submitReview()`
- Exported objects: `const serviceName = { method1, method2 }` pattern (e.g., `reviewService`, `eventBus`)
- Prefix helpers with domain or verb: `buildCandidateContextPack()`, `calcNextInterval()`, `classifyAndAnchor()`
- Internal helpers: prefixed with underscore when private (e.g., `_updateIndex()`, `_enforceMaxSize()`)

**Variables:**
- State variables: camelCase (e.g., `isLoading`, `reviewCount`, `pullDistance`)
- Refs: camelCase with "Ref" suffix (e.g., `containerRef`, `questionsRef`, `recordingActiveRef`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `COMPLETION_TIMEOUT_MS`, `SM2_INTERVALS`, `STORAGE_KEY`)
- Event listeners: on[Action] pattern (e.g., `onSend`, `onToken`, `onLoadMore`)
- Boolean variables: prefix with `is`, `has`, `can`, `should` (e.g., `isAsking`, `isRecording`, `isTranscribing`, `canSend`)

**Types & Interfaces:**
- Exported interfaces: PascalCase (e.g., `Question`, `FlashCard`, `ChatSession`, `ReviewSchedule`)
- Type aliases: PascalCase (e.g., `ChunkType`, `PodcastStatus`, `ImageProviderPrimary`)
- Union types: specific names reflecting domain (e.g., `PlannedMoveType`, `ErrorCode`, `PostNarrativeMode`)
- Props interfaces: [ComponentName]Props pattern (e.g., `ChatInputProps`, `CarouselState`)
- Service return type: `ServiceResult<T>` with shape `{ success: boolean; data?: T; error?: ServiceError }`

## Code Style

**Formatting:**
- TypeScript strict mode enabled (`tsconfig.app.json`)
- Target: ES2022
- JSX: React 19 with `react-jsx` transform
- No Prettier configured — relies on ESLint rules for basic consistency
- Line length: implicit, follows readability (most lines 80-120 chars)

**Linting:**
- ESLint config: `eslint.config.js` (flat config)
- Rule: `react-hooks/set-state-in-effect` is OFF (disabled for async data loading patterns)
- Rule: `@typescript-eslint/no-unused-vars` with pattern `^_` to allow `_unused` variables
- Enforced: strict type checking, no unused locals/params (caught by TypeScript)
- Enforced: no fallthrough switch cases (`noFallthroughCasesInSwitch`)

## Import Organization

**Order:**
1. Node standard library (`node:assert`, `node:test`)
2. Third-party packages (React, React Router, UI libraries, vendors)
3. Type imports (from types/)
4. Internal services (`../services/`)
5. Internal providers (`../providers/`)
6. Internal state (`../state/`)
7. Internal components and UI (`../components/`)
8. Internal utilities and libraries (`../lib/`)

**Path Aliases:**
- No custom path aliases configured; all imports use relative paths
- Consistent pattern: `../types`, `../services`, `../providers`, etc.

**Type Imports:**
- Explicit: `import type { Question, ServiceResult } from '../types'`
- Prevents circular dependencies and enables tree-shaking

## Error Handling

**Patterns:**
- All services return `ServiceResult<T>` with discriminated union: `{ success: true; data: T } | { success: false; error: ServiceError }`
- Never throw errors in services; return error in result object
- Components check `result.success` before accessing `result.data`
- Error code is from enum `ErrorCode` (defined in `src/types/index.ts`)
- Retryable flag indicates whether operation can be safely retried

**Example:**
```typescript
async submitReview(cardId: string, rating: 1 | 2 | 3 | 4 | 5): Promise<ServiceResult<ReviewSchedule>> {
  const card = all.find((c) => c.id === cardId);
  if (!card) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'FlashCard not found', retryable: false } };
  }
  // ... compute new schedule
  return { success: true, data: newSchedule };
}
```

## Logging

**Framework:** console (no structured logging library)

**Patterns:**
- Prefix logs with module context in square brackets: `console.error('[VoiceAsk] start failed:', err)`
- Used for debugging only; not for end-user messaging
- Error/warning context captured during async operations (e.g., voice recording, transcription)
- Keep logs concise; include error class name or code if available

**Example:**
```typescript
catch (err) {
  console.error('[ChatInput] transcription error:', err);
  const msg = err instanceof Error ? err.message : String(err);
  toast(msg.includes('API key') ? 'Add your API key...' : `Transcription failed: ${msg}`, 'error');
}
```

## Comments

**When to Comment:**
- Rarely used; code is self-documenting through naming and structure
- Used for non-obvious algorithms (e.g., SM-2 scheduling in `review.service.ts`)
- Used to explain why, not what (rationale behind design)
- Used for business logic context (e.g., "Pinned cards always come back tomorrow")

**JSDoc/TSDoc:**
- Minimal usage; types already express intent
- When used: describe function purpose and non-obvious params
- Example from `canonical-knowledge.service.ts`:
  ```typescript
  /**
   * Aggregated learning trajectory signals used to score and rank auto-generated
   * Planner suggestions.
   */
  export interface TrajectorySignal { ... }
  ```

**Section Dividers:**
- Used to mark major domain boundaries in types files
- Pattern: `// ═══════════════════════════════════════════════════════════════════════════`
- Sections: QUESTION & KNOWLEDGE DOMAIN, PLANNER DOMAIN, PODCAST DOMAIN, etc. in `src/types/index.ts`

## Function Design

**Size:**
- Most functions 5-40 lines (avg ~20)
- Larger functions (100+ lines) are screens or complex services (e.g., `HomeScreen.tsx`, `concept-feed.service.ts`)
- Break complex logic into smaller helpers with descriptive names

**Parameters:**
- 2-3 parameters typical; excess params refactored to object destructuring
- Destructure props interface in component declarations: `function ChatInput({ onSend, placeholder, disabled }: ChatInputProps)`
- Required params before optional in signature

**Return Values:**
- Functions return early on error conditions (guard pattern)
- Async functions return Promise<ServiceResult<T>> or Promise<T | null>
- Components return JSX.Element or null
- Helper functions return computed values or void

**Async/Void Pattern:**
```typescript
const toggleMic = () => {
  if (isRecording) void stopRecording();  // Explicitly ignored promise
  else void startRecording();
};
```

## Module Design

**Exports:**
- Services: single exported object with methods (e.g., `export const reviewService = { ... }`)
- Custom hooks: single PascalCase export (e.g., `export function useQuestions(): UseQuestionsReturn`)
- Components: single default/named export (e.g., `export function ChatInput({ ... })`)
- Types: export all interfaces/types from `src/types/index.ts` with domain sections

**Barrel Files:**
- Not used; direct imports from source files encouraged

**Factory Pattern:**
- Used for generators and makers (e.g., `makeQuestion()`, `makeSeedCards()`, `newId()`)
- Typically co-located with service that uses them

## Styling Convention

**CSS Variables (Tailwind 4):**
- Inline styles with CSS variables preferred over className strings for complex layouts
- Key variables: `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-1/2/3`
- Node colors: `--node-mint`, `--node-salmon`, `--node-lilac`, `--node-peach`, `--node-sky`
- Safe area: `--safe-area-bottom`, `--safe-area-top` for mobile viewport adjustment

**Example:**
```typescript
<form
  style={{
    position: 'fixed',
    bottom: 'calc(80px + var(--safe-area-bottom))',
    left: 0,
    right: 0,
    padding: '0 16px 16px'
  }}
>
```

## Patterns & Idioms

**Event Bus Pattern:**
- Singleton at `src/lib/event-bus.ts`
- Type-safe event subscription: `eventBus.subscribe('QUESTION_ASKED', handler)`
- Used for cross-hook communication (multiple instances of same hook need to sync)
- Always unsubscribe in useEffect cleanup: `return unsub;`

**Settings Singleton:**
- `mockSettingsService.getSync()` returns current AppSettings
- Settings persisted to localStorage
- No setter mutations; read-only in most contexts

**Promise Chain Pattern:**
- void keyword used to explicitly ignore promise: `void stopRecording()`
- Event subscription cleanup returned from useEffect: `return eventBus.subscribe(...)`

**Service Layer Pattern:**
- All services (flashcard, question, review, etc.) return `ServiceResult<T>`
- localStorage used for persistence (no database layer currently)
- Services are stateless; state lives in React hooks

---

*Convention analysis: 2026-03-31*
