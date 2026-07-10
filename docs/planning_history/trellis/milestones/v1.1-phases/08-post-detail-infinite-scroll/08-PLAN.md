---
phase: 08-post-detail-infinite-scroll
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/PostCarousel.tsx
  - app/src/hooks/useInfiniteScroll.ts
  - app/src/hooks/usePostCarousel.ts
  - app/src/services/infiniteScroll.service.ts
  - app/src/screens/PostDetailScreen.tsx
  - app/src/screens/HomeScreen.tsx
  - app/tests/components/PostCarousel.test.mjs
  - app/tests/hooks/useInfiniteScroll.test.mjs
  - app/tests/services/infiniteScroll.service.test.mjs
  - app/tests/screens/PostDetailScreen.carousel.test.mjs
autonomous: true
requirements: [FEED-04, FEED-05, FEED-06]
must_haves:
  truths:
    - "User can view post detail page with image carousel at top"
    - "User can swipe left/right through generated images in carousel"
    - "Carousel shows image counter (N/M) at bottom-right"
    - "Single image posts display image without carousel UI"
    - "User can scroll feed to bottom and pull up to load more posts"
    - "Pull-up loads exactly 10 new posts without duplicates"
    - "No duplicate post IDs appear in feed across pagination"
    - "Carousel resets to first image when returning to same post"
    - "Carousel images load lazily on swipe (first loads immediately)"
    - "Smooth carousel transitions at 60fps without jank"
  artifacts:
    - path: app/src/components/PostCarousel.tsx
      provides: "Swipeable image carousel with Framer Motion, counter, lazy loading"
      exports: ["PostCarousel"]
    - path: app/src/hooks/useInfiniteScroll.ts
      provides: "Scroll detection hook with debounce and load state"
      exports: ["useInfiniteScroll"]
    - path: app/src/hooks/usePostCarousel.ts
      provides: "Carousel state management (index, loaded images)"
      exports: ["usePostCarousel"]
    - path: app/src/services/infiniteScroll.service.ts
      provides: "Post batch fetching and deduplication logic"
      exports: ["infiniteScrollService"]
    - path: app/src/screens/PostDetailScreen.tsx
      provides: "Post detail with carousel integration"
      pattern: "Contains PostCarousel component at top, essay below"
    - path: app/src/screens/HomeScreen.tsx
      provides: "Feed with infinite scroll pagination"
      pattern: "Uses useInfiniteScroll hook, pull-up affordance at bottom"
  key_links:
    - from: app/src/screens/PostDetailScreen.tsx
      to: app/src/components/PostCarousel.tsx
      via: "Import PostCarousel, pass images and callbacks"
      pattern: "<PostCarousel images={carouselImages} />"
    - from: app/src/screens/PostDetailScreen.tsx
      to: app/src/services/imageGeneration.service.ts
      via: "Retrieve cached images for carousel"
      pattern: "imageGenerationService.retrieveCachedImage()"
    - from: app/src/screens/HomeScreen.tsx
      to: app/src/hooks/useInfiniteScroll.ts
      via: "Detect scroll to bottom and trigger load"
      pattern: "containerRef from useInfiniteScroll"
    - from: app/src/screens/HomeScreen.tsx
      to: app/src/services/infiniteScroll.service.ts
      via: "Fetch post batches with deduplication"
      pattern: "infiniteScrollService.loadNextBatch()"
    - from: app/src/components/PostCarousel.tsx
      to: "Framer Motion library"
      via: "Drag gestures, AnimatePresence transitions"
      pattern: "motion.img drag='x' onDragEnd={}"
---

<objective>
**Phase 8: Post Detail & Infinite Scroll**

Implement two interconnected features:
1. **Post Detail Page with Image Carousel** — Display AI-generated images (from Phase 7) in a swipeable carousel above post content
2. **Infinite Scroll Feed Pagination** — Allow users to pull up at feed bottom to load 10 additional posts per batch

Purpose: 
- Enable users to explore post images via intuitive swipe gesture (mobile-first)
- Provide explicit, user-controlled pagination (pull-up gesture, not auto-scroll)
- Complete image-forward feed experience from Phase 7 with detail view

Output:
- PostCarousel component (reusable, tested)
- useInfiniteScroll hook (tested)
- Updated PostDetailScreen with carousel integration
- Updated HomeScreen with pull-up loading
- Full test coverage (8 new test files, 57 Phase 7 tests pass)
</objective>

<execution_context>
@~/.copilot/get-shit-done/workflows/execute-plan.md
@~/.copilot/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/08-post-detail-infinite-scroll/CONTEXT.md
@.planning/phases/08-post-detail-infinite-scroll/08-RESEARCH.md
@app/package.json
@app/src/services/imageGeneration.service.ts
@app/src/screens/PostDetailScreen.tsx
@app/src/screens/HomeScreen.tsx

## Key Locked Decisions (CONTEXT.md)

1. **Carousel Layout:** Header visible, 350-400px carousel height
2. **Carousel Interaction:** Swipe only (no tap arrows), manual (no auto-rotate), counter at bottom-right
3. **Carousel Loading:** Skeleton loading state, lazy-load on swipe
4. **Carousel Edge Cases:** Single image shown directly (no carousel UI), omit if 0 images, carousel resets on return
5. **Infinite Scroll:** Pull-up gesture at absolute bottom, 10 posts per batch, affordance hint visible
6. **Navigation:** Back swipe support (iOS), no deep links
7. **Deduplication:** Strict client-side check (post IDs tracked across pagination)

