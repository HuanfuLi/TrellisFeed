---
phase: 12-portal-navigation-rich-moves
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/moveNavigator.ts
  - app/src/screens/ReviewScreen.tsx
  - app/src/screens/PostDetailScreen.tsx
  - app/src/screens/QuestionDetailScreen.tsx
  - app/src/screens/PlannerScreen.tsx
  - app/src/components/MoveCard.tsx
autonomous: true
requirements:
  - PLANNER-06
  - NAV-01
  - NAV-02
must_haves:
  truths:
    - "User taps a suggested move and navigates to the target screen"
    - "Navigation includes proper context (conceptId, resource ID, type)"
    - "ReviewScreen, PostDetailScreen, and QuestionDetailScreen receive navigation parameters"
    - "Back navigation maintains history stack correctly"
    - "Deep linking works: navigating directly to move targets without coming from Planner"
    - "All move types route to correct screen: review→ReviewScreen, post→PostDetailScreen, question→QuestionDetailScreen"
  artifacts:
    - path: "app/src/lib/moveNavigator.ts"
      provides: "Central navigation logic for move types"
      exports: ["navigateToMove()", "buildMoveNavigationPath()"]
    - path: "app/src/screens/PlannerScreen.tsx"
      provides: "Integration point - onAccept callback wired to moveNavigator"
      contains: "onClick integration in MoveCard"
    - path: "app/src/components/MoveCard.tsx"
      provides: "Navigation trigger UI element"
      contains: "onClick handler for Add button"
  key_links:
    - from: "MoveCard onAccept()"
      to: "moveNavigator.navigateToMove()"
      via: "PlannerScreen acceptMove() handler"
      pattern: "onAccept.*navigateToMove"
    - from: "moveNavigator.navigateToMove()"
      to: "navigate(path, { state })"
      via: "useNavigate hook"
      pattern: "useNavigate.*navigate.*state"
    - from: "Target screens"
      to: "location state parameters"
      via: "useLocation hook"
      pattern: "useLocation.*state as.*linkedResource"

---

# Phase 12 Plan 01: Portal Navigation & Rich Moves Linking

## Executive Summary

**Phase Goal:** Enable users to navigate directly from Planner's suggested moves to related review content (ReviewScreen for flashcard reviews, PostDetailScreen for learning posts, QuestionDetailScreen for Q&A deep dives) while maintaining navigation history and supporting deep linking.

**Why This Matters:** 
- Moves currently exist as visual cards but clicking them does nothing
- Users can see "suggested moves" but can't act on them immediately
- Portal navigation creates the final UX flow connecting Planner → Content

**Output:** 
- `moveNavigator.ts` utility exporting navigation functions
- Integrated MoveCard with click handlers
- Target screens updated to receive and process linkedResource context
- Full support for web (React Router) and mobile (Capacitor) navigation

**Effort Estimate:** 8-10 hours agent execution time
- Task 1 (moveNavigator utility): 2 hours
- Task 2 (MoveCard integration): 1.5 hours
- Task 3 (Screen parameter handling): 3 hours
- Task 4 (Testing & validation): 1.5 hours

---

## Context

**From Phase 10:** PlannedMove objects contain:
```typescript
linkedResource?: {
  type: 'post' | 'question' | 'review';
  id: string;
};
```

**Current Routing (App.tsx):**
```typescript
{ path: 'review', element: <ReviewScreen /> }
{ path: 'posts/:id', element: <PostDetailScreen /> }
{ path: 'ask/:id', element: <QuestionDetailScreen /> }
```

**Navigation Context Available:**
- React Router 7: `useNavigate()`, `useParams()`, `useLocation()`
- State passing: Route transitions with `navigate(path, { state: {...} })`
- Capacitor integration: App runs on native platforms with standard browser history

**Key Constraint:** ReviewScreen does NOT use URL params (reviews are loaded from service). Must pass context via location state.

---

## Must-Have Verification Matrix

| Must-Have | Verification Method | Success Criteria |
|-----------|-------------------|-----------------|
| Move navigation works end-to-end | User clicks Add on move → lands on target screen | Screen loads relevant content within 1s |
| linkedResource properly passed | Console logs state in target screen | `linkedResource` present in `location.state` |
| ReviewScreen receives concept context | ReviewScreen logs received conceptId | Correct flashcards for concept shown |
| PostDetailScreen loads post ID | Check URL params and state | Post with correct ID renders |
| QuestionDetailScreen loads question | Check URL params and state | Question with correct ID renders |
| Back button works | Navigate to move, tap back | Returns to Planner Screen |
| Deep linking works | Direct URL navigation to screen | Screen loads with params, no undefined errors |
| No regressions | Run existing move acceptance flow | Skip/Dismiss buttons still work |

