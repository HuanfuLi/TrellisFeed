/**
 * Cold-start profiler (Phase 55.1-07, GAP-C / BUGFIX-06).
 *
 * INSTRUMENT-FIRST helper for localizing the ~1-min first-Q&A-roundtrip stall.
 * Lightweight `performance.now()` timing spans gated behind a debug flag so they
 * are NO-OPS in normal runs. The first-ask path in `useQuestions.askStreaming`
 * wraps each phase (filter/embed → context pack → chatStream TTFT) with `span()`;
 * on first-ask completion `flush()` emits a single console table (phase → ms).
 *
 * The gate is `localStorage.getItem('trellis_cold_start_profile') === 'true'`
 * (mirrors the existing `trellis_dev_mode` debug-flag pattern in
 * trellis-state.service.ts). When the gate is off, `span()` returns a no-op
 * stop function and records nothing, so normal-path behavior is unchanged.
 *
 * The profiler is single-shot per process by design: it captures the FIRST ask
 * (the only cold one) and then stays inert. This keeps the warm path (2nd+ ask)
 * untouched and avoids polluting the console on every subsequent question.
 *
 * NOTE: this helper measures the IN-PROCESS phases (filter/embed, context
 * assembly, chatStream time-to-first-token). The live provider TLS/handshake +
 * model warm-up is captured in the same chatStream span on a real device — read
 * the device console table for that wall-clock number.
 */

export const COLD_START_PROFILE_KEY = 'questiontrace_cold_start_profile';

function gateOn(): boolean {
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(COLD_START_PROFILE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface ProfilerState {
  enabled: boolean;
  flushed: boolean;
  phases: { phase: string; ms: number }[];
}

// Module-singleton state. Single-shot: once flushed, subsequent spans are inert
// so only the (cold) first ask is profiled.
const _state: ProfilerState = { enabled: false, flushed: false, phases: [] };

const _now = (): number =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();

/**
 * Opens a timing span for `phase`. Returns a `stop()` function to close it.
 * When the gate is off OR the profiler has already flushed, both `span()` and
 * the returned `stop()` are no-ops (zero overhead, nothing recorded).
 *
 * Usage:
 *   const stop = coldStartProfiler.span('filterQuestion');
 *   await filterQuestion(...);
 *   stop();
 */
export function span(phase: string): () => void {
  if (_state.flushed) return () => {};
  if (!_state.enabled) {
    // Re-read the gate lazily on the first span of a run so toggling the flag
    // in DevTools mid-session is picked up without a reload.
    _state.enabled = gateOn();
    if (!_state.enabled) return () => {};
  }
  const start = _now();
  return () => {
    if (_state.flushed) return;
    _state.phases.push({ phase, ms: Math.round((_now() - start) * 100) / 100 });
  };
}

/**
 * Emits the collected per-phase split as a single console table and marks the
 * profiler flushed (single-shot — subsequent spans are inert). No-op when the
 * gate is off or there is nothing recorded. Safe to call unconditionally on
 * first-ask completion.
 */
export function flush(): void {
  if (_state.flushed || !_state.enabled || _state.phases.length === 0) return;
  _state.flushed = true;
  const total = _state.phases.reduce((acc, p) => acc + p.ms, 0);
  const rows = _state.phases.map((p) => ({
    phase: p.phase,
    ms: p.ms,
    pct: total > 0 ? `${Math.round((p.ms / total) * 1000) / 10}%` : '—',
  }));
  // eslint-disable-next-line no-console
  console.info('[Trellis] cold-start first-ask phase split (total %oms):', Math.round(total));
  // console.table is available in browser + WebView devtools and Node.
  // eslint-disable-next-line no-console
  console.table?.(rows);
}

/** Test-only: returns the recorded phases (for the profiling script + invariant test). */
export function _getPhases(): { phase: string; ms: number }[] {
  return _state.phases.slice();
}

/** Test-only: resets the single-shot state so a test can drive multiple runs. */
export function _reset(): void {
  _state.enabled = false;
  _state.flushed = false;
  _state.phases = [];
}

export const coldStartProfiler = { span, flush, _getPhases, _reset, COLD_START_PROFILE_KEY };
