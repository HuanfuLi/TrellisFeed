// Phase 48-02 — Graph Command Service
//
// The single boundary for manual graph corrections (rename, move, merge,
// detach, prune, delete, undo). Every command:
//
//   1. Reads fresh from questionService.getAll() inside the body
//      (Pattern 1 / R10 risk 1 — no held snapshots across the mutex).
//   2. Patches via questionService.patchQuestion / .delete — the SINGLE
//      write path (R1, T-48-05). No direct localStorage.setItem.
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
   * Hard-delete a Question. Cascades children to grandparent (anchor→cluster,
   * cluster→root). Plan 48-02 Task 3 fills this in.
   */
  async delete(_id: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<{ cascadedChildIds: string[] }>> {
    return fail<{ cascadedChildIds: string[] }>('NOT_IMPLEMENTED', 'delete() is implemented in Plan 48-02 Task 3.', false);
  },

  // ─── Plan 48-03 stubs ────────────────────────────────────────────────────

  async merge(_loserId: string, _survivorId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<{ reparentedCount: number; newSurvivorQaCount: number }>> {
    return fail<{ reparentedCount: number; newSurvivorQaCount: number }>('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  async detach(_qaId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    return fail('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  async prune(_anchorId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    return fail('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  // ─── Plan 48-04 stub ─────────────────────────────────────────────────────

  async undo(): Promise<ServiceResult<{ undoneCmd: string; targetIds: string[]; summary: string }>> {
    return fail<{ undoneCmd: string; targetIds: string[]; summary: string }>('NOT_IMPLEMENTED', 'See Plan 48-04.', false);
  },
};