## Phase 7 Integration (imageGeneration.service)

Available from Phase 7:
- `imageGenerationService.retrieveCachedImage(postId, style)` — Get cached image by post + style
- `imageCache.service.ts` — Image cache with LRU eviction (50MB max)
- Images stored as base64 or URL, with error handling
- Phase 7 generates 1-3 images per post per style ("illustration", "infograph", "photo-style")

Phase 8 pattern:
```typescript
const images = await imageGenerationService.retrieveCachedImage(post.id, 'illustration');
// Returns GeneratedImage[] (0-3 images) or error
// If no images: show essay without carousel (graceful degradation)
```

## Standard Stack (Verified)

| Library | Version | Use |
|---------|---------|-----|
| React | 19.2.0 | Components, hooks |
| Framer Motion | 12.38.0 | Carousel swipe gestures, transitions |
| React Router | 7.13.1 | useParams, useNavigate (no deep links) |
| Capacitor | 8.1.0 | iOS back swipe interception |
| @capacitor/haptics | 8.0.1 | Haptic feedback on pull-up |
| Lucide React | 0.575.0 | Icons (ArrowLeft, Loader, etc.) |
| TypeScript | 5.9.3+ | Type safety |

## Test Framework

Node.js native test runner (no external framework):
```bash
# Run Phase 8 tests
node app/tests/components/PostCarousel.test.mjs
node app/tests/hooks/useInfiniteScroll.test.mjs
npm test  # Full suite (Phase 7 + Phase 8 + all others)
```

Must not break Phase 7 tests (57 passing tests must remain passing).
</context>

<tasks>

