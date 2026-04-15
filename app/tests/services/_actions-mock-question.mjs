/**
 * Mock for question.service.ts — used in trellis-actions tests.
 * Uses a simple in-memory store so patchQuestion/getAll/getPrunedQuestions
 * behave correctly without SQLite or LLM dependencies.
 */

let _store = [];

export function _resetStore(questions) {
  _store = questions ? [...questions] : [];
}

export function _getStore() {
  return [..._store];
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
    _store = _store.filter((q) => q.id !== questionId);
  },
};
