---
status: diagnosed
phase: 15-cluster-detail-system
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md]
started: 2026-03-29T12:00:00Z
updated: 2026-03-29T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cluster Node Creation on New Question
expected: Ask a question through the Ask screen. After answer streams in, check localStorage for a new Question entity with `isClusterNode: true`, a `title` matching the cluster label, and `qaCount >= 1`. The anchor node should have a `clusterNodeId` pointing to the cluster's ID.
result: pass

### 2. Cluster Node Tap in Mindmap — Bottom Panel
expected: Navigate to the Graph screen. Tap a cluster node (intermediate level, e.g., "Learning Theory"). A bottom detail panel should appear with the label "KNOWLEDGE CLUSTER — N concepts, M Q&As", a list of child anchor names, and a "View details" button/CTA.
result: pass

### 3. Cluster Bottom Panel — Navigate to Detail Page
expected: With the cluster bottom panel visible, tap "View details" (or tap the panel itself). You should be navigated to `/cluster/:id` — the ClusterDetailScreen showing the cluster title, breadcrumb (Root > Branch), stats (N concepts, M Q&As, K flashcards), and two action buttons.
result: pass

### 4. ClusterDetailScreen — Aggregated Content
expected: On the cluster detail page, scroll down. You should see a "Knowledge Summary" section with summaries grouped by anchor name, and a "Child Anchors" section listing each anchor card with its name, Q&A count, and summary preview. Tapping an anchor card should navigate to `/anchor/:id`.
result: pass

### 5. Cluster Review Flashcards Button
expected: On the cluster detail page, tap "Review Flashcards". You should be navigated to the Review screen showing only flashcards from Q&As belonging to anchors under this cluster. If no flashcards exist yet, the button should be disabled or show 0 count.
result: pass

### 6. Cluster Learn as Post Button
expected: On the cluster detail page, tap "Learn as Post". You should be navigated to a post page that generates an essay about the cluster topic.
result: issue
reported: "Partial pass with UI render issue: When the essay is streaming, the UI of post is not rendered correctly. Only after the full essay is completely generated, the post is then rendered correctly."
severity: major

### 7. Anchor Breadcrumb — Tappable Cluster Label
expected: Navigate to an anchor detail page. The cluster label in the breadcrumb should be tappable — tapping it navigates to `/cluster/:clusterNodeId` showing the cluster detail page.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Learn as Post button generates a post essay that renders correctly during streaming"
  status: failed
  reason: "User reported: When the essay is streaming, the UI of post is not rendered correctly. Only after the full essay is completely generated, the post is then rendered correctly."
  severity: major
  test: 6
  artifacts: []
  missing: []