<task type="auto">
  <name>Task 0: Create test infrastructure and type definitions</name>
  <files>
    app/src/types/carousel.ts
    app/tests/components/PostCarousel.test.mjs
    app/tests/hooks/useInfiniteScroll.test.mjs
    app/tests/services/infiniteScroll.service.test.mjs
    app/tests/screens/PostDetailScreen.carousel.test.mjs
  </files>
  <action>
    Create Wave 0 test scaffolding and type definitions:

    1. **app/src/types/carousel.ts** — Define types consumed by carousel and infinite scroll
       - Export `CarouselState` (currentIndex, loadedIndexes)
       - Export `InfiniteScrollState` (posts, seenPostIds, isLoading, canLoadMore)
       - Export carousel props interface (images, isLoading, onIndexChange)
       - Export infinite scroll options (onLoadMore, threshold, debounceMs)
       - Reference existing `DailyPost` and `GeneratedImage` types from Phase 7

    2. **app/tests/components/PostCarousel.test.mjs** — Create test file (no implementations yet)
       - Import scaffold: `import assert from 'assert';`
       - Add test stubs for:
         * "renders single image without carousel UI"
         * "renders carousel with counter for multiple images"
         * "swipe left moves to next image"
         * "swipe right moves to previous image"
         * "loads first image immediately"
         * "lazy-loads adjacent images on swipe"
         * "shows skeleton loading state"
         * "handles image load error gracefully"
       - All tests marked `.skip()` for now (Wave 1 implementation enables them)

    3. **app/tests/hooks/useInfiniteScroll.test.mjs** — Create test file (stubs)
       - Test stubs for:
         * "detects scroll to bottom"
         * "debounces onLoadMore calls"
         * "loads more posts when at bottom"
         * "prevents concurrent loads"
         * "exposes loading state"

    4. **app/tests/services/infiniteScroll.service.test.mjs** — Create test file (stubs)
       - Test stubs for:
         * "fetches 10 posts per batch"
         * "filters duplicate post IDs"
         * "maintains seen set across batches"
         * "handles fetch errors"

    5. **app/tests/screens/PostDetailScreen.carousel.test.mjs** — Create test file (stubs)
       - Test stubs for:
         * "displays carousel when images available"
         * "resets carousel index when navigation changes"
         * "shows essay without carousel if no images"
         * "carousel integrates with imageGeneration.service"

    Do NOT implement test logic yet—just create files with test stubs and imports. Framework can immediately run `npm test` and see all tests skipped (green), confirming infrastructure ready.
  </action>
  <verify>
    - File exists: app/src/types/carousel.ts with exported types
    - File exists: app/tests/components/PostCarousel.test.mjs with 8 test stubs
    - File exists: app/tests/hooks/useInfiniteScroll.test.mjs with 5 test stubs
    - File exists: app/tests/services/infiniteScroll.service.test.mjs with 4 test stubs
    - File exists: app/tests/screens/PostDetailScreen.carousel.test.mjs with 4 test stubs
    - Run: `npm test 2>&1 | grep -i "skipped\|passing"` — Shows skipped tests (infrastructure ready)
  </verify>
  <done>
    All test files exist with proper structure. `npm test` runs without errors (all tests skipped).
    Type definitions exported and ready for component/hook implementations.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Build PostCarousel component (Framer Motion, swipe, counter, lazy load)</name>
  <files>app/src/components/PostCarousel.tsx</files>
  <behavior>
    - Carousel displays images in sequence, swipeable left/right
    - First image loads immediately; remaining images load on swipe (lazy)
    - Swipe threshold: 50px horizontal (prevents accidental swipes)
    - Counter shows "N/M" format at bottom-right corner
    - Single image: show directly without carousel UI or counter
    - Zero images: return null (PostDetailScreen handles omission)
    - Image load error: hide image (silent fallback, no error UI in carousel)
    - Carousel transitions: 300ms easeInOut (60fps smooth)
    - Reset carousel to image 0 when images array changes (supports carousel reset on navigation)
  </behavior>
  <action>
    Implement PostCarousel component using Framer Motion (already in package.json v12.38.0):

    1. **Component structure:**
       ```typescript
       interface PostCarouselProps {
         images: GeneratedImage[];
         isLoading?: boolean;
         onIndexChange?: (index: number) => void;
       }

       export function PostCarousel({ images, isLoading, onIndexChange }: PostCarouselProps)
       ```

    2. **Key features:**
       - Use `useState(0)` for current image index
       - Track loaded image indexes via `useState(new Set([0]))` for lazy loading
       - Use `useEffect()` to reset carousel when `images.length` changes (per locked decision)
       - Implement `handleDragEnd` callback to detect swipe direction (50px threshold)
       - Use Framer Motion `motion.img` with `drag="x"`, `dragElastic={0.2}`
       - Wrap with `AnimatePresence` mode="wait" for enter/exit animations
       - Pre-load adjacent images (currentIndex ± 1) on swipe (lazy loading optimization)

    3. **UI structure:**
       ```
       <div className="carousel-container" style={{ position: 'relative', width: '100%', height: '350px' }}>
         <AnimatePresence mode="wait">
           <motion.img key={currentIndex} src={...} drag="x" onDragEnd={...} />
         </AnimatePresence>
         {/* Counter badge (only if images.length > 1) */}
         <div style={{ position: 'absolute', bottom: '12px', right: '12px', ... }}>
           {currentIndex + 1}/{images.length}
         </div>
       </div>
       ```

    4. **Edge case handling:**
       - If `isLoading=true`: Return Skeleton component (350px height, matching carousel)
       - If `images.length === 0`: Return null
       - If `images.length === 1`: Return static image div (no carousel UI, no counter, no swipe)
       - Image load error: Silently hide image (set `style.display='none'`)

    5. **Styling:**
       - Use Tailwind classes or inline styles (match existing component patterns in app/src/components/)
       - Border radius: var(--radius-xl)
       - Background: var(--surface-variant)
       - Counter: rgba(0,0,0,0.6) semi-transparent dark background, white text, 12px padding
       - Image: objectFit: 'cover', userSelect: 'none', cursor: 'grab' (when draggable)

    6. **Integration with Phase 7:**
       - Accept `GeneratedImage[]` from imageGeneration.service (has `imageBase64` or `imageUrl` properties)
       - Use imageBase64 first, fall back to imageUrl for display

    7. **No hand-rolled gesture logic:**
       - Use Framer Motion drag API (not custom touch listeners)
       - AnimatePresence handles exit/enter transitions (not manual CSS)

    Implement full component, then enable Phase 0 test stubs in PostCarousel.test.mjs and run tests until all 8 pass.
  </action>
  <verify>
    <automated>
      node app/tests/components/PostCarousel.test.mjs
      # Must pass 8 assertions:
      # ✓ renders single image without carousel UI
      # ✓ renders carousel with counter for multiple images
      # ✓ swipe left moves to next image
      # ✓ swipe right moves to previous image
      # ✓ loads first image immediately
      # ✓ lazy-loads adjacent images on swipe
      # ✓ shows skeleton loading state
      # ✓ handles image load error gracefully
    </automated>
  </verify>
  <done>
    PostCarousel component complete. All 8 tests passing. Component accepts images array, handles swipe gestures,
    displays counter, lazy-loads images, handles edge cases (single/zero images), and integrates with Phase 7
    GeneratedImage type. Framer Motion animations smooth (no jank). Ready for integration into PostDetailScreen.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build useInfiniteScroll hook (scroll detection, debounce, state management)</name>
  <files>app/src/hooks/useInfiniteScroll.ts</files>
  <behavior>
    - Hook returns containerRef to attach to scrollable feed container
    - Detects when scroll reaches absolute bottom (scrollHeight - (scrollTop + clientHeight) === 0)
    - On bottom detection: fires onLoadMore callback (max once per 300ms debounce)
    - While loading: prevents re-triggering (isLoading check)
    - Hook provides isLoading state (true during onLoadMore promise)
    - Hook provides setCanLoadMore setter (allows disabling after all posts loaded)
    - Passive scroll listener (prevents page jank)
    - Handles scroll listener cleanup on unmount
  </behavior>
  <action>
    Implement useInfiniteScroll hook (React 19 with TypeScript):

    1. **Interface:**
       ```typescript
       interface UseInfiniteScrollOptions {
         onLoadMore: () => Promise<void>;
         threshold?: number; // pixels from bottom (default 0 for absolute bottom)
         debounceMs?: number; // milliseconds (default 300)
       }

       export function useInfiniteScroll({
         onLoadMore,
         threshold = 0,
         debounceMs = 300,
       }: UseInfiniteScrollOptions)
       ```

    2. **Returns:**
       ```typescript
       return {
         containerRef: RefObject<HTMLDivElement>,
         isLoading: boolean,
         setCanLoadMore: (can: boolean) => void,
       }
       ```

    3. **Implementation:**
       - Create `containerRef` via `useRef<HTMLDivElement>(null)`
       - Create state: `isLoading`, `canLoadMore`
       - Create ref: `debounceTimerRef` to track pending debounce
       - Implement `handleScroll` callback:
         * Extract scrollTop, scrollHeight, clientHeight from containerRef.current
         * Calculate distanceFromBottom: scrollHeight - (scrollTop + clientHeight)
         * Check if distanceFromBottom <= threshold
         * If already loading or debounce pending, return early
         * If at bottom: set debounce timer, call onLoadMore() after debounceMs
         * Set isLoading=true during promise, false on completion
         * Catch errors (log to console, don't throw)
       - Register scroll listener via useEffect (passive: true)
       - Clean up listener on unmount

    4. **Edge cases:**
       - Debounce timer prevents multiple calls while at bottom
       - isLoading flag prevents overlapping requests
       - setCanLoadMore allows disabling pagination when no more posts available
       - Error handling: log errors, allow retry on next scroll

    5. **Testing criteria (from Wave 0 stubs):**
       - Detects scroll to bottom
       - Debounces onLoadMore calls (max once per 300ms)
       - Loads more posts when at bottom
       - Prevents concurrent loads (isLoading blocks retriggering)
       - Exposes loading state correctly

    Implement full hook, then enable test stubs in useInfiniteScroll.test.mjs and run until all 5 tests pass.
  </action>
  <verify>
    <automated>
      node app/tests/hooks/useInfiniteScroll.test.mjs
      # Must pass 5 assertions:
      # ✓ detects scroll to bottom
      # ✓ debounces onLoadMore calls
      # ✓ loads more posts when at bottom
      # ✓ prevents concurrent loads
      # ✓ exposes loading state
    </automated>
  </verify>
  <done>
    useInfiniteScroll hook complete. All 5 tests passing. Hook correctly detects bottom scroll position,
    debounces calls, manages loading state, and cleans up listeners. Ready for HomeScreen integration.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build infiniteScroll.service (batch fetching, deduplication)</name>
  <files>app/src/services/infiniteScroll.service.ts</files>
  <behavior>
    - Service fetches post batches from concept-feed.service
    - Each batch: exactly 10 posts
    - Deduplication: filters out posts with IDs already in seenPostIds set
    - Returns deduplicated batch (may have <10 if duplicates filtered)
    - Maintains seen post ID set across multiple batch calls
    - Error handling: propagates fetch errors (caller decides retry)
    - Pagination: tracks offset internally (loads posts 0-9, then 10-19, etc.)
  </behavior>
  <action>
    Implement infiniteScrollService (singleton service):

    1. **Exports:**
       ```typescript
       export const infiniteScrollService = {
         initialize(): void,
         loadNextBatch(limit?: number): Promise<DailyPost[]>,
         reset(): void,
         getSeenPostIds(): Set<string>,
       }
       ```

    2. **Internal state:**
       - `seenPostIds: Set<string>` (tracks all post IDs loaded so far)
       - `offset: number` (current pagination position in concept-feed)
       - Access existing `conceptFeedService.getPostBatch(offset, limit)` from Phase 7

    3. **Implementation:**
       ```typescript
       // Initialize with empty state
       initialize() {
         seenPostIds = new Set();
         offset = 0;
       }

       // Load next batch
       async loadNextBatch(limit = 10): Promise<DailyPost[]> {
         try {
           const batch = await conceptFeedService.getPostBatch(offset, limit);
           
           // Filter duplicates
           const deduplicated = batch.filter(post => !seenPostIds.has(post.id));
           
           // Track new post IDs
           deduplicated.forEach(post => seenPostIds.add(post.id));
           
           // Increment offset for next batch
           offset += limit;
           
           return deduplicated;
         } catch (err) {
           console.error('[infiniteScrollService] Batch load failed:', err);
           throw err; // Caller handles retry
         }
       }

       reset() {
         seenPostIds.clear();
         offset = 0;
       }

       getSeenPostIds() {
         return new Set(seenPostIds); // Return copy to prevent external mutation
       }
       ```

    4. **Integration with Phase 7:**
       - Use existing `conceptFeedService.getPostBatch(offset, limit)` (already implemented)
       - No changes to DailyPost or GeneratedImage structures (Phase 7 compat)

    5. **Testing criteria:**
       - Fetches 10 posts per batch
       - Filters duplicate post IDs
       - Maintains seen set across batches
       - Handles fetch errors gracefully

    Implement full service, enable test stubs, run tests until all 4 pass.
  </action>
  <verify>
    <automated>
      node app/tests/services/infiniteScroll.service.test.mjs
      # Must pass 4 assertions:
      # ✓ fetches 10 posts per batch
      # ✓ filters duplicate post IDs
      # ✓ maintains seen set across batches
      # ✓ handles fetch errors
    </automated>
  </verify>
  <done>
    infiniteScrollService complete. All 4 tests passing. Service correctly fetches post batches,
    deduplicates by post ID, tracks seen posts across calls, and handles errors. Ready for HomeScreen integration.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Build usePostCarousel hook (carousel state management, index tracking)</name>
  <files>app/src/hooks/usePostCarousel.ts</files>
  <behavior>
    - Hook manages carousel state: currentIndex, loadedIndexes
    - Resets to 0 when images array changes
    - Lazy-loads images: first image always loaded, adjacent images on index change
    - Exports currentIndex, setCurrentIndex, loadedIndexes for component use
    - Tracks which images have been requested (pre-loads adjacent for smooth UX)
  </behavior>
  <action>
    Implement usePostCarousel hook (optional optimization hook, abstracts carousel state):

    1. **Interface:**
       ```typescript
       export function usePostCarousel(imagesLength: number) {
         return {
           currentIndex: number,
           setCurrentIndex: (index: number) => void,
           loadedIndexes: Set<number>,
         }
       }
       ```

    2. **Implementation:**
       - State: `currentIndex` (useState(0)), `loadedIndexes` (useState(Set([0])))
       - Effect: On imagesLength change, reset to 0 and clear loadedIndexes
       - Effect: On currentIndex change, update loadedIndexes to include current ± 1
       - Return index, setter, and loadedIndexes set

    3. **Purpose:**
       - Simplifies PostCarousel component (hooks composition)
       - Separates carousel state logic from UI rendering
       - Enables reuse if other components need similar lazy-load behavior

    Note: This hook is optional—PostCarousel could manage state directly. But extracting it enables
    better testability and component reusability. Include if time permits; defer if not.

    (This task is low-priority; can be skipped if Phase 8 falls behind schedule.)
  </action>
  <verify>
    - Hook implemented and exported
    - PostCarousel can optionally use hook (component works either way)
  </verify>
  <done>
    usePostCarousel hook implemented. PostCarousel uses hook if available, falls back to inline state.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Build PullUpHint affordance component (UI hint for pull-up gesture)</name>
  <files>app/src/components/PullUpHint.tsx</files>
  <behavior>
    - Component visible only when user scrolls to absolute bottom of feed
    - Displays hint text: "Pull up to load more" with up arrow icon
    - While loading: displays "Loading more posts..." with spinner icon
    - Pre-allocates height (80px) even when not visible to prevent scroll jank
    - Uses Lucide React icons (ArrowUp, Loader)
    - Haptic feedback (optional): Trigger vibration on pull-up success
  </behavior>
  <action>
    Implement PullUpHint affordance component:

    1. **Component signature:**
       ```typescript
       interface PullUpHintProps {
         isLoading?: boolean;
         isAtBottom?: boolean;
       }

       export function PullUpHint({ isLoading = false, isAtBottom = false }: PullUpHintProps)
       ```

    2. **UI:**
       - Container: minHeight always 80px (prevents scroll jank)
       - When isAtBottom && !isLoading: Show "⬆️ Pull up to load more" with chevron icon
       - When isLoading: Show "Loading more posts..." with spinner icon
       - Styling: Muted foreground color, centered text, padding 20px
       - Icons: Lucide React (ArrowUp, Loader)

    3. **Optional: Haptic feedback**
       - Import @capacitor/haptics
       - Trigger `Haptics.notification({ type: 'SUCCESS' })` after successful load (called from HomeScreen)
       - Add callback prop: `onLoadSuccess?: () => void`

    4. **Testing:**
       - Component renders when isAtBottom=true
       - Displays loading state when isLoading=true
       - Always reserves 80px height

    Note: This is a presentational component (no complex logic). Can test via visual inspection or
    simple snapshot test. Add to PostDetailScreen.carousel.test.mjs.

    Implement component, integrate with HomeScreen (Task 6).
  </action>
  <verify>
    - Component file exists: app/src/components/PullUpHint.tsx
    - Renders when isAtBottom=true, hidden otherwise
    - Shows loading spinner when isLoading=true
    - Pre-allocated height prevents scroll jank
  </verify>
  <done>
    PullUpHint component complete. Provides clear affordance for pull-up gesture.
    Ready for HomeScreen integration.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Integrate infinite scroll into HomeScreen (feed pagination with pull-up)</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <behavior>
    - HomeScreen feed container uses useInfiniteScroll hook
    - Attach containerRef from useInfiniteScroll to scrollable feed div
    - On scroll-to-bottom: useInfiniteScroll detects and calls onLoadMore
    - onLoadMore: calls infiniteScrollService.loadNextBatch(10) and appends to feed
    - PullUpHint shown at bottom (isAtBottom and isLoading state from hook)
    - Pull-up affordance pre-allocated height to prevent scroll jank
    - Haptic feedback on successful load (iOS/Android)
    - Error handling: Log errors, allow retry on next scroll
    - Maintains existing HomeScreen post display logic
    - Phase 7 tests must still pass (no breaking changes)
  </behavior>
  <action>
    Integrate useInfiniteScroll hook into HomeScreen:

    1. **Current HomeScreen structure (review):**
       - Displays list of daily posts (already from Phase 7)
       - Each post rendered as card with image, title, overlay
       - ScrollableContainer or div with overflow-y: auto

    2. **Changes to make:**
       a. Import useInfiniteScroll hook
       b. Import infiniteScrollService
       c. Import PullUpHint component
       d. Replace ScrollableContainer ref with useInfiniteScroll ref:
          ```typescript
          const { containerRef, isLoading, setCanLoadMore } = useInfiniteScroll({
            onLoadMore: handleLoadMore,
            threshold: 0, // Absolute bottom
            debounceMs: 300,
          });

          async function handleLoadMore() {
            try {
              const newPosts = await infiniteScrollService.loadNextBatch(10);
              setPosts(prev => [...prev, ...newPosts]); // Append to feed
            } catch (err) {
              console.error('[HomeScreen] Load more failed:', err);
              // User can retry by scrolling again
            }
          }
          ```
       e. Attach containerRef to feed container:
          ```typescript
          <div ref={containerRef} style={{ overflowY: 'auto', height: '100vh' }}>
            {/* Posts render here */}
          </div>
          ```
       f. Add PullUpHint at bottom of feed:
          ```typescript
          <PullUpHint isAtBottom={/* detect if at bottom */} isLoading={isLoading} />
          ```
       g. Initialize infiniteScrollService on mount:
          ```typescript
          useEffect(() => {
            infiniteScrollService.initialize();
          }, []);
          ```

    3. **Integration details:**
       - infiniteScrollService.initialize() on HomeScreen mount
       - infiniteScrollService.loadNextBatch() in handleLoadMore
       - No changes to existing post rendering or styling
       - Preserve Phase 7 HomeScreen behavior (no breaking changes)

    4. **Error handling:**
       - Catch errors in handleLoadMore, log to console
       - User can retry by scrolling to bottom again
       - Allow user to continue browsing (non-blocking error)

    5. **Performance:**
       - Passive scroll listener (useInfiniteScroll already handles)
       - Lazy image loading in carousel (Phase 8 Task 1)
       - Batch fetch limit 10 posts (reasonably quick response)

    After integration, run Phase 7 tests to verify no regressions:
    ```bash
    npm test  # All tests must pass (57 Phase 7 + 4 Phase 8 integration)
    ```

    Implement integration, verify tests pass, HomeScreen renders with infinite scroll enabled.
  </action>
  <verify>
    <automated>
      # Phase 7 tests must still pass (no breaking changes)
      npm test 2>&1 | grep -E "passing|failing"
      # Expected: 57 Phase 7 tests + Phase 8 tests = ALL PASSING
    </automated>
  </verify>
  <done>
    HomeScreen infinite scroll integrated. Pull-up gesture triggers 10-post batches.
    PullUpHint affordance visible at bottom. Phase 7 tests all pass (no regressions).
    Ready for PostDetailScreen carousel integration (Task 7).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Integrate carousel into PostDetailScreen (display carousel above essay)</name>
  <files>app/src/screens/PostDetailScreen.tsx</files>
  <behavior>
    - PostDetailScreen fetches post detail (existing)
    - Retrieves generated images for post from imageGeneration.service cache
    - If 0 images: show essay without carousel (graceful degradation)
    - If 1 image: show image directly (PostCarousel handles; no carousel UI)
    - If 2+ images: show carousel with swipe, counter, lazy-load
    - Carousel at top of page (after header/title, before essay content)
    - Carousel height: 350-400px (locked decision)
    - Carousel resets to first image when returning to same post (detect via useParams id)
    - Back button works (existing)
    - Back swipe (iOS) works (Capacitor handles)
  </behavior>
  <action>
    Integrate PostCarousel into PostDetailScreen:

    1. **Review current PostDetailScreen:**
       - Fetches post by ID (useParams)
       - Displays title, author, date (existing)
       - Displays essay/article content (existing)
       - Has back button (existing)

    2. **Changes to make:**
       a. Import PostCarousel component
       b. Import imageGenerationService
       c. Add state for carousel images and loading:
          ```typescript
          const { id } = useParams<{ id: string }>();
          const [carouselImages, setCarouselImages] = useState<GeneratedImage[]>([]);
          const [isLoadingCarousel, setIsLoadingCarousel] = useState(true);
          ```
       d. Add useEffect to fetch carousel images when post loads:
          ```typescript
          useEffect(() => {
            if (!post?.id) return;
            
            (async () => {
              setIsLoadingCarousel(true);
              try {
                // Fetch first available image style (or multiple if available)
                const images = await imageGenerationService.retrieveCachedImages(post.id);
                // Phase 7 returns array of GeneratedImage[], filtered by available cache
                setCarouselImages(images);
              } catch (err) {
                console.error('[PostDetail] Carousel load failed:', err);
                setCarouselImages([]); // Graceful: show essay without carousel
              } finally {
                setIsLoadingCarousel(false);
              }
            })();
          }, [post?.id]); // Re-fetch if different post
          ```
       e. Add carousel reset effect (per locked decision):
          ```typescript
          // Carousel auto-resets when id param changes (handled by useEffect above on [post?.id])
          ```
       f. Add PostCarousel to JSX (between header and essay):
          ```typescript
          return (
            <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
              {/* Back button */}
              <button onClick={() => navigate('/home')}>
                <ArrowLeft size={18} />
              </button>
              
              {/* Post title, author, date */}
              <h1>{post.title}</h1>
              
              {/* NEW: Carousel (0 images = none shown, 1 = static image, 2+ = carousel) */}
              {carouselImages.length > 0 && (
                <PostCarousel 
                  images={carouselImages} 
                  isLoading={isLoadingCarousel}
                  onIndexChange={(index) => console.log('Carousel index:', index)} 
                />
              )}
              
              {/* Existing essay/article content */}
              <article>{post.essay}</article>
            </div>
          );
          ```

    3. **Edge case handling:**
       - No images (carouselImages.length === 0): PostCarousel not rendered, essay shows alone
       - Single image: PostCarousel renders static image (no carousel UI per locked decision)
       - 2+ images: PostCarousel renders carousel with counter and swipe

    4. **Integration with Phase 7:**
       - Use imageGenerationService.retrieveCachedImages(postId) or equivalent
       - If method doesn't exist, implement: fetch all image styles for post from cache
       - Fallback: empty array (graceful degradation)

    5. **Error handling:**
       - Catch errors in carousel fetch, log to console
       - Set carouselImages to empty array (essay displays without carousel)
       - Non-blocking: user sees essay regardless

    After integration, run all tests:
    ```bash
    npm test  # All Phase 7 + Phase 8 tests must pass
    ```

    Implement integration, verify carousel appears in PostDetailScreen with correct height,
    swipe works, counter displays, carousel resets on navigation.
  </action>
  <verify>
    <automated>
      # Run carousel integration test
      node app/tests/screens/PostDetailScreen.carousel.test.mjs
      # Must pass:
      # ✓ displays carousel when images available
      # ✓ resets carousel index when navigation changes
      # ✓ shows essay without carousel if no images
      # ✓ carousel integrates with imageGeneration.service
      
      # Also verify no Phase 7 regressions
      npm test 2>&1 | grep -E "passing|failing"
    </automated>
  </verify>
  <done>
    PostDetailScreen carousel integration complete. Carousel displays above essay content.
    Swipe gestures work. Counter shows correctly. Carousel resets on navigation.
    Phase 7 tests all pass. Ready for E2E testing (Task 8).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: End-to-end testing and edge case validation (manual UAT checklist)</name>
  <files>
    app/tests/e2e/phase8.manual-uat.md
  </files>
  <behavior>
    - Create UAT checklist for manual testing on real devices (iOS + Android)
    - Verify carousel swipe gestures work on touch devices
    - Verify pull-up gesture triggers pagination
    - Verify no duplicate posts in feed across multiple pagination loads
    - Verify carousel resets on return (navigate away and back to same post)
    - Verify back swipe (iOS) doesn't conflict with carousel drag
    - Verify image errors don't break UI
    - Verify performance: 60fps carousel transitions, no scroll jank
    - All automated tests pass (8 new tests + 57 Phase 7 tests)
  </behavior>
  <action>
    Create comprehensive E2E UAT checklist and run all tests:

    1. **Create app/tests/e2e/phase8.manual-uat.md:**
       - Document manual test steps for iOS and Android
       - Include screenshots/expectations for each step
       - Test carousel: swipe left, swipe right, counter accuracy, single image, zero images
       - Test infinite scroll: scroll to bottom, pull-up, loading state, no duplicates, 10 posts per batch
       - Test navigation: open post, close, reopen same post, carousel resets
       - Test back swipe: iOS only, swipe from left edge on carousel screen, returns to feed
       - Test error handling: no images for post, image load fails, network error on pagination
       - Test performance: carousel transitions smooth (no jank), scroll smooth (no lag)

    2. **Run automated test suite:**
       ```bash
       npm test  # Full suite: all tests must pass
       ```

    3. **Validate test counts:**
       - Phase 7 tests: 57 (all passing, no regressions)
       - Phase 8 new tests: 8
       - Total: 65 tests passing

    4. **Manual device testing (if available):**
       - Deploy to iOS and Android test devices
       - Follow UAT checklist steps
       - Record any issues or unexpected behavior
       - Document fixes if needed

    Create checklist, run all tests, verify Phase 8 complete and ready for production.
  </action>
  <verify>
    <automated>
      npm test 2>&1 | tail -20
      # Output must show:
      # passing 65 tests (57 Phase 7 + 8 Phase 8)
      # failing 0
      # skipped 0
      
      # Verify test file structure
      ls app/tests/components/PostCarousel.test.mjs
      ls app/tests/hooks/useInfiniteScroll.test.mjs
      ls app/tests/services/infiniteScroll.service.test.mjs
      ls app/tests/screens/PostDetailScreen.carousel.test.mjs
      ls app/tests/e2e/phase8.manual-uat.md
    </automated>
  </verify>
  <done>
    All 65 tests passing (57 Phase 7 + 8 Phase 8). UAT checklist created.
    Phase 8 implementation complete and ready for production deployment.
    Manual device testing can be performed against deployed build.
  </done>
</task>

</tasks>

<verification>
**All requirements addressed:**

| Requirement | Task | Verification |
|-------------|------|--------------|
| FEED-04: Scroll-release to load more posts | Task 2, Task 6 | useInfiniteScroll hook + HomeScreen integration; pull-up loads 10 posts |
| FEED-05: Post detail page with carousel | Task 1, Task 7 | PostCarousel component + PostDetailScreen integration |
| FEED-06: Multiple images in carousel | Task 1, Task 7 | Carousel swipes, counter shows N/M, lazy-loads images |

**Locked decisions implemented:**

| Decision | Task | Implementation |
|----------|------|-----------------|
| Carousel: Swipe only, no tap arrows | Task 1 | Framer Motion drag="x", no button UI |
| Carousel: Manual, no auto-rotate | Task 1 | User controls via swipe, no auto-advance |
| Carousel: Counter at bottom-right | Task 1 | Position: absolute, bottom: 12px, right: 12px |
| Carousel: Skeleton loading | Task 0 | Skeleton component displayed while loading |
| Carousel: Single image direct display | Task 1 | Check images.length === 1, return static image |
| Carousel: Omit if 0 images | Task 1, Task 7 | PostCarousel returns null, PostDetailScreen omits carousel div |
| Carousel: Lazy-load on swipe | Task 1 | First image pre-loaded, adjacent on swipe |
| Carousel: Reset on return | Task 7 | useEffect on [post?.id] resets carousel index |
| Infinite scroll: Pull-up gesture | Task 2, Task 6 | useInfiniteScroll + PullUpHint affordance |
| Infinite scroll: Absolute bottom detection | Task 2 | threshold = 0, strict bottom check |
| Infinite scroll: Affordance hint | Task 5, Task 6 | PullUpHint component visible at bottom |
| Infinite scroll: 10 posts per batch | Task 3, Task 6 | infiniteScrollService.loadNextBatch(10) |
| Navigation: Back swipe support | (existing) | Capacitor App.backButton listener (Phase 7) |
| Edge case: Duplicate detection | Task 3 | infiniteScrollService tracks seenPostIds |

**Testing strategy:**

| Test Type | Coverage | Command |
|-----------|----------|---------|
| Unit: PostCarousel | 8 tests (swipe, counter, lazy-load, edge cases) | node app/tests/components/PostCarousel.test.mjs |
| Unit: useInfiniteScroll | 5 tests (bottom detect, debounce, loading) | node app/tests/hooks/useInfiniteScroll.test.mjs |
| Unit: infiniteScrollService | 4 tests (batch fetch, dedup, seen set) | node app/tests/services/infiniteScroll.service.test.mjs |
| Integration: PostDetailScreen | 4 tests (carousel display, reset, no images) | node app/tests/screens/PostDetailScreen.carousel.test.mjs |
| Regression: Phase 7 | 57 tests (must all pass) | npm test |
| Manual UAT | Device testing checklist | app/tests/e2e/phase8.manual-uat.md |

**Total test count:** 65 automated tests (57 Phase 7 + 8 Phase 8)

**Regression guarantee:** All Phase 7 tests pass; no breaking changes to HomeScreen or PostDetailScreen base functionality.
</verification>

<success_criteria>
✅ **Phase 8 Complete When:**

1. **All 8 tasks completed:**
   - Test infrastructure created (Wave 0)
   - PostCarousel component implemented (TDD, 8 tests passing)
   - useInfiniteScroll hook implemented (TDD, 5 tests passing)
   - infiniteScrollService implemented (TDD, 4 tests passing)
   - PullUpHint affordance component implemented
   - HomeScreen infinite scroll integrated
   - PostDetailScreen carousel integrated
   - E2E UAT checklist created

2. **All tests passing:**
   - 8 new Phase 8 tests passing
   - 57 Phase 7 tests passing (no regressions)
   - Total: 65 tests green

3. **Behavior verified:**
   - ✅ Carousel swipes left/right, shows counter, lazy-loads images
   - ✅ Single image shown without carousel UI
   - ✅ Zero images: essay displays without carousel
   - ✅ Scroll to bottom triggers pull-up affordance
   - ✅ Pull-up loads 10 new posts without duplicates
   - ✅ Carousel resets when returning to same post
   - ✅ Back swipe doesn't conflict with carousel drag (iOS)
   - ✅ No scroll jank, 60fps carousel transitions
   - ✅ Image load errors handled gracefully

4. **Code quality:**
   - ✅ TypeScript strict mode (no `any`)
   - ✅ React 19 hooks patterns
   - ✅ Framer Motion gestures (no hand-rolled touch logic)
   - ✅ Phase 7 service integration (no redundant implementations)
   - ✅ Error handling throughout (no silent failures)
   - ✅ Component and hook composition (reusable, tested)

5. **Production-ready:**
   - ✅ Files committed to git
   - ✅ No console errors or warnings
   - ✅ Accessibility: semantic HTML, ARIA labels if needed
   - ✅ Performance: lazy loading, debounce, passive listeners
   - ✅ Mobile-first: Tailwind responsive, Capacitor gesture support
</success_criteria>

<output>
After successful execution, create summary files:

1. `.planning/phases/08-post-detail-infinite-scroll/08-PLAN-SUMMARY.md`
   - List completed tasks
   - Test results (65/65 passing)
   - Integration status (PostDetailScreen + HomeScreen modified)
   - Artifacts created (5 new components/hooks, 4 test files)

2. `.planning/phases/08-post-detail-infinite-scroll/08-VERIFICATION.md`
   - Automated test outputs
   - Phase 7 regression test confirmation
   - Manual UAT checklist status

3. Update `.planning/ROADMAP.md`
   - Phase 8 marked complete ✓
   - Update Phase 9 start status (ready to plan)
   - Phase counts updated: "Complete: 1-8 | Remaining: 9-11"

Next phase ready to plan: `/gsd-plan-phase 9` (Image Regeneration & Error Handling)
</output>
