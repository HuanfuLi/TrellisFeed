/**
 * Mock for question.service.ts — used in trellis-actions tests AND
 * Plan 48-02 graph-command tests.
 *
 * Uses a simple in-memory store so patchQuestion/getAll/getPrunedQuestions/
 * delete behave correctly without SQLite or LLM dependencies.
 *
 * Plan 48-02 additions:
 *   - delete() now returns ServiceResult<void> matching the real signature
 *     at question.service.ts:565-571 (Blocker #2 — callers must inspect
 *     result.success before journaling).
 *   - delete() emits the untyped GRAPH_UPDATED event the real impl emits
 *     at question.service.ts:569 (so the double-emit assertion in
 *     graph-command-service.delete.test.mjs is honored).
 *   - _setDeleteFail(true) forces delete() to return { success: false }
 *     so the Blocker #2 abort-before-journal path can be tested.
 */

let _store = [];
let _deleteFail = false;

export function _resetStore(questions) {
  _store = questions ? [...questions] : [];
  _deleteFail = false;
}

export function _getStore() {
  return [..._store];
}

export function _setDeleteFail(fail) {
  _deleteFail = !!fail;
}

export const questionService = {
  getAll(opts) {
    return opts?.includeFlagged
      ? [..._store]
      : _store.filter((q) => !q.flagged);
  },

  getPrunedQuestions() {
    return _store.filter((q) => q.flagged === true && q.prunedFromTrellis === true);
  },

  patchQuestion(questionId, patch) {
    const idx = _store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      _store[idx] = { ..._store[idx], ...patch };
    }
  },

  async delete(questionId) {
    if (_deleteFail) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'mock delete forced failure', retryable: true },
      };
    }
    _store = _store.filter((q) => q.id !== questionId);
    // Mirror real impl: emit QUESTION_DELETED + (untyped) GRAPH_UPDATED.
    // The eventBus is imported lazily so we don't create a module-load
    // ordering trap when the mock is registered.
    const { eventBus } = await import('../../src/lib/event-bus.ts');
    eventBus.emit({ type: 'QUESTION_DELETED', payload: { id: questionId } });
    eventBus.emit({ type: 'GRAPH_UPDATED' });
    return { success: true };
  },
};
