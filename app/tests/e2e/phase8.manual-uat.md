# Phase 8 Manual UAT Checklist
## Post Detail Carousel + Infinite Scroll Feed Pagination

**Build:** Phase 8 (Post Detail & Infinite Scroll)
**Date:** 2026-03-27
**Devices:** iOS (primary), Android

---

## Pre-Requisites

- [ ] App deployed to test device (iOS or Android)
- [ ] At least 3 questions saved in the knowledge graph
- [ ] Feed has been refreshed (daily posts generated)
- [ ] At least one post has cached AI images (requires NanoBanana or Gemini API key)

---

## Section 1: Image Carousel (PostDetailScreen)

### 1.1 Carousel With Multiple Images

**Steps:**
1. Open HomeScreen feed
2. Tap any post that has AI-generated images (image banner visible in feed card)
3. Observe PostDetailScreen header loads correctly

**Expected:**
- [ ] Carousel appears above the article content (350px height)
- [ ] First image loads immediately (no skeleton flash)
- [ ] Counter badge shows "1/N" at bottom-right of carousel

**Steps:**
4. Swipe left on carousel image

**Expected:**
- [ ] Image smoothly animates to the left (300ms easeInOut)
- [ ] Next image slides in from the right
- [ ] Counter updates to "2/N"
- [ ] No jank or frame drops during transition

**Steps:**
5. Swipe right on carousel image

**Expected:**
- [ ] Image smoothly animates to the right
- [ ] Previous image slides in from the left
- [ ] Counter updates to "1/N"

**Steps:**
6. Swipe right when at first image

**Expected:**
- [ ] Nothing happens (stays at image 1)
- [ ] No visual glitch

**Steps:**
7. Swipe left when at last image

**Expected:**
- [ ] Nothing happens (stays at last image)

---

### 1.2 Single Image Post

**Steps:**
1. Find a post with exactly 1 AI-generated image
2. Open PostDetailScreen

**Expected:**
- [ ] Image displays statically (full 350px width)
- [ ] No swipe interaction available
- [ ] No counter badge displayed
- [ ] Back button works normally

---

### 1.3 No Images (Graceful Degradation)

**Steps:**
1. Open a post that has NO AI-generated images (e.g., connection post, or post without cached images)

**Expected:**
- [ ] Article displays without carousel section
- [ ] No skeleton shown (carousel simply not present)
- [ ] Essay/content visible immediately
- [ ] No error messages

---

### 1.4 Carousel Reset on Navigation

**Steps:**
1. Open a post with multiple images
2. Swipe to image 2 or 3
3. Press "Back to Home" button
4. Tap the same post again

**Expected:**
- [ ] Carousel resets to image 1 (not image 2/3)
- [ ] Counter shows "1/N"

---

### 1.5 Image Load Error Handling

**Steps:**
1. Open a post with cached images
2. Simulate network loss (airplane mode after opening)
3. Navigate to a new post

**Expected:**
- [ ] Failed images are silently hidden (no broken image icon)
- [ ] No error overlay in carousel
- [ ] Essay still visible and readable

---

### 1.6 iOS Back Swipe + Carousel Conflict

**iOS Only:**

**Steps:**
1. Open a post with a multi-image carousel
2. Position at image 2 (not first)
3. Attempt iOS back swipe from left edge of screen

**Expected:**
- [ ] iOS system back swipe triggers navigation back to feed
- [ ] Does not conflict with carousel drag gesture
- [ ] Carousel drag only activates well within screen content (not edge)

---

## Section 2: Infinite Scroll Feed Pagination

### 2.1 Basic Pull-Up Loading

**Steps:**
1. Open HomeScreen
2. Scroll feed down to absolute bottom
3. Observe bottom of feed

**Expected:**
- [ ] "Pull up to load more" hint appears with up arrow icon
- [ ] 80px min-height at bottom (no sudden layout jump)

**Steps:**
4. Continue scrolling to trigger pull-up load

**Expected:**
- [ ] "Loading more posts..." spinner replaces pull-up hint
- [ ] After load completes: 10 new posts appear at bottom of feed
- [ ] Hint resets to "Pull up to load more"
- [ ] No duplicate posts visible

---

### 2.2 No Duplicate Posts

**Steps:**
1. Load feed initially
2. Scroll to bottom, trigger load (load 10 more)
3. Scroll to bottom again, trigger another load (10 more)

**Expected:**
- [ ] All posts in feed are unique (no ID duplicates)
- [ ] Total feed size increases by ~10 each load
- [ ] Feed remains scrollable without jank

---

### 2.3 Debounce (No Rapid Firing)

**Steps:**
1. Scroll to bottom
2. Rapidly bounce scroll up and down at bottom several times

**Expected:**
- [ ] Only ONE load request fires per scroll-to-bottom event
- [ ] Not multiple overlapping requests
- [ ] Spinner shows once, not multiple times

---

### 2.4 Loading State Prevents Concurrent Loads

**Steps:**
1. Scroll to bottom when network is slow (or API response takes >2s)
2. While loading spinner shows, scroll away and back to bottom

**Expected:**
- [ ] Only one load is active at a time
- [ ] New scroll-to-bottom does not trigger second load while first is loading

---

### 2.5 Error Recovery

**Steps:**
1. Disable network (airplane mode)
2. Scroll to bottom of feed

**Expected:**
- [ ] Load attempt fails silently (no error toast)
- [ ] "Pull up to load more" hint reappears (allows retry)
- [ ] User can re-enable network and try again

---

## Section 3: Performance

### 3.1 Carousel Animation Smoothness

**Steps:**
1. Open a carousel with 3+ images
2. Rapidly swipe left and right 5+ times

**Expected:**
- [ ] Transitions stay at 60fps (no jank)
- [ ] No dropped frames visible
- [ ] No lag between gesture and animation start

### 3.2 Feed Scroll Performance

**Steps:**
1. Load 30+ posts in feed (3 pagination loads)
2. Scroll up and down rapidly

**Expected:**
- [ ] Feed scrolls at 60fps
- [ ] No jank when passing post images
- [ ] PullUpHint area does not cause layout reflows

---

## Section 4: Regression Tests (Phase 7 Baseline)

- [ ] Feed cards still display with title, image banner, contextLabel
- [ ] Connection cards still render between regular posts
- [ ] Tap on connection card still navigates to PostDetailScreen with essay streaming
- [ ] Ask section in PostDetailScreen still works (send message, receive AI response)
- [ ] Quick ask prompts still appear and function
- [ ] Back button navigates correctly from PostDetailScreen to HomeScreen
- [ ] Milestone cards still inject every 5 items

---

## Test Completion Sign-Off

| Section | Status | Notes |
|---------|--------|-------|
| 1.1 Multi-image carousel | - | |
| 1.2 Single image | - | |
| 1.3 No images | - | |
| 1.4 Carousel reset | - | |
| 1.5 Error handling | - | |
| 1.6 iOS back swipe | - | |
| 2.1 Pull-up loading | - | |
| 2.2 No duplicates | - | |
| 2.3 Debounce | - | |
| 2.4 Concurrent load guard | - | |
| 2.5 Error recovery | - | |
| 3.1 Carousel performance | - | |
| 3.2 Feed performance | - | |
| 4. Phase 7 regression | - | |

**Tester:** _____________
**Date:** _____________
**Build:** Phase 8 complete
**Overall Status:** PASS / FAIL / PARTIAL
