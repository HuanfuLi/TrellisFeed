# Phase 15: Cluster Detail System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 15-cluster-detail-system
**Areas discussed:** Cluster node creation timing, Cluster identity fields, Bottom panel differentiation, Cluster-to-anchor relationship
**Mode:** --auto (recommended defaults selected)

---

## Cluster Node Creation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| During classifyAndAnchor | Create cluster entity alongside anchor creation — consistent with anchor pattern | ✓ |
| Retroactive generation | Generate cluster nodes on-demand when graph is viewed | |
| Background migration | Batch-create cluster nodes from existing clusterLabel strings | |

**User's choice:** [auto] During classifyAndAnchor (recommended default)
**Notes:** Mirrors anchor creation pattern. Cluster resolved before anchor, anchor gets `clusterNodeId`.

---

## Cluster Identity Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror anchor pattern | isClusterNode, qaCount (aggregated), nodeSummary (aggregated), title = clusterLabel | ✓ |
| Minimal flag only | isClusterNode flag, derive everything dynamically | |
| Separate schema | New ClusterNode type distinct from Question | |

**User's choice:** [auto] Mirror anchor pattern (recommended default)
**Notes:** Keeps the system consistent — clusters, anchors, and Q&As all stored as Question entities with type flags.

---

## Bottom Panel Differentiation

| Option | Description | Selected |
|--------|-------------|----------|
| Same layout, different label | "KNOWLEDGE CLUSTER — N concepts, M Q&As" vs "CONCEPT ANCHOR — N Q&As" | ✓ |
| Distinct panel style | Different colors/layout for cluster vs anchor | |
| Unified panel | Same label style, auto-detect node type | |

**User's choice:** [auto] Same layout, different label (recommended default)
**Notes:** Consistent UX, minimal new code.

---

## Cluster-to-Anchor Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| clusterNodeId field | Explicit ID reference on anchors, mirrors parentId pattern | ✓ |
| Match by clusterLabel string | Dynamic grouping by label match | |
| Both | ID for fast lookup, label as fallback | |

**User's choice:** [auto] clusterNodeId field (recommended default)
**Notes:** Explicit ID reference is more reliable than string matching. Consistent with Q&A → anchor `parentId` pattern.

---

## Pre-discussion User Decisions (from conversation)

These decisions were made by the user before --auto mode:
1. **Cluster nodes stored as entities** (not dynamic) — user explicitly chose this
2. **Breadcrumb cluster label tappable** — user confirmed both entry points (graph + breadcrumb)
3. **Post generation uses nodeSummary only** — user explicitly chose this over full Q&A answers

## Claude's Discretion

- Visual styling details for cluster panel and detail page
- Edge case handling (empty clusters, missing nodes)
- Real-time vs deferred aggregation updates

## Deferred Ideas

- Branch-level detail pages
- Cluster-level podcast generation
- Legacy node migration
