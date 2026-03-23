# EchoLearn UI/UX Enhancement: Technical Implementation Plan

This document refines the `UX_ENHANCEMENT.md` specification into a concrete implementation guide for the EchoLearn codebase.

## 1. Architectural Strategy & Dependencies

### 1.1. Technology Alignment
* **Platform:** The project is a Capacitor-based web app. While the specification mentions `react-native-gesture-handler`, the implementation agent should use **Framer Motion** or **native CSS Scroll Snap** for the vertical paging (Info Flow) and **PointerEvents** for the Mind Map drag-and-drop to maintain 60fps performance on mobile browsers.
* **State Management:** Leverage existing services (`questionService`, `flashcardService`, `graphService`) and hooks (`useQuestions`, `useReview`).
* **Persistence:** All enhancements must continue to use `localStorage` (via services) until the SQLite migration is initiated.

---

## 2. Module 1: The "Blindbox" Info Flow (Refactoring `InfoFlow.tsx`)

### 2.1. Component Structure & Paging
* **Target File:** `app/src/components/InfoFlow.tsx`
* **Implementation:** 
    * Refactor the container to a full-screen vertical slider using `scroll-snap-type: y mandatory`.
    * Each `InfoFlowItem` must occupy `height: 100dvh`.
    * Remove the standard scrollbar and implement a "infinite" feel by pre-fetching 10 items into the `infoFlowItems` memo in `HomeScreen.tsx`.

### 2.2. Content Transformation (LLM Hook Integration)
* **Logic Location:** `app/src/services/question.service.ts`
* **Change:** Update the `Question` interface in `app/src/types/index.ts` to include an optional `storyHook: string` field.
* **LLM Prompt Update:** Modify `questionService.ask` to request a "Storytelling Hook" in the JSON response.
    * *New JSON Schema:* `{"answer": "...", "summary": "...", "keywords": [...], "storyHook": "Why do you forget 80%..."}`
* **UI Display:** In `ConceptCard`, show the `storyHook` initially. Tap to toggle between the hook and the `summary`/`answer`.

### 2.3. Blindbox Card Types
* **Concept Card (Active Recall):**
    * Remove 1-5 buttons. Implement a horizontal flex row of 3 large emoji buttons: 🤯 (Score 1), 🤔 (Score 3), 😌 (Score 5).
    * Link these to `reviewService.submitReview`.
* **Connection Card:**
    * Use existing `onAhaConnection` but enhance the animation in `index.css` using `@keyframes aha-pulse`.
* **Trivia/Milestone Cards:**
    * Create a new `BlindboxItem` type in `types/index.ts`.
    * Inject these into the feed in `HomeScreen.tsx` based on `idx % 5 === 0`.

---

## 3. Module 2: Mind Map Classification (Refactoring `GraphScreen.tsx`)

### 3.1. Hierarchical Data Model
* **Target File:** `app/src/types/index.ts`
* **Change:** Add `parentId?: string` to the `Question` (Concept) interface.
* **Service Update:** `app/src/services/graph.service.ts` needs a `getChildren(parentId: string)` and `moveToParent(nodeId: string, newParentId: string)` method.

### 3.2. "Distill & File" UI Implementation
* **Target Component:** `CardStackInbox` in `app/src/screens/GraphScreen.tsx`.
* **Inbox Area:** Keep the existing draggable card logic but ensure it displays the `title` (distilled concept) prominently, with the original `content` as subtext.
* **Bucket Grid:**
    * Implement a `Bucket` component that displays the node title and an icon.
    * Use a local state `currentParentId` (default `null` for root) to filter displayed buckets.
    * **Hover Detection:** In the `onPointerMove` handler of the dragged card, if the coordinates overlap a bucket for >800ms (use a `useRef` timer), trigger `setCurrentParentId(bucket.id)`.
* **Breadcrumb Navigation:**
    * Add a "Back" drop-zone at the top: `[ ↖ Back to {ParentName} ]`.
    * Dropping the card here or hovering for 800ms moves the view up one level in the hierarchy.

### 3.3. Branch Creation
* **Target:** The `[ + New Concept ]` bucket.
* **Logic:** When a card is dropped here, trigger a modal/overlay for `graphService.createNewBranch(name, parentId)`.

---

## 4. Visual & Motion Polish (`app/src/index.css`)

* **Drill-down Transition:** Add a global `.view-drill-in` animation that scales the current buckets down and fades them out while the new level fades in.
* **Feedback Haptics:** (Simulation) Ensure `PointerEvents` trigger a scale transform on the target bucket when a card is hovered over it.
