/**
 * Mock for canonical-knowledge.service.ts that implements buildAnchorReflectionTree
 * with real grouping logic (pure function, no external deps).
 * Used in e2e tests that need buildTrellisState to process real question data.
 */

export function buildAnchorReflectionTree(questions) {
  const anchorMap = new Map();
  const anchoredQAs = new Map();
  const legacyQAs = [];

  for (const q of questions) {
    if (q.flagged === true) continue;
    if (q.isClusterNode === true) continue;
    if (q.isAnchorNode === true) {
      anchorMap.set(q.id, q);
      if (!anchoredQAs.has(q.id)) anchoredQAs.set(q.id, []);
    }
  }

  for (const q of questions) {
    if (q.flagged === true) continue;
    if (q.isClusterNode === true) continue;
    if (q.isAnchorNode === true) continue;
    if (q.parentId && anchorMap.has(q.parentId)) {
      anchoredQAs.get(q.parentId).push(q);
    } else {
      legacyQAs.push(q);
    }
  }

  const grouped = new Map();

  for (const [anchorId, anchor] of anchorMap) {
    const rootLabel = anchor.rootLabel || 'Knowledge';
    const branchLabel = anchor.branchLabel || 'General concepts';
    const clusterLabel = anchor.clusterLabel || 'Open questions';

    const root = grouped.get(rootLabel) ?? new Map();
    grouped.set(rootLabel, root);
    const branch = root.get(branchLabel) ?? new Map();
    root.set(branchLabel, branch);
    const cluster = branch.get(clusterLabel) ?? { anchors: [], legacyNodes: [] };
    branch.set(clusterLabel, cluster);

    cluster.anchors.push({ anchor, qaChildren: anchoredQAs.get(anchorId) || [] });
  }

  for (const q of legacyQAs) {
    const rootLabel = q.rootLabel || 'Knowledge';
    const branchLabel = q.branchLabel || 'General concepts';
    const clusterLabel = q.clusterLabel || 'Open questions';

    const root = grouped.get(rootLabel) ?? new Map();
    grouped.set(rootLabel, root);
    const branch = root.get(branchLabel) ?? new Map();
    root.set(branchLabel, branch);
    const cluster = branch.get(clusterLabel) ?? { anchors: [], legacyNodes: [] };
    branch.set(clusterLabel, cluster);

    cluster.legacyNodes.push(q);
  }

  return Array.from(grouped.entries()).map(([rootLabel, branches]) => ({
    rootLabel,
    branches: Array.from(branches.entries()).map(([branchLabel, clusters]) => ({
      branchLabel,
      clusters: Array.from(clusters.entries()).map(([clusterLabel, data]) => ({
        clusterLabel,
        clusterEntity: undefined,
        anchors: data.anchors,
        legacyNodes: data.legacyNodes,
      })),
    })),
  }));
}