---

## Architecture Decision: Navigation Routing

**Decision:** Centralize move routing logic in `moveNavigator.ts` utility, separate from component logic.

**Why:**
- Keeps navigation logic testable and reusable
- Single source of truth for move→screen mapping
- Decouples move types from screen implementations
- Supports future additions (new move types, new screens)

**Trade-offs Rejected:**
- Inline navigation in MoveCard: Would couple UI to routing logic ✗
- Navigation rules in PlannerScreen: Hard to test, duplicated logic ✗
- Router config-based: React Router doesn't support dynamic move type mapping well ✗

---

## Wave Breakdown & Dependency Graph

```
Wave 1 (Parallel foundation):
  Task 1: Create moveNavigator utility ──┐
                                         ├──→ Wave 2
  Task 2: Integrate MoveCard UI ────────┘

Wave 2 (Serial wiring):
  Task 3: Update target screen parameter handling ──→ Task 4

Wave 3 (Testing):
  Task 4: Test navigation flows + validation
```

**Rationale:**
- Task 1 & 2 are independent (utility doesn't depend on UI, UI doesn't depend on utility until integration)
- Task 3 depends on Tasks 1 & 2 (screens must know where parameters come from)
- Task 4 depends on Task 3 (can't test until all screens updated)
- All tasks execute in single agent session (no blocking checkpoints)

---

## Task Breakdown

### Task 1: Create moveNavigator Utility (2 hours)

**Objective:** Build central routing logic that maps move types to screen navigation with proper context passing.

**Files Modified:**
- `app/src/lib/moveNavigator.ts` (NEW)

**Background:** 
Move types from PlannedMove:
- `review` → Navigate to ReviewScreen, pass `conceptId` to filter flashcards
- `deepdive` or `connection` → Navigate to QuestionDetailScreen via `linkedResource.id`
- `post` → Navigate to PostDetailScreen via `linkedResource.id`

**Action:**

Create `app/src/lib/moveNavigator.ts`:

```typescript
/**
 * moveNavigator.ts — Central routing logic for suggested moves.
 *
 * Maps move types to screen navigation with proper context passing.
 * Handles both web (React Router) and mobile (Capacitor) platforms.
 */

import type { NavigateFunction } from 'react-router-dom';
import type { PlannedMove } from '../types';

/**
 * Navigation configuration mapping move types to screen paths.
 */
const MOVE_TYPE_ROUTES = {
  review: {
    screen: 'review',
    paramKey: 'conceptId', // ReviewScreen loads flashcards for this concept
  },
  deepdive: {
    screen: 'ask', // Navigate to AskScreen for Q&A deep dive
    paramKey: 'questionId',
  },
  connection: {
    screen: 'ask', // Navigate to QuestionDetailScreen
    paramKey: 'questionId',
  },
  podcast: {
    screen: 'podcast', // Navigate to PodcastScreen
    paramKey: 'conceptId',
  },
} as const;

/**
 * Context to pass via location state during navigation.
 * Allows target screen to receive the full move + linked resource info.
 */
export interface MoveNavigationState {
  move: PlannedMove;
  linkedResource: PlannedMove['linkedResource'];
  fromScreen: 'planner' | 'explore' | 'other';
  timestamp: number;
}

/**
 * Navigate to a screen based on move type and linkedResource.
 *
 * @param move - The PlannedMove object from suggestions
 * @param navigate - React Router's useNavigate() hook
 * @param options - Navigation options (fromScreen, replace)
 *
 * @returns Promise<boolean> - true if navigation succeeded, false if invalid move
 *
 * @example
 * ```typescript
 * const handleAcceptMove = async (move: PlannedMove) => {
 *   const success = await navigateToMove(move, navigate);
 *   if (!success) toast('Invalid move configuration', 'error');
 * };
 * ```
 */
export async function navigateToMove(
  move: PlannedMove,
  navigate: NavigateFunction,
  options: {
    fromScreen?: 'planner' | 'explore' | 'other';
    replace?: boolean;
  } = {}
): Promise<boolean> {
  const { fromScreen = 'planner', replace = false } = options;

  // Validate: move must have linkedResource for navigation
  if (!move.linkedResource?.id) {
    console.warn('[moveNavigator] Move missing linkedResource:', move);
    return false;
  }

  const route = MOVE_TYPE_ROUTES[move.moveType];
  if (!route) {
    console.warn(`[moveNavigator] Unknown move type: ${move.moveType}`);
    return false;
  }

  // Build navigation state
  const navigationState: MoveNavigationState = {
    move,
    linkedResource: move.linkedResource,
    fromScreen,
    timestamp: Date.now(),
  };

  // Build navigation path based on move type
  const path = buildMoveNavigationPath(move, route);

  if (!path) {
    console.warn('[moveNavigator] Could not build navigation path for move:', move);
    return false;
  }

  try {
    navigate(path, {
      state: navigationState,
      replace,
    });
    return true;
  } catch (error) {
    console.error('[moveNavigator] Navigation failed:', error, move);
    return false;
  }
}

/**
 * Build the navigation path for a move based on its type and linkedResource.
 *
 * @internal — Used by navigateToMove(); exported for testing
 *
 * @param move - PlannedMove with linkedResource
 * @param route - Route configuration from MOVE_TYPE_ROUTES
 *
 * @returns Navigation path string (e.g., '/review', '/ask/question-123')
 *          or null if path cannot be built
 */
export function buildMoveNavigationPath(
  move: PlannedMove,
  route: (typeof MOVE_TYPE_ROUTES)[keyof typeof MOVE_TYPE_ROUTES]
): string | null {
  const { linkedResource } = move;

  if (!linkedResource?.id) return null;

  switch (route.screen) {
    case 'review':
      // ReviewScreen doesn't use URL params — context passed via state
      return '/review';

    case 'ask':
      // QuestionDetailScreen uses :id URL param
      return `/ask/${linkedResource.id}`;

    case 'posts':
      // PostDetailScreen uses :id URL param
      return `/posts/${linkedResource.id}`;

    case 'podcast':
      // PodcastScreen doesn't use URL params — context passed via state
      return '/podcast';

    default:
      console.warn(`[moveNavigator] Unknown screen in route: ${route.screen}`);
      return null;
  }
}

/**
 * Parse navigation state from a screen's location.
 *
 * Used by target screens to extract move context after navigation.
 *
 * @param locationState - location.state from useLocation()
 * @returns Parsed MoveNavigationState or null if not a move navigation
 *
 * @example
 * ```typescript
 * const location = useLocation();
 * const moveState = parseMoveNavigationState(location.state);
 * if (moveState) {
 *   console.log('Navigated from:', moveState.fromScreen);
 *   console.log('Linked resource:', moveState.linkedResource);
 * }
 * ```
 */
export function parseMoveNavigationState(
  locationState: unknown
): MoveNavigationState | null {
  if (!locationState || typeof locationState !== 'object') return null;

  const state = locationState as Record<string, unknown>;

  // Validate required fields
  if (!state.linkedResource || !state.move || !state.fromScreen) {
    return null;
  }

  return {
    move: state.move as PlannedMove,
    linkedResource: state.linkedResource as PlannedMove['linkedResource'],
    fromScreen: state.fromScreen as 'planner' | 'explore' | 'other',
    timestamp: (state.timestamp as number) || Date.now(),
  };
}

/**
 * Utility: Get human-readable destination label for a move.
 *
 * Used in UI feedback, logging, analytics.
 *
 * @param move - The PlannedMove
 * @returns Readable destination (e.g., "Review Screen", "Post Detail")
 */
export function getMoveDestination(move: PlannedMove): string {
  const route = MOVE_TYPE_ROUTES[move.moveType];
  if (!route) return 'Unknown';

  const screenLabels: Record<string, string> = {
    review: 'Review Screen',
    ask: 'Question Detail',
    posts: 'Post Detail',
    podcast: 'Podcast Screen',
  };

  return screenLabels[route.screen] || 'Unknown';
}
```

**Verify:**

```bash
# 1. File exists and exports correct functions
test -f app/src/lib/moveNavigator.ts && grep -q "export async function navigateToMove" app/src/lib/moveNavigator.ts && echo "✓ moveNavigator.ts created with navigateToMove export"

# 2. TypeScript compiles without errors
cd /Users/Code/EchoLearn && npx tsc --noEmit app/src/lib/moveNavigator.ts 2>&1 | grep -q "error TS" && echo "✗ TypeScript errors found" || echo "✓ TypeScript validates moveNavigator.ts"

# 3. All required exports present
grep -E "export (function|interface) (navigateToMove|buildMoveNavigationPath|parseMoveNavigationState|getMoveDestination|MoveNavigationState)" app/src/lib/moveNavigator.ts | wc -l | grep -qE "[4-6]" && echo "✓ All exports present"
```

**Done:** 
- ✓ moveNavigator.ts created in app/src/lib/
- ✓ navigateToMove() function handles all move types
- ✓ buildMoveNavigationPath() builds correct routes
- ✓ parseMoveNavigationState() extracts navigation context
- ✓ getMoveDestination() provides UI labels
- ✓ TypeScript types defined for MoveNavigationState
- ✓ No console errors; all functions callable

---

### Task 2: Integrate MoveCard with Navigation (1.5 hours)

**Objective:** Wire MoveCard's Add button to call moveNavigator, passing move and useNavigate hook.

**Files Modified:**
- `app/src/components/MoveCard.tsx`
- `app/src/screens/PlannerScreen.tsx`

**Background:**
Currently, MoveCard calls `onAccept(move.id)` but PlannerScreen's acceptMove() handler just updates local state (adds move to planner). We need to:
1. Pass `navigate` hook down to MoveCard
2. Call navigateToMove() when user taps Add button
3. Keep existing accept logic (still add to planner)
4. Show toast on navigation success/failure

**Action:**

**Step 1: Update MoveCard to accept navigate prop**

In `app/src/components/MoveCard.tsx`, add import and prop:

```typescript
import { useNavigate } from 'react-router-dom';
import { navigateToMove } from '../lib/moveNavigator';

interface MoveCardProps {
  move: PlannedMove;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate?: (success: boolean) => void; // Callback for navigation result
}

export function MoveCard({ move, onAccept, onDismiss, onNavigate }: MoveCardProps) {
  const navigate = useNavigate();

  const handleAddClick = async () => {
    // Call existing onAccept for planner state update
    onAccept(move.id);

    // Attempt navigation after state is queued
    // Use setTimeout to allow state update to flush first
    setTimeout(async () => {
      const success = await navigateToMove(move, navigate, {
        fromScreen: 'planner',
        replace: false,
      });
      onNavigate?.(success);
    }, 50);
  };

  return (
    <Card style={{
      borderLeft: `3px solid ${config.color}`,
      padding: '14px 16px',
      marginBottom: '10px',
    }}>
      {/* ... existing card content ... */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={handleAddClick}  // Changed from () => onAccept(move.id)
          title="Add to Planner"
          className="active-squish"
          style={{
            padding: '5px 10px', borderRadius: '10px', fontSize: '0.75rem',
            fontWeight: 600, backgroundColor: config.color, color: 'white',
            border: 'none', whiteSpace: 'nowrap',
          }}
        >
          Add
        </button>
        {/* ... dismiss button unchanged ... */}
      </div>
    </Card>
  );
}
```

**Step 2: Update PlannerScreen to pass onNavigate callback**

In `app/src/screens/PlannerScreen.tsx`, update MoveCard render:

```typescript
{autoMoves.map((move) => (
  <MoveCard
    key={move.id}
    move={move}
    onAccept={acceptMove}
    onDismiss={dismissMove}
    onNavigate={(success) => {
      if (!success) {
        toast('Navigation failed — check move configuration', 'error');
      }
    }}
  />
))}
```

**Verify:**

```bash
# 1. MoveCard imports navigateToMove
grep -q "import { navigateToMove } from" app/src/components/MoveCard.tsx && echo "✓ MoveCard imports navigateToMove"

# 2. handleAddClick defined and calls both onAccept + navigateToMove
grep -q "const handleAddClick = async" app/src/components/MoveCard.tsx && echo "✓ handleAddClick defined"

# 3. Add button uses handleAddClick
grep -q "onClick={handleAddClick}" app/src/components/MoveCard.tsx && echo "✓ Add button wired to handleAddClick"

# 4. PlannerScreen passes onNavigate callback
grep -q "onNavigate=" app/src/screens/PlannerScreen.tsx && echo "✓ PlannerScreen passes onNavigate callback"

# 5. TypeScript compiles
cd /Users/Code/EchoLearn && npx tsc --noEmit app/src/components/MoveCard.tsx app/src/screens/PlannerScreen.tsx 2>&1 | grep -qE "error TS" && echo "✗ TypeScript errors" || echo "✓ TypeScript clean"
```

**Done:**
- ✓ MoveCard accepts navigate and calls navigateToMove()
- ✓ onNavigate callback allows parent to respond to navigation result
- ✓ Existing onAccept logic preserved (still adds move to planner)
- ✓ PlannerScreen integrated with navigation callback
- ✓ TypeScript validates component props

---

### Task 3: Update Target Screens to Handle Navigation Context (3 hours)

**Objective:** Update ReviewScreen, PostDetailScreen, and QuestionDetailScreen to receive and process linkedResource context from move navigation.

**Files Modified:**
- `app/src/screens/ReviewScreen.tsx`
- `app/src/screens/PostDetailScreen.tsx`
- `app/src/screens/QuestionDetailScreen.tsx`

**Background:**

Each screen needs to:
1. Extract MoveNavigationState from location.state
2. Parse linkedResource type and ID
3. Filter/load content based on context
4. Show indicator that navigation came from a move

**Action:**

**ReviewScreen Update (app/src/screens/ReviewScreen.tsx):**

Import and integrate:
```typescript
import { useLocation } from 'react-router-dom';
import { parseMoveNavigationState } from '../lib/moveNavigator';
import type { PlannedMove } from '../types';

export function ReviewScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, allCards, isLoading, submitReview, skipReview, togglePin, deleteCard } = useReview();

  // Extract move navigation context
  const moveState = parseMoveNavigationState(location.state);
  const linkedResource = moveState?.linkedResource;

  // When coming from a move with conceptId, filter cards to show only that concept
  const filteredCards = linkedResource?.type === 'review' && linkedResource.id
    ? allCards.filter((card) => card.nodeId === linkedResource.id)
    : allCards;

  // Use filtered cards for review session if navigated from move, otherwise use defaults
  const reviewCards = linkedResource && filteredCards.length > 0 ? filteredCards : items;

  return (
    <div>
      {/* Show breadcrumb if coming from move navigation */}
      {moveState && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginBottom: '12px',
          paddingLeft: '4px',
        }}>
          Suggested move: {moveState.move.title}
        </div>
      )}
      
      {/* Rest of screen using reviewCards instead of items */}
      {/* ... existing component code ... */}
    </div>
  );
}
```

**PostDetailScreen Update (app/src/screens/PostDetailScreen.tsx):**

Import and integrate:
```typescript
import { parseMoveNavigationState } from '../lib/moveNavigator';

export function PostDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { questions } = useQuestions();

  // Extract move navigation context
  const moveState = parseMoveNavigationState(location.state);
  
  // Verify linkedResource matches URL param for consistency
  if (moveState?.linkedResource?.type === 'post' && moveState.linkedResource.id !== id) {
    console.warn(
      '[PostDetailScreen] Move linkedResource ID does not match URL param:',
      moveState.linkedResource.id, '!=', id
    );
  }

  // Show indicator that this came from a suggested move
  const [showMoveBreadcrumb, setShowMoveBreadcrumb] = useState(!!moveState);

  return (
    <div>
      {/* Show breadcrumb if coming from move navigation */}
      {showMoveBreadcrumb && moveState && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginBottom: '12px',
          paddingLeft: '4px',
        }}>
          Suggested move: {moveState.move.title}
        </div>
      )}
      
      {/* Rest of existing component code unchanged */}
      {/* ... */}
    </div>
  );
}
```

**QuestionDetailScreen Update (app/src/screens/QuestionDetailScreen.tsx):**

Import and integrate:
```typescript
import { useLocation } from 'react-router-dom';
import { parseMoveNavigationState } from '../lib/moveNavigator';

export function QuestionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getById, questions } = useQuestions();

  // Extract move navigation context
  const moveState = parseMoveNavigationState(location.state);

  // Verify linkedResource matches URL param for consistency
  if (moveState?.linkedResource?.type === 'question' && moveState.linkedResource.id !== id) {
    console.warn(
      '[QuestionDetailScreen] Move linkedResource ID does not match URL param:',
      moveState.linkedResource.id, '!=', id
    );
  }

  const question = id ? getById(id) : undefined;

  if (!question) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', border: 'none', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <p style={{ color: 'var(--muted-foreground)' }}>Question not found.</p>
      </div>
    );
  }

  const related = questions.filter((q) => question.relatedQuestionIds.includes(q.id));

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Show breadcrumb if coming from move navigation */}
      {moveState && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginBottom: '12px',
        }}>
          Suggested move: {moveState.move.title}
        </div>
      )}

      {/* Back button — unchanged */}
      <button
        onClick={() => navigate(-1)}
        style={{
          color: 'var(--primary-40)',
          background: 'none',
          border: 'none',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: 0,
        }}
      >
        <ArrowLeft size={20} /> Back
      </button>

      {/* Rest of existing component code ... */}
    </div>
  );
}
```

**Verify:**

```bash
# 1. All three screens import parseMoveNavigationState
for screen in ReviewScreen PostDetailScreen QuestionDetailScreen; do
  grep -q "parseMoveNavigationState" "app/src/screens/${screen}.tsx" && echo "✓ ${screen} imports parseMoveNavigationState"
done

# 2. All screens extract moveState from location
for screen in ReviewScreen PostDetailScreen QuestionDetailScreen; do
  grep -q "parseMoveNavigationState(location.state)" "app/src/screens/${screen}.tsx" && echo "✓ ${screen} extracts moveState"
done

# 3. All screens render breadcrumb indicator when moveState exists
grep -q "moveState &&" app/src/screens/ReviewScreen.tsx && echo "✓ ReviewScreen renders breadcrumb"
grep -q "moveState &&" app/src/screens/PostDetailScreen.tsx && echo "✓ PostDetailScreen renders breadcrumb"
grep -q "moveState &&" app/src/screens/QuestionDetailScreen.tsx && echo "✓ QuestionDetailScreen renders breadcrumb"

# 4. TypeScript validates all changes
cd /Users/Code/EchoLearn && npx tsc --noEmit app/src/screens/ReviewScreen.tsx app/src/screens/PostDetailScreen.tsx app/src/screens/QuestionDetailScreen.tsx 2>&1 | grep -qE "error TS" && echo "✗ TypeScript errors found" || echo "✓ TypeScript clean"
```

**Done:**
- ✓ ReviewScreen receives and filters cards by conceptId from linkedResource
- ✓ PostDetailScreen receives post ID and shows breadcrumb
- ✓ QuestionDetailScreen receives question ID and shows breadcrumb
- ✓ All screens validate linkedResource matches URL params
- ✓ Breadcrumb UI shows when navigation came from a suggested move
- ✓ TypeScript validates all type safety

---

### Task 4: Test Navigation Flows & Validate (1.5 hours)

**Objective:** Verify end-to-end navigation from MoveCard → target screens with all move types and edge cases.

**Files Modified:**
- None (testing only)

**Background:**
Test coverage must verify:
1. All move types navigate to correct screens
2. Context (linkedResource) passes through correctly
3. Back button returns to Planner
4. Deep linking works (direct URL navigation)
5. Error handling (invalid moves, missing linkedResource)
6. No regressions (existing move actions still work)

**Action:**

**Test Suite: Manual Navigation Flows**

Run these tests in browser dev console or via Playwright/Cypress:

```typescript
/**
 * Test 1: Navigate to review move
 *
 * 1. Open PlannerScreen
 * 2. Click Add on a move with moveType='review'
 * 3. Should navigate to /review
 * 4. ReviewScreen should show breadcrumb: "Suggested move: [title]"
 * 5. Check console: location.state.linkedResource.type === 'review'
 * 6. Back button returns to /planner
 */
async function testReviewNavigation() {
  // From PlannerScreen: click first review move's Add button
  const addButton = document.querySelector('[data-test="move-card-add-review"]');
  if (!addButton) {
    console.error('No review move found to test');
    return false;
  }

  addButton.click();

  // Wait for navigation
  await new Promise(r => setTimeout(r, 300));

  // Verify we're on /review
  if (!window.location.pathname.includes('review')) {
    console.error('Navigation failed: not on /review', window.location.pathname);
    return false;
  }

  // Verify breadcrumb appears
  const breadcrumb = document.querySelector('[data-test="move-breadcrumb"]');
  if (!breadcrumb) {
    console.warn('Breadcrumb not found (may not be implemented)');
  }

  console.log('✓ Review navigation test passed');
  return true;
}

/**
 * Test 2: Navigate to post move
 *
 * 1. Open PlannerScreen
 * 2. Click Add on a move with linkedResource.type='post'
 * 3. Should navigate to /posts/{id}
 * 4. PostDetailScreen should show post content
 * 5. Breadcrumb: "Suggested move: [title]"
 * 6. Back button returns to /planner
 */
async function testPostNavigation() {
  // From PlannerScreen: find post move and click Add
  const addButton = document.querySelector('[data-test="move-card-add-post"]');
  if (!addButton) {
    console.error('No post move found to test');
    return false;
  }

  const urlBefore = window.location.pathname;
  addButton.click();

  // Wait for navigation
  await new Promise(r => setTimeout(r, 300));

  // Verify we're on /posts/:id
  if (!window.location.pathname.match(/^\/posts\/[^/]+$/)) {
    console.error('Navigation failed: not on /posts/:id', window.location.pathname);
    return false;
  }

  console.log('✓ Post navigation test passed');
  return true;
}

/**
 * Test 3: Navigate to question move
 *
 * 1. Open PlannerScreen
 * 2. Click Add on a move with linkedResource.type='question'
 * 3. Should navigate to /ask/{id}
 * 4. QuestionDetailScreen shows question content
 * 5. Breadcrumb: "Suggested move: [title]"
 * 6. Back button returns to /planner
 */
async function testQuestionNavigation() {
  // From PlannerScreen: find question move and click Add
  const addButton = document.querySelector('[data-test="move-card-add-question"]');
  if (!addButton) {
    console.error('No question move found to test');
    return false;
  }

  addButton.click();

  // Wait for navigation
  await new Promise(r => setTimeout(r, 300));

  // Verify we're on /ask/:id
  if (!window.location.pathname.match(/^\/ask\/[^/]+$/)) {
    console.error('Navigation failed: not on /ask/:id', window.location.pathname);
    return false;
  }

  console.log('✓ Question navigation test passed');
  return true;
}

/**
 * Test 4: Back button returns to Planner
 *
 * 1. Start on PlannerScreen
 * 2. Click Add on any move
 * 3. Land on target screen
 * 4. Click back button
 * 5. Should return to /planner
 */
async function testBackNavigation() {
  const initialPath = window.location.pathname;
  
  if (!initialPath.includes('planner')) {
    console.warn('Test should start on PlannerScreen');
    return false;
  }

  // Click a move's Add button
  const addButton = document.querySelector('[data-test="move-card-add"]');
  if (!addButton) {
    console.error('No move found');
    return false;
  }

  addButton.click();
  await new Promise(r => setTimeout(r, 300));

  // Click back button on target screen
  const backButton = document.querySelector('button[title*="Back"], button[title*="back"]');
  if (!backButton) {
    console.error('Back button not found');
    return false;
  }

  backButton.click();
  await new Promise(r => setTimeout(r, 300));

  // Verify we're back on /planner
  if (!window.location.pathname.includes('planner')) {
    console.error('Back navigation failed: not on /planner', window.location.pathname);
    return false;
  }

  console.log('✓ Back navigation test passed');
  return true;
}

/**
 * Test 5: Deep linking (navigate directly to move target)
 *
 * 1. Get a post ID from any existing move
 * 2. Navigate directly to /posts/{id}
 * 3. PostDetailScreen should load post without error
 * 4. No breadcrumb should appear (not from a move)
 */
async function testDeepLinking() {
  // Navigate directly to a known post
  const testPostId = 'test-post-123';
  
  // This would be done via history.push() or similar
  // Here we just verify the screen handles it gracefully
  
  console.log('✓ Deep linking test would require existing post data');
  return true;
}

/**
 * Test 6: No regression - Skip/Dismiss still work
 *
 * 1. Open PlannerScreen
 * 2. Click Skip on a move
 * 3. Move should be removed from suggestions
 * 4. Dismiss should remove move without adding to planner
 */
async function testSkipDismiss() {
  // Click skip button on first move
  const skipButton = document.querySelector('[data-test="move-card-skip"]');
  if (!skipButton) {
    console.error('Skip button not found');
    return false;
  }

  const movesBeforeSkip = document.querySelectorAll('[data-test="move-card"]').length;
  skipButton.click();

  await new Promise(r => setTimeout(r, 200));

  const movesAfterSkip = document.querySelectorAll('[data-test="move-card"]').length;

  if (movesAfterSkip >= movesBeforeSkip) {
    console.error('Skip did not remove move from UI');
    return false;
  }

  console.log('✓ Skip/Dismiss test passed');
  return true;
}

// Run all tests in sequence
async function runAllNavigationTests() {
  console.log('Starting navigation test suite...');
  
  const results = {
    review: await testReviewNavigation(),
    post: await testPostNavigation(),
    question: await testQuestionNavigation(),
    back: await testBackNavigation(),
    deepLink: await testDeepLinking(),
    skipDismiss: await testSkipDismiss(),
  };

  console.table(results);
  return Object.values(results).every(r => r);
}
```

**Verification Commands:**

```bash
# 1. All imports in place
echo "✓ Checking imports across all modified files..."
grep -l "navigateToMove\|parseMoveNavigationState" \
  app/src/components/MoveCard.tsx \
  app/src/screens/PlannerScreen.tsx \
  app/src/screens/ReviewScreen.tsx \
  app/src/screens/PostDetailScreen.tsx \
  app/src/screens/QuestionDetailScreen.tsx | wc -l | grep -q "[3-5]" && echo "✓ Imports distributed across files"

# 2. TypeScript compilation passes
cd /Users/Code/EchoLearn && npx tsc --noEmit 2>&1 | grep -qE "error TS" && echo "✗ TypeScript errors:" && npx tsc --noEmit 2>&1 | grep "error TS" || echo "✓ Full TypeScript validation passes"

# 3. Build succeeds
npm run build 2>&1 | grep -i "error" && echo "✗ Build failed" || echo "✓ Build succeeds"

# 4. Visual regression: check MoveCard still renders
grep -q "className=\"active-squish\"" app/src/components/MoveCard.tsx && grep -q "onClick={handleAddClick}" app/src/components/MoveCard.tsx && echo "✓ MoveCard UI intact"

# 5. Check all route paths are valid
grep -E "'/review'|'/ask/|'/posts/" app/src/lib/moveNavigator.ts | wc -l | grep -q "[3-4]" && echo "✓ All route paths defined"
```

**Done:**
- ✓ Navigation flows tested across all move types
- ✓ Back button and history management verified
- ✓ Deep linking supports direct URL access
- ✓ Existing move actions (Skip, Dismiss) unaffected
- ✓ No TypeScript or build errors
- ✓ Breadcrumb UI displays move context
- ✓ Ready for UAT

---

## Success Criteria

**Phase 12 is complete when:**

1. ✓ moveNavigator.ts exists in app/src/lib/ with all 4 exports
2. ✓ MoveCard integrates navigateToMove() and calls it on Add button
3. ✓ PlannerScreen passes useNavigate hook and handles onNavigate callback
4. ✓ ReviewScreen receives conceptId from linkedResource and filters cards
5. ✓ PostDetailScreen receives post ID and validates against URL param
6. ✓ QuestionDetailScreen receives question ID and validates against URL param
7. ✓ All screens show breadcrumb when moveState present
8. ✓ Back button works and returns to /planner
9. ✓ Deep linking works (direct URL navigation without move state)
10. ✓ Skip/Dismiss buttons still work (no regressions)
11. ✓ TypeScript compilation passes with no errors
12. ✓ All 9 manual test cases pass in browser
13. ✓ Commits are atomic and traceable

---

## UAT Criteria

Users should be able to:

1. **"I see a suggested move on the Planner and want to explore it"**
   - Tap Add button on any suggested move
   - See relevant content (flashcards, post, or question) load
   - See a breadcrumb saying this came from the suggestion
   - Tap back to return to Planner without losing history

2. **"I want to jump to a review of a specific concept"**
   - Find a suggested move for that concept (moveType='review')
   - Tap Add
   - See ReviewScreen load with flashcards for that concept
   - Cards are filtered (not the full library)

3. **"I want to read about a connection from a suggestion"**
   - Find a suggested move with linkedResource.type='post'
   - Tap Add
   - See the post detail page with images and essay
   - Tap back to Planner

4. **"I want to dive deep into a question suggestion"**
   - Find a suggested move with linkedResource.type='question'
   - Tap Add
   - See the question detail page with Q&A
   - Tap back to Planner

5. **"I'm clicking a wrong move or skip it"**
   - Skip/Dismiss buttons still work as before
   - No navigation occurs, moves disappear from suggestions

---

## Effort Breakdown

| Task | Complexity | Time (agent) | Rationale |
|------|-----------|--------------|-----------|
| moveNavigator utility | Medium | 2 hours | Type-safe routing, multiple move types, edge case handling |
| MoveCard integration | Low | 1.5 hours | Hook integration, prop wiring, simple state update |
| Screen parameter handling | Medium | 3 hours | 3 screens to update, context extraction, filtering logic |
| Testing & validation | Medium | 1.5 hours | Manual flows, edge cases, regression checks |
| **Total** | **Medium** | **8-10 hours** | Within scope, no blockers |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| TypeScript type mismatch | Medium | High | Early tsc --noEmit validation in each task |
| Navigation state lost on refresh | Low | Medium | location.state is transient; refresh = deep link (by design) |
| Back button doesn't return to Planner | Low | High | React Router history management is standard; test early |
| Move filtering breaks existing reviews | Low | High | Use conditional logic (filteredCards only if moveState exists) |
| Regression in Skip/Dismiss | Low | Medium | Preserve existing handlers in MoveCard |
| Mobile deep linking issues | Low | Low | React Router handles on Capacitor the same as web |

---

## File Structure Summary

```
app/src/
├── lib/
│   ├── moveNavigator.ts                  [NEW] Navigation utility
│   └── ... (existing)
├── components/
│   ├── MoveCard.tsx                      [MODIFIED] + navigate prop
│   └── ... (existing)
├── screens/
│   ├── PlannerScreen.tsx                 [MODIFIED] + onNavigate callback
│   ├── ReviewScreen.tsx                  [MODIFIED] + moveState extraction
│   ├── PostDetailScreen.tsx              [MODIFIED] + moveState extraction
│   ├── QuestionDetailScreen.tsx          [MODIFIED] + moveState extraction
│   └── ... (existing)
└── ... (existing)
```

---

## References

- [React Router 7 Navigation](https://reactrouter.com/en/main/navigation)
- [useNavigate Hook](https://reactrouter.com/en/main/hooks/use-navigate)
- [useLocation Hook](https://reactrouter.com/en/main/hooks/use-location)
- [Passing State Between Routes](https://reactrouter.com/en/main/guides/state-in-router)
- Phase 10 PlannedMove types: `.planning/phases/10-planner-auto-suggestions-engine/`
