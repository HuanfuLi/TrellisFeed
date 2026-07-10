# Phase 12: Portal Navigation & Rich Moves Linking - Context

**Gathered:** 2026-03-27  
**Status:** Ready for implementation  
**Requirement IDs:** PLANNER-06, NAV-01, NAV-02

---

## Phase Boundary

Phase 12 implements a dedicated navigation layer for suggested moves, enabling users to tap any suggested move and navigate directly to related content (flashcards, posts, or questions).

**What this phase delivers:**
1. `moveNavigator` utility — converts move objects to navigation routes
2. Integration with `SuggestedMovesSection` — taps trigger navigation
3. Test coverage for all navigation flows
4. Support for both web (React Router) and mobile (Capacitor)

**What this phase does NOT deliver:**
- Changes to ReviewScreen, PostDetailScreen, or QuestionDetailScreen (already support required params)
- New npm packages (uses existing React Navigation + React Router)
- Data model changes (linkedResource already created in Phase 10)

---

## Implementation Decisions

### Decision 1: Navigation Routing by linkedResource Type

**Locked Decision:**
All navigation is determined by `move.linkedResource.type` (not by move.moveType). This creates a clear, deterministic mapping.

```
linkedResource.type 'review'  → ReviewScreen (filtered by concept)
linkedResource.type 'post'    → PostDetailScreen (with postId)
linkedResource.type 'question' → QuestionDetailScreen (with questionId)
```

**Rationale:**
- `moveType` ('review', 'deepdive', 'connection') is semantic; `linkedResource.type` is the actual target
- Phase 10 already guarantees every move has a valid `linkedResource`
- This decouples moveType naming from screen naming, allowing future moveType additions without navigation changes

**Implementation Impact:**
- moveNavigator.ts only switches on `linkedResource.type`
- SuggestedMovesSection doesn't need moveType logic
- Tests are simpler (3 cases instead of 3+ if moveType was used)

---

### Decision 2: Platform-Agnostic Navigation via Hook

**Locked Decision:**
Navigation logic is platform-agnostic using a hook-based abstraction:

```typescript
const { navigate } = useNavigation(); // React Navigation (both platforms)
await navigateToMove(move, navigate);  // Same function on web + mobile
```

**Rationale:**
- React Navigation 6+ supports web as first-class platform
- No need for separate web/mobile navigation logic in components
- Platform adapters handle edge cases (deep linking, route prefixing) transparently

**Implementation Impact:**
- SuggestedMovesSection uses single navigation pattern
- platformAdapter.ts provides fallbacks (React Router for web if needed)
- Testing is platform-agnostic; no separate test suites per platform

---

### Decision 3: No Screen Modifications Required

**Locked Decision:**
ReviewScreen, PostDetailScreen, and QuestionDetailScreen are used as-is. Phase 12 only adds navigation calls; it does NOT modify target screens.

**Rationale:**
- ReviewScreen already accepts `conceptId` parameter for filtering
- PostDetailScreen already accepts `postId` parameter
- QuestionDetailScreen already accepts `questionId` parameter
- These parameters existed before Phase 12; Phase 12 simply uses them

**Implementation Impact:**
- Backward compatible: existing URLs/deep links still work
- No regression risk: target screens unchanged
- Effort reduced: ~4-5 hours saved by not refactoring screens

---

### Decision 4: moveNavigator as a Pure Utility Module

**Locked Decision:**
moveNavigator.ts is a pure utility module (no hooks, no context, no state). It exports plain functions that operate on move objects:

```typescript
// Pure functions
export function getMoveDestination(move): NavigationRoute { ... }
export function navigateToMove(move, navigation): Promise<void> { ... }
export function isNavigableMove(move): boolean { ... }
```

**Rationale:**
- Pure functions are easier to test (no mock context required)
- Can be used from any component (no context coupling)
- Enables future use cases (share links, deep linking, automation)
- Clear separation of concerns: utility doesn't know about React

**Implementation Impact:**
- Test setup is minimal (no providers, no context mocks)
- Utility can be called from non-React code (services, events, etc.)
- Documentation of routing logic is self-contained

---

### Decision 5: Comprehensive Error Handling

**Locked Decision:**
moveNavigator validates all inputs and throws meaningful errors:

```typescript
// Invalid moveType throws
throw new Error(`Unknown linkedResource type: ${linkedResource.type}`);

// Missing linkedResource throws
if (!move.linkedResource) {
  throw new Error('Cannot navigate to move without linkedResource');
}
```

