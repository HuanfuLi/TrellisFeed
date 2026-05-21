// ── Phase 55.1 BUGFIX-01 — origin-session persist gating ───────────────────
//
// Pure helper extracted to its own module so the Wave 0 test
// (AskScreen.session-binding.test.mjs) can import it via Node's native
// TypeScript stripping WITHOUT pulling in the framer-motion / react-router
// .tsx render chain (Node cannot strip `.tsx`, only `.ts`).
//
// A streaming LLM answer must be PERSISTED to the session it was requested in
// (originSessionId), and the React UI must be MUTATED only when that origin
// session is still the displayed (active) session — otherwise a slow stream
// from session A lands its answer under session B's question (the
// cross-session leak this fixes).

/** Decide where a finished stream's answer is persisted and whether the
 *  on-screen UI should be updated. `persistSessionId` is ALWAYS the originating
 *  session; `updateUI` is true only when the origin is still the active session. */
export const resolvePersistTarget = ({
  originSessionId,
  activeSessionId,
}: {
  originSessionId: string;
  activeSessionId: string;
}): { persistSessionId: string; updateUI: boolean } => ({
  persistSessionId: originSessionId,
  updateUI: originSessionId === activeSessionId,
});
