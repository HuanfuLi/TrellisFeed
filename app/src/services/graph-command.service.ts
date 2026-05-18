// Phase 48-02 — Graph Command Service
//
// The single boundary for manual graph corrections (rename, move, merge,
// detach, prune, delete, undo). Every command:
//
//   1. Reads fresh from questionService.getAll() inside the body
//      (Pattern 1 / R10 risk 1 — no held snapshots across the mutex).
//   2. Patches via questionService.patchQuestion / .delete — the SINGLE
//      write path (R1, T-48-05). No direct localStorage writes from this file.
//   3. On success: writes EXACTLY ONE GraphEditLogEntry via
//      graphEditJournal.append.
//   4. On success: emits EXACTLY ONE typed GRAPH_UPDATED with
//      payload.kind matching the verb (D-17). delete + merge produce an
//      ADDITIONAL untyped emit from questionService.delete; subscribers
//      are idempotent per CLAUDE.md §"Event bus — unified GRAPH_UPDATED".
//   5. On failure / no-op: ZERO journal writes, ZERO command-boundary
//      emits.
//
// Plan 48-02 ships rename + move + delete fully implemented. merge,
// detach, prune, undo are stubs returning NOT_IMPLEMENTED — Plans 48-03
// + 48-04 fill them in. Stubs land here so the file structure is locked
// before Wave 3 starts (no concurrent file-structure edits).
//
// Mutex (R10 risk 9): a single shared createPromiseMutex serializes
// commands at the service boundary. Two concurrent rename calls on the
// same id will run sequentially — the second one observes the first's
// mutation via the read-fresh discipline inside the body.

import type { Question, ServiceResult } from '../types/index.ts';
import { questionService } from './question.service.ts';
import { graphEditJournal } from './graph-edit-journal.service.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { embedText } from '../providers/embedding/index.ts';
import { classifyAndAnchorIncremental } from './canonical-knowledge.service.ts';
import { createPromiseMutex } from './refill-mutex.ts';

// ─── Error codes ─────────────────────────────────────────────────────────
// String literals — Plans 03/04 tests + Phase 49 UI dispatch on these.

export type GraphCommandErrorCode =
  | 'VALIDATION_ERROR'   // empty title, length cap, same-source/target merge, cycle, no-op rename guarded earlier
  | 'NOT_FOUND'          // target id not in store
  | 'STORAGE_ERROR'      // questionService.delete returned { success: false }
  | 'NOT_IMPLEMENTED';   // Plans 03/04 stubs

// D-16 — rename hard validation (operator-trust; LLM-name normalizer bypassed).
const MAX_TITLE_LENGTH = 100;

// Shared per-process mutex (R10 risk 9). Wraps every public-method body so
// commands serialize at the boundary. Mirror of refill-mutex pattern.
const _mutex = createPromiseMutex();

function fail<T = void>(code: GraphCommandErrorCode, message: string, retryable = false): ServiceResult<T> {
  return { success: false, error: { code, message, retryable } };
}