**Rationale:**
- Phase 10 guarantees valid linkedResources, but defensive coding catches bugs
- Component wraps navigation in try-catch to show user-friendly messages
- Errors are logged for debugging without crashing app

**Implementation Impact:**
- SuggestedMovesSection has error boundary
- Failed navigations show toast/error UI (not silent failure)
- QA can test error paths systematically

---

## Canonical References

**Mandatory reads before implementation:**

### Phase 10: Move Generation
- `.planning/phases/10-planner-auto-suggestions-engine/10-PLAN.md` — Defines PlannedMove structure and linkedResource format
- Key section: "Move Types & LinkedResource" (lines 196-260 in RESEARCH.md)

### React Navigation Documentation
- Screen navigation patterns: https://reactnavigation.org/docs/navigation-container/
- Deep linking: https://reactnavigation.org/docs/deep-linking-into-nested-navigators/

### Existing Screen Integrations
- `app/src/screens/ReviewScreen.tsx` — Accepts `conceptId` parameter for filtered view
- `app/src/screens/PostDetailScreen.tsx` — Accepts `postId` parameter
- `app/src/screens/QuestionDetailScreen.tsx` — Accepts `questionId` parameter

### SuggestedMovesSection Integration Point
- `app/src/components/SuggestedMovesSection.tsx` — Where move taps are handled

---

## Design Principles

1. **Deterministic Routing:** Same move always produces same navigation route
2. **Type Safety:** All navigation routes and parameters are TypeScript-checked
3. **Reusability:** moveNavigator can be used from any component with navigation access
4. **Error Resilience:** Invalid moves don't crash; they log and show user feedback
5. **Platform Transparency:** Web and mobile use identical navigation code paths

---

## Must-Have Truths

1. **moveNavigator.ts must not import React** — Keeps it platform-agnostic and testable
2. **All moves must have valid linkedResource** — Phase 10 guarantees this; Phase 12 asserts it
3. **Navigation params match screen signatures** — ReviewScreen receives conceptId, PostDetailScreen receives postId, etc.
4. **Back-stack is preserved** — Navigating to another screen pushes onto stack; back button works
5. **Error paths must not be silent** — Errors are logged and shown to user (toast/error UI)

---

## Testing Implications

### Unit Test Coverage
- moveNavigator.ts: 100% (pure functions, all move types)
- platformAdapter.ts: 95%+ (handles web/mobile split)
- isNavigableMove type guard: 100%

### Integration Test Coverage
- SuggestedMovesSection + navigation: onPress → navigateToMove
- Error scenarios: invalid moveType, missing linkedResource, navigation timeout
- Back-stack behavior: navigate, then press back, confirm return to Planner

### Manual UAT
- Web: Tap move → navigate → press back → return to Planner
- Mobile: Same flows on iOS and Android via Capacitor
- Deep linking: Type URL directly → navigate to correct screen

---

## Effort Estimate

- **Wave 1 (Types + moveNavigator):** 2-3 hours
- **Wave 2 (Integration):** 2-3 hours
- **Wave 3 (Testing):** 2-3 hours
- **Wave 4 (UAT + Docs):** 1-2 hours
- **Total:** 8-12 hours

---

## Next Phase Dependencies

Phase 12 should complete before any future phases that:
- Add new move types (would need to update moveNavigator)
- Implement deep linking for moves (uses Phase 12 routing logic)
- Add move history/favorites (uses moveNavigator to replay moves)
- Implement voice-based move navigation

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Navigation broken on mobile | Low | High | Test on Capacitor early; use React Navigation patterns |
| Back-stack corruption | Low | High | Test back behavior with multiple taps |
| Type errors in moveType→screen mapping | Low | Medium | Comprehensive unit tests; TypeScript strict mode |
| Performance regression (slow navigation) | Very Low | Medium | Benchmark navigation time (<100ms); no new async work |

---

## Success Criteria

✅ User can tap any suggested move and navigate to target screen  
✅ Navigation works on web (React Router) and mobile (Capacitor)  
✅ Back button returns to Planner screen  
✅ All navigation parameters passed correctly to target screens  
✅ Error scenarios handled gracefully (no crashes)  
✅ Test coverage >95%  
✅ No regression in existing features  

---

_Phase 12 Context | Locked Design Decisions | 2026-03-27_