export const graphCommandService = {
  /**
   * Rename an anchor or cluster Question. Bypasses the
   * LLM-output-cleanup normalizer per D-16 (operator typed exactly what
   * they want; that normalizer is for LLM-laziness defense, not human
   * input). Hard validation only: trim + non-empty + ≤100.
   *
   * Embedding strategy — Blocker #4 graceful degradation:
   *   - isConfigured=false  → patch title/content/summary only; OLD vector
   *                           preserved untouched (slightly stale label,
   *                           still searchable per D-11).
   *   - embed-failure       → same as above + console.warn for diagnostics.
   *   - embed-success       → patch title/content/summary/embeddingVector
   *                           atomically in a SINGLE patchQuestion call.
   *
   * Per Blocker #4 fix (revision 1): never overwrite a vector with undefined. Either the new vector replaces it atomically, or the old vector stays. Embedding-unconfigured and embed-failed paths both preserve the existing vector — retrieval identity degrades gracefully (slightly stale label) rather than silently breaking.
   */
  async rename(id: string, newTitle: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    // Validate OUTSIDE the mutex — validation is pure, no shared state.
    const trimmed = newTitle.trim();
    if (trimmed.length === 0) {
      return fail('VALIDATION_ERROR', 'Title cannot be empty.', false);
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      return fail('VALIDATION_ERROR', `Title cannot exceed ${MAX_TITLE_LENGTH} characters.`, false);
    }

    let result: ServiceResult<void> = { success: true };
    await _mutex.run(async () => {
      // Read fresh inside the mutex — Pattern 1 / R10 risk 1.
      const store = questionService.getAll({ includeFlagged: true });
      const target = store.find((q) => q.id === id);
      if (!target) {
        result = fail('NOT_FOUND', `Question ${id} not found.`, false);
        return;
      }

      // R10 risk 11 — no-op guard. Same title (post-trim) returns success
      // with NO journal entry, NO emit, NO embed call.
      const currentTitle = (target.title ?? '').trim();
      if (currentTitle === trimmed) {
        result = { success: true };
        return;
      }

      // Snapshot pre-image for the journal. embeddingVector is captured
      // REGARDLESS of whether re-embed succeeds later — undo always
      // restores to the literal pre-rename state.
      const before = {
        title: target.title,
        content: target.content,
        summary: target.summary,
        embeddingVector: target.embeddingVector,
      };

      // ─── Embedding strategy — Blocker #4 graceful degradation ─────────
      // Per Blocker #4 fix (revision 1): never overwrite a vector with undefined. Either the new vector replaces it atomically, or the old vector stays. Embedding-unconfigured and embed-failed paths both preserve the existing vector — retrieval identity degrades gracefully (slightly stale label) rather than silently breaking.
      const embCfg = settingsService.getSync().embedding;
      let newVec: number[] | undefined;
      if (embCfg?.isConfigured === true) {
        try {
          newVec = await embedText(trimmed, embCfg);
        } catch (err) {
          console.warn('[Trellis] rename re-embed failed:', err);
          newVec = undefined;
        }
      }
      // newVec is defined only when (a) embedding was configured AND
      // (b) the provider call succeeded. Otherwise it stays undefined
      // and we deliberately OMIT embeddingVector from the patch so the
      // old vector is preserved by the spread-merge inside
      // questionService.patchQuestion.
      const patch: Partial<Question> = {
        title: trimmed,
        content: trimmed,
        summary: trimmed,
      };
      if (newVec !== undefined) {
        patch.embeddingVector = newVec;
      }
      questionService.patchQuestion(id, patch);

      const after: Record<string, unknown> = {
        title: trimmed,
        content: trimmed,
        summary: trimmed,
        // Mirror what's actually stored — new vec on success, old vec on
        // either degraded path. Symmetric with `before` so undo can
        // distinguish "intentional preserve" from "intentional replace."
        embeddingVector: newVec !== undefined ? newVec : target.embeddingVector,
      };

      graphEditJournal.append({
        cmd: 'rename',
        targetIds: [id],
        before,
        after,
      });

      // D-17 — single typed emit from the command boundary.
      eventBus.emit({ type: 'GRAPH_UPDATED', payload: { kind: 'rename', anchorId: id } });

      result = { success: true };
    });
    return result;
  },

  /**
   * Move an anchor under a new cluster, or a QA under a new anchor.
   *
   * Validation:
   *   - Target + newParent must exist; targetId !== newParentId; newParent
   *     must NOT be in target's descendant subtree (cycle prevention via BFS).
   *   - If `target.parentId === newParentId`, returns success no-op
   *     (R10 risk 12 — no journal write, no emit).
   *
   * For anchor moves: patches target with parentId/clusterNodeId/branchLabel/
   * clusterLabel inherited from the new cluster + a placementReason.
   *
   * For QA moves: same field set, inherited from the new anchor (which itself
   * has been placed under a cluster).
   *
   * Side effects (NOT stored in journal per R2 — recomputed deterministically
   * on undo by walking children):
   *   - OLD parent qaCount decrements by 1 (clamped at 0).
   *   - OLD anchor nodeSummary has `[targetId] ...` line stripped.
   *   - NEW parent qaCount increments by 1.
   *   - NEW anchor nodeSummary appends `[targetId] <shortSummary or content.slice(0,80)>`.
   *
   * Emits ONE typed GRAPH_UPDATED with payload.kind === 'move' from the
   * command boundary on success (D-17). affectedIds includes the target,
   * the new parent, and the old parent (when defined).
   */
  async move(id: string, newParentId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    // Validate id !== newParentId OUTSIDE the mutex — pure check.
    if (id === newParentId) {
      return fail('VALIDATION_ERROR', 'A node cannot be its own parent.', false);
    }

    let result: ServiceResult<void> = { success: true };
    await _mutex.run(async () => {
      const store = questionService.getAll({ includeFlagged: true });
      const target = store.find((q) => q.id === id);
      if (!target) {
        result = fail('NOT_FOUND', `Question ${id} not found.`, false);
        return;
      }
      const newParent = store.find((q) => q.id === newParentId);
      if (!newParent) {
        result = fail('NOT_FOUND', `New parent ${newParentId} not found.`, false);
        return;
      }

      // R10 risk 12 — same-parent no-op. No journal, no emit.
      if (target.parentId === newParentId) {
        result = { success: true };
        return;
      }

      // Cycle prevention: newParent must NOT be a descendant of target.
      // BFS from target.id over children-by-parentId. If we encounter
      // newParentId, the move would create a cycle.
      const descendants = new Set<string>();
      const queue: string[] = [id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const q of store) {
          if (q.parentId === current && !descendants.has(q.id)) {
            descendants.add(q.id);
            queue.push(q.id);
          }
        }
      }
      if (descendants.has(newParentId)) {
        result = fail('VALIDATION_ERROR', `Cannot move ${id} under its own descendant ${newParentId} — would create a cycle.`, false);
        return;
      }

      // Snapshot pre-image for journal (compact placement fields per R2).
      const before = {
        parentId: target.parentId,
        clusterNodeId: target.clusterNodeId,
        branchLabel: target.branchLabel,
        clusterLabel: target.clusterLabel,
        placementReason: target.placementReason,
      };

      // Build new placement based on whether target is an anchor or QA.
      // Anchor move → inherits from cluster (clusterNodeId = newParent.id since
      // newParent IS the cluster). QA move → inherits from anchor (clusterNodeId
      // = newParent.clusterNodeId — the anchor's own cluster).
      const isAnchorMove = target.isAnchorNode === true;
      const newPatch: Partial<Question> = isAnchorMove
        ? {
            parentId: newParent.id,
            clusterNodeId: newParent.id,
            branchLabel: newParent.branchLabel,
            clusterLabel: newParent.clusterLabel ?? newParent.title,
            placementReason: `Manually moved under ${newParent.branchLabel ?? '?'} > ${newParent.title ?? newParent.id}`,
          }
        : {
            parentId: newParent.id,
            clusterNodeId: newParent.clusterNodeId,
            branchLabel: newParent.branchLabel,
            clusterLabel: newParent.clusterLabel,
            placementReason: `Manually moved under ${newParent.branchLabel ?? '?'} > ${newParent.clusterLabel ?? '?'} > ${newParent.title ?? newParent.id}`,
          };

      questionService.patchQuestion(id, newPatch);

      // ── OLD parent side effects ──
      const oldParentId = target.parentId;
      if (oldParentId) {
        const oldParent = store.find((q) => q.id === oldParentId);
        if (oldParent) {
          const newOldQaCount = Math.max(0, (oldParent.qaCount ?? 1) - 1);
          const oldPatch: Partial<Question> = { qaCount: newOldQaCount };
          if (oldParent.isAnchorNode && oldParent.nodeSummary) {
            // Strip the `[id] ...` line for the moved child.
            const filtered = oldParent.nodeSummary
              .split('\n')
              .filter((line) => !line.startsWith(`[${id}]`))
              .join('\n');
            oldPatch.nodeSummary = filtered;
          }
          questionService.patchQuestion(oldParentId, oldPatch);
        }
      }

      // ── NEW parent side effects ──
      const newParentQaCount = (newParent.qaCount ?? 0) + 1;
      const newParentPatch: Partial<Question> = { qaCount: newParentQaCount };
      if (newParent.isAnchorNode) {
        // Warning #3 verified — `shortSummary?: string` exists on Question.
        const lineText = target.shortSummary ?? (target.content ? target.content.slice(0, 80) : '');
        const line = `[${id}] ${lineText}`;
        newParentPatch.nodeSummary = newParent.nodeSummary
          ? `${newParent.nodeSummary}\n${line}`
          : line;
      }
      questionService.patchQuestion(newParentId, newParentPatch);

      // Journal — compact diff per R2. Side effects on old/new parents are
      // recomputed deterministically on undo by walking children.
      const after = {
        parentId: newPatch.parentId,
        clusterNodeId: newPatch.clusterNodeId,
        branchLabel: newPatch.branchLabel,
        clusterLabel: newPatch.clusterLabel,
        placementReason: newPatch.placementReason,
      };
      graphEditJournal.append({
        cmd: 'move',
        targetIds: [id],
        before,
        after,
      });

      // D-17 — single typed emit from command boundary.
      const affectedIds = [id, newParentId, ...(oldParentId ? [oldParentId] : [])];
      eventBus.emit({
        type: 'GRAPH_UPDATED',
        payload: { kind: 'move', anchorId: id, affectedIds },
      });

      result = { success: true };
    });
    return result;
  },

  /**
   * Hard-delete a Question. Cascades children to the grandparent (single
   * level only per R10 risk 7):
   *   - Anchor delete: children re-parent to the anchor's parentId (the
   *     cluster); inherit cluster's clusterNodeId / branchLabel /
   *     clusterLabel.
   *   - Cluster delete: child anchors re-parent to ROOT (all placement
   *     fields cleared to undefined). The QAs attached to those anchors
   *     are NOT touched — single-level cascade only.
   *   - Leaf QA delete: no cascade.
   *
   * Blocker #2 — abort-before-journal on storage failure: questionService.
   * delete returns Promise<ServiceResult<void>>. If it reports
   * { success: false }, we return STORAGE_ERROR WITHOUT writing a journal
   * entry and WITHOUT emitting from the command boundary. (Children have
   * already been re-parented; this is acceptable partial state — they are
   * in a valid placement matching what a successful retry would produce,
   * and the no-op guards in subsequent commands prevent double-reparent.
   * See T-48-14 disposition.)
   *
   * Warning #4 — double-emit accepted:
   * questionService.delete at question.service.ts:569 already emits an
   * UNTYPED { type: 'GRAPH_UPDATED' }. We emit a SECOND, typed event with
   * payload.kind === 'delete' from the command boundary AFTER the delete
   * succeeds AND the journal entry is appended. Subscribers are already
   * idempotent per CLAUDE.md §"Event bus — unified GRAPH_UPDATED" —
   * re-reading the store twice is harmless. The LAST event observed has
   * payload.kind === 'delete' (subscriber dedup pattern works as expected).
   */
  async delete(id: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<{ cascadedChildIds: string[] }>> {
    let result: ServiceResult<{ cascadedChildIds: string[] }> = {
      success: true,
      data: { cascadedChildIds: [] },
    };

    await _mutex.run(async () => {
      const store = questionService.getAll({ includeFlagged: true });
      const target = store.find((q) => q.id === id);
      if (!target) {
        result = fail<{ cascadedChildIds: string[] }>('NOT_FOUND', `Question ${id} not found.`, false);
        return;
      }

      const children = store.filter((q) => q.parentId === id);

      // Snapshot pre-image per D-04. deletedRecord is the FULL Question so
      // undo can resurrect verbatim. reparentedChildren stores only IDs +
      // OLD placement fields (not full records) per R10 risk 3 — children
      // stay in the store, only their parentage changed.
      const deletedRecord: Record<string, unknown> = { ...target };
      const reparentedChildren = children.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        clusterNodeId: c.clusterNodeId,
        branchLabel: c.branchLabel,
        clusterLabel: c.clusterLabel,
      }));

      // Compute new placement for cascading children based on target kind.
      // Anchor → children inherit anchor's parent (cluster). Cluster →
      // child anchors orphan to root (single-level cascade per R10 risk 7).
      // Leaf QA → children list is empty, this loop is a no-op.
      const isClusterTarget = target.isClusterNode === true;
      for (const child of children) {
        const childPatch: Partial<Question> = isClusterTarget
          ? {
              parentId: undefined,
              clusterNodeId: undefined,
              branchLabel: undefined,
              clusterLabel: undefined,
            }
          : {
              parentId: target.parentId,
              clusterNodeId: target.clusterNodeId,
              branchLabel: target.branchLabel,
              clusterLabel: target.clusterLabel,
            };
        questionService.patchQuestion(child.id, childPatch);
      }

      // Blocker #2 — inspect ServiceResult.success BEFORE journal/emit.
      const deleteResult = await questionService.delete(id);
      if (deleteResult.success === false) {
        // Abort BEFORE journal append AND BEFORE command-boundary emit.
        // Children have already been re-parented — acceptable partial
        // state per T-48-14; operator can retry.
        const msg = deleteResult.error?.message ?? 'Hard delete failed.';
        result = fail<{ cascadedChildIds: string[] }>('STORAGE_ERROR', msg, true);
        return;
      }

      // Success — append journal entry, then emit typed GRAPH_UPDATED.
      graphEditJournal.append({
        cmd: 'delete',
        targetIds: [id],
        before: { deletedRecord, reparentedChildren },
        after: {},
      });

      // NOTE: questionService.delete already emitted an untyped
      // GRAPH_UPDATED at question.service.ts:569. We emit a SECOND, typed
      // GRAPH_UPDATED here so subscribers that filter on payload.kind ===
      // 'delete' see the discriminator. Subscribers are already idempotent
      // per CLAUDE.md §"Event bus — unified GRAPH_UPDATED" — re-reading
      // the store twice is harmless. The LAST event observed has
      // payload.kind === 'delete' (subscriber dedup pattern works as
      // expected).
      eventBus.emit({
        type: 'GRAPH_UPDATED',
        payload: {
          kind: 'delete',
          anchorId: id,
          affectedIds: [id, ...children.map((c) => c.id)],
        },
      });

      result = { success: true, data: { cascadedChildIds: children.map((c) => c.id) } };
    });

    return result;
  },

  // ─── Plan 48-03 ──────────────────────────────────────────────────────────

  /**
   * Merge loser anchor into survivor. Reparents loser's children to
   * survivor (D-09), recomputes survivor qaCount + nodeSummary (D-11),
   * re-embeds survivor's title (D-11), hard-deletes loser (D-10).
   *
   * Direction is operator-supplied (D-07); service does NOT auto-pick by
   * heuristic. Survivor preserves its title / clusterNodeId / parentId /
   * branchLabel / clusterLabel (D-08) — cross-cluster merge case:
   * survivor's cluster wins.
   *
   * Blocker #2 — abort-before-journal on storage failure: questionService.
   * delete returns Promise<ServiceResult<void>>. If it reports
   * { success: false }, we return STORAGE_ERROR WITHOUT writing a journal
   * entry and WITHOUT emitting from the command boundary. Survivor +
   * children are left in their re-parented / recomputed state — acceptable
   * partial state per T-48-14 (operator can retry; the no-op nature of
   * re-running patchQuestion with the same values prevents corruption).
   *
   * Blocker #4 — graceful survivor re-embed (mirrors rename's strategy):
   *   - isConfigured=false  → skip embed entirely. Patch survivor with
   *                           { qaCount, nodeSummary } only; OLD vector
   *                           preserved by spread-merge.
   *   - embed rejects       → catch + console.warn; same patch shape as
   *                           the unconfigured path. OLD vector preserved.
   *   - embed succeeds      → patch survivor with { qaCount, nodeSummary,
   *                           embeddingVector } atomically in a SINGLE
   *                           patchQuestion call.
   *
   * Per Blocker #4 fix (revision 1): never overwrite a vector with undefined. Either the new vector replaces it atomically, or the old vector stays. Mirrors rename's strategy and preserves D-11 retrieval-identity-degrades-gracefully.
   *
   * Warning #4 — double-emit accepted: questionService.delete(loserId)
   * emits an untyped GRAPH_UPDATED at question.service.ts:569. The
   * command boundary emits a SECOND, typed GRAPH_UPDATED with
   * payload.kind === 'merge' AFTER delete succeeds AND journal append.
   * The LAST event observed has the discriminator; subscribers are
   * already idempotent per CLAUDE.md §"Event bus — unified GRAPH_UPDATED".
   */
  async merge(loserId: string, survivorId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<{ reparentedCount: number; newSurvivorQaCount: number }>> {
    // R10 risk 13 — self-merge validation OUTSIDE the mutex (pure check).
    if (loserId === survivorId) {
      return fail<{ reparentedCount: number; newSurvivorQaCount: number }>(
        'VALIDATION_ERROR',
        'Cannot merge a node into itself.',
        false,
      );
    }

    let result: ServiceResult<{ reparentedCount: number; newSurvivorQaCount: number }> = {
      success: true,
      data: { reparentedCount: 0, newSurvivorQaCount: 0 },
    };

    await _mutex.run(async () => {
      // Read fresh inside the mutex — Pattern 1 / R10 risk 1.
      const store = questionService.getAll({ includeFlagged: true });
      const loser = store.find((q) => q.id === loserId);
      if (!loser) {
        result = fail<{ reparentedCount: number; newSurvivorQaCount: number }>(
          'NOT_FOUND',
          `Loser ${loserId} not found.`,
          false,
        );
        return;
      }
      const survivor = store.find((q) => q.id === survivorId);
      if (!survivor) {
        result = fail<{ reparentedCount: number; newSurvivorQaCount: number }>(
          'NOT_FOUND',
          `Survivor ${survivorId} not found.`,
          false,
        );
        return;
      }

      const children = store.filter((q) => q.parentId === loserId);

      // Snapshot pre-image for journal per D-04.
      //   - before.loser = FULL Question so undo can resurrect verbatim.
      //   - before.survivor = pre-merge values for fields we modify
      //     (qaCount, nodeSummary, embeddingVector) so undo can restore.
      //   - before.reparentedChildren = compact diff per child (OLD
      //     parentage fields) — children stay in store, only parentage
      //     changed (mirror of delete's reparentedChildren shape).
      const before = {
        loser: { ...loser },
        survivor: {
          qaCount: survivor.qaCount,
          embeddingVector: survivor.embeddingVector,
          nodeSummary: survivor.nodeSummary,
        },
        reparentedChildren: children.map((c) => ({
          id: c.id,
          parentId: c.parentId,
          clusterNodeId: c.clusterNodeId,
          branchLabel: c.branchLabel,
          clusterLabel: c.clusterLabel,
        })),
      };

      // ── Reparent children — survivor's parentage fields win (D-08/D-09) ──
      for (const child of children) {
        questionService.patchQuestion(child.id, {
          parentId: survivorId,
          clusterNodeId: survivor.clusterNodeId,
          branchLabel: survivor.branchLabel,
          clusterLabel: survivor.clusterLabel,
        });
      }

      // ── Build new survivor nodeSummary ──
      // Append `[childId] shortSummary` (Warning #3 — fallback to
      // content.slice(0, 80) when shortSummary undefined).
      const appendedLines = children.map((c) => {
        const lineText = c.shortSummary ?? (c.content ? c.content.slice(0, 80) : '');
        return `[${c.id}] ${lineText}`;
      });
      const newNodeSummary = survivor.nodeSummary
        ? [survivor.nodeSummary, ...appendedLines].join('\n')
        : appendedLines.join('\n');

      // ── New survivor qaCount (D-11) = old + reparented count ──
      const newQaCount = (survivor.qaCount ?? 0) + children.length;

      // ── Embedding strategy — Blocker #4 graceful degradation ──
      // Per Blocker #4 fix (revision 1): never overwrite a vector with undefined. Either the new vector replaces it atomically, or the old vector stays. Mirrors rename's strategy and preserves D-11 retrieval-identity-degrades-gracefully.
      const embCfg = settingsService.getSync().embedding;
      let newVec: number[] | undefined;
      if (embCfg?.isConfigured === true) {
        try {
          newVec = await embedText(survivor.title ?? survivor.content ?? '', embCfg);
        } catch (err) {
          console.warn('[Trellis] merge survivor re-embed failed:', err);
          newVec = undefined;
        }
      }
      const survivorPatch: Partial<Question> = {
        qaCount: newQaCount,
        nodeSummary: newNodeSummary,
      };
      if (newVec !== undefined) {
        survivorPatch.embeddingVector = newVec;
      }
      questionService.patchQuestion(survivorId, survivorPatch);

      // ── Blocker #2 — hard-delete loser AFTER reparent + survivor update ──
      // Inspect ServiceResult.success BEFORE journal + command-boundary emit.
      const deleteResult = await questionService.delete(loserId);
      if (deleteResult.success === false) {
        // Abort BEFORE journal append AND BEFORE command-boundary emit.
        // Children + survivor are in their updated state — acceptable
        // partial per T-48-14; operator can retry.
        const msg = deleteResult.error?.message ?? 'Hard delete of loser failed.';
        result = fail<{ reparentedCount: number; newSurvivorQaCount: number }>(
          'STORAGE_ERROR',
          msg,
          true,
        );
        return;
      }

      // Success — append journal entry, then emit typed GRAPH_UPDATED.
      graphEditJournal.append({
        cmd: 'merge',
        targetIds: [loserId, survivorId],
        before,
        after: {
          reparentedCount: children.length,
          newSurvivorQaCount: newQaCount,
        },
      });

      // NOTE: questionService.delete(loserId) at step "delete" already
      // emitted an untyped GRAPH_UPDATED (question.service.ts:569). We
      // emit a SECOND, typed GRAPH_UPDATED here so subscribers that
      // filter on payload.kind === 'merge' see the discriminator.
      // Subscribers are already idempotent per CLAUDE.md §"Event bus —
      // unified GRAPH_UPDATED" — re-reading store twice is harmless. The
      // LAST event observed has payload.kind === 'merge' (subscriber
      // dedup pattern).
      eventBus.emit({
        type: 'GRAPH_UPDATED',
        payload: {
          kind: 'merge',
          anchorId: survivorId,
          affectedIds: [loserId, survivorId, ...children.map((c) => c.id)],
        },
      });

      result = {
        success: true,
        data: { reparentedCount: children.length, newSurvivorQaCount: newQaCount },
      };
    });

    return result;
  },

  /**
   * Detach a Q&A from its anchor — clear placement fields then fire
   * classifyAndAnchorIncremental to find a new home (D-13). Operator's
   * intent: "this Q&A is misplaced, find it a better home." May no-op
   * (classify routes back to the original anchor) — Phase 49 may surface
   * a toast.
   *
   * Side effects:
   *   - Target patched with parentId/branchLabel/clusterLabel/clusterNodeId/
   *     nodeSummary/placementReason ALL undefined.
   *   - Old parent's qaCount decrements (clamped at 0); if old parent is
   *     an anchor, its nodeSummary strips the matching `[targetId] ` line
   *     (mirrors move's old-parent update).
   *
   * Validation:
   *   - Target must be a QA (NOT an anchor or cluster). Rejects with
   *     VALIDATION_ERROR otherwise.
   *   - NOT_FOUND for missing target.
   *
   * No-op (R10 risk 14):
   *   - If target.parentId is already undefined, returns success without
   *     writing a journal entry, emitting GRAPH_UPDATED, or firing the
   *     classification call.
   *
   * Warning #2 — AbortSignal threading: opts?.signal is forwarded to
   * classifyAndAnchorIncremental. LOCALE_CHANGED (Phase 27 D-22) or any
   * operator-initiated abort cancels the in-flight classify at its next
   * checkpoint.
   */
  async detach(qaId: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    let result: ServiceResult<void> = { success: true };

    await _mutex.run(async () => {
      const store = questionService.getAll({ includeFlagged: true });
      const target = store.find((q) => q.id === qaId);
      if (!target) {
        result = fail('NOT_FOUND', `Question ${qaId} not found.`, false);
        return;
      }

      // Detach is for QA nodes only — rejecting anchor/cluster targets
      // matches D-13's UX intent ("re-route this question").
      if (target.isAnchorNode === true || target.isClusterNode === true) {
        result = fail(
          'VALIDATION_ERROR',
          'Can only detach Q&A nodes, not anchors or clusters.',
          false,
        );
        return;
      }

      // R10 risk 14 — no-op when target is already orphaned.
      if (target.parentId === undefined) {
        result = { success: true };
        return;
      }

      // Snapshot pre-image per D-04.
      const before = {
        parentId: target.parentId,
        branchLabel: target.branchLabel,
        clusterLabel: target.clusterLabel,
        clusterNodeId: target.clusterNodeId,
        nodeSummary: target.nodeSummary,
        placementReason: target.placementReason,
      };

      // Old parent side effects (mirror move's old-parent update).
      const oldParentId = target.parentId;
      const oldParent = store.find((q) => q.id === oldParentId);
      if (oldParent) {
        const newOldQaCount = Math.max(0, (oldParent.qaCount ?? 1) - 1);
        const oldPatch: Partial<Question> = { qaCount: newOldQaCount };
        if (oldParent.isAnchorNode && oldParent.nodeSummary) {
          const filtered = oldParent.nodeSummary
            .split('\n')
            .filter((line) => !line.startsWith(`[${qaId}]`))
            .join('\n');
          oldPatch.nodeSummary = filtered;
        }
        questionService.patchQuestion(oldParentId, oldPatch);
      }

      // Clear placement on the target.
      questionService.patchQuestion(qaId, {
        parentId: undefined,
        branchLabel: undefined,
        clusterLabel: undefined,
        clusterNodeId: undefined,
        nodeSummary: undefined,
        placementReason: undefined,
      });

      // Journal entry — one per command per D-17.
      graphEditJournal.append({
        cmd: 'detach',
        targetIds: [qaId],
        before,
        after: { classificationFired: true },
      });

      // D-17 — single typed emit from THIS command. Downstream classify's
      // emit is its own command per R7.
      eventBus.emit({
        type: 'GRAPH_UPDATED',
        payload: {
          kind: 'detach',
          anchorId: qaId,
          affectedIds: [qaId, ...(oldParentId ? [oldParentId] : [])],
        },
      });

      // Fire-and-forget re-classification — D-13 / D-18 (commands sync,
      // detach exception). Mirror question.service.ts:340-342.
      // NOTE: classifyAndAnchorIncremental emits its OWN GRAPH_UPDATED upon
      // completion (canonical-knowledge.service.ts). This is a second emit
      // — but it's from a downstream COMMAND, not a duplicate. Subscribers
      // re-read twice. Per R7 documented intentional behavior. opts?.signal
      // is forwarded so LOCALE_CHANGED (Phase 27 D-22) or operator-initiated
      // cancel terminates the classify cleanly (Warning #2 fix — test
      // asserts signal.aborted is observed at the next checkpoint).
      const allQuestionsAfter = questionService.getAll({ includeFlagged: true });
      const targetAfter = allQuestionsAfter.find((q) => q.id === qaId);
      if (targetAfter) {
        const llmConfig = settingsService.getSync().llm;
        void classifyAndAnchorIncremental(
          targetAfter,
          allQuestionsAfter,
          llmConfig,
          opts?.signal,
        ).catch((err: unknown) => {
          console.warn(
            '[Trellis] detach re-classify failed:',
            err instanceof Error ? err.message : err,
          );
        });
      }

      result = { success: true };
    });

    return result;
  },

  async prune(_anchorId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    return fail('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  // ─── Plan 48-04 stub ─────────────────────────────────────────────────────

  async undo(): Promise<ServiceResult<{ undoneCmd: string; targetIds: string[]; summary: string }>> {
    return fail<{ undoneCmd: string; targetIds: string[]; summary: string }>('NOT_IMPLEMENTED', 'See Plan 48-04.', false);
  },
};
