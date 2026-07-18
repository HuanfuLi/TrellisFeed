// Hybrid question classifier — narrow regex (Layer 1) + embedding-similarity
// (Layer 2). Phase 47 rewrite per D-07 / D-08 / D-11 / D-12 / D-19.
//
// This is a LEAF module: zero static imports of settings.service / locales
// bundles. Settings access happens via lazy `await import('./settings.service.ts')`
// inside evaluateQuestion so node --test can import this file directly without
// hitting the JSON-import-attribute failure chain (CLAUDE.md i18n testing rule).
//
// ─── Why the rewrite ─────────────────────────────────────────────────────────
//
// The prior implementation paired a broad regex pattern library with a "LLM
// fallback for low-confidence cases" — but the LLM fallback only fired when
// pattern confidence was in `(0, 0.75)`, which never happened in practice.
// Both surfaced production failures:
//   - "How are you doing?"  → no regex match → confidence=0 → fallback skipped
//                              → classified as on-topic (false negative)
//   - "What is a system prompt?" → regex hits 0.92 → fallback skipped
//                              → classified as off-topic/malicious (false positive)
//
// Phase 47 replaces the dead LLM fallback with embedding-similarity over a
// curated corpus (Layer 2) so the second layer actually runs. Layer 1 is
// narrowed to unambiguous greetings/acks/single-token spam/"how are you" with
// strict ^...$ anchors + a length guard. D-08 pushes the broader patterns
// (system-prompt inquiries, jailbreak attempts, sarcasm) into the corpus.
//
// ─── Three labels per ask (D-01) ─────────────────────────────────────────────
//
//   - 'malicious'  → caller MUST skip the answer LLM call; bracketing (D-13) is
//                    the secondary safety net for anything Layer 2 misses.
//   - 'off-topic'  → caller proceeds with the answer LLM but marks the resulting
//                    Question `flagged: true`; downstream consumers skip flagged
//                    Q&A; user can override per FILTER-05.
//   - 'on-topic'   → caller proceeds normally; classifyAndAnchorIncremental fires.
//
// ─── Failure path (D-12) ─────────────────────────────────────────────────────
//
// embedding-provider down, no API key, signal aborted, etc. → direct imperative
// override/extraction commands are still rejected locally; ambiguous semantic
// cases return `{label: 'on-topic'}` and retain prompt bracketing downstream.

import type { EmbeddingConfig } from '../types/index.ts';
import { embedText, cosine } from '../providers/embedding/index.ts';
import {
  loadCorpusEmbeddings,
  type FilterCorpusEntry,
  type FilterLabel,
} from './filter-corpus.service.ts';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Session context for follow-up questions. End-to-end plumbed through
 * useQuestions.askStreaming → question.service.ask → evaluateQuestion.
 *
 * Do NOT change shape — call sites at useQuestions.ts:9 and
 * question.service.ts:15 import this verbatim.
 */
export interface QuestionFilterContext {
  /** The immediately preceding user question. */
  priorQuestion?: string;
  /** The AI response to the prior question. */
  priorAnswer?: string;
}

export type { FilterLabel };

export interface FilterResult {
  label: FilterLabel;
  /** Internal scoring for dev console + eval-test debug only (D-04/D-05). */
  bestMatch?: { label: FilterLabel; exemplar: string; score: number };
}

// ─── RAW-ARGMAX decision rule (Phase 55 — 55-FILTER-TUNING-REPORT.md) ─────────
//
// The classifier no longer uses absolute off-topic/malicious cosine thresholds.
// Empirical tuning (qwen3-8b + OpenAI-3-small @256/@1536) showed absolute
// thresholds are mis-calibrated per embedding model — a value right for one
// model's cosine scale is far wrong for another (e.g. 4% malicious recall on
// OpenAI-3-small@256 at the old 0.82). The replacement is a *scale-invariant*
// rule:
//
//   - MALICIOUS GATE: argmax over the RAW (context-free) vectors — classify
//     malicious iff raw-malicious is the highest of {raw-mal, raw-off, raw-on}
//     AND clears a floor. Using raw vectors only is what preserves the
//     buried-payload defense (a benign prior-answer context can never dilute the
//     malicious comparison — this is the structural successor to the old
//     dual-vector + [0.78,0.85] clamp, see CLAUDE.md §"dual-vector scoring").
//   - BENIGN SPLIT: relative comparison on the CONTEXTUALIZED vectors — off-topic
//     iff ctx-off > ctx-on, else on-topic (on-topic wins ties = benign default,
//     so unrelated/ambiguous input is never flagged). Off-topic only flags; it
//     does not block, so it carries no security weight.
//
// Cross-model validation: malicious recall 41%→96% (local), accuracy →96.5%,
// zero benign blocked, buried-payload still blocked on all three configs.

/** Hard security band for the malicious floor — auto/debug values are clamped here. */
export const MALICIOUS_FLOOR_MIN = 0.35;
export const MALICIOUS_FLOOR_MAX = 0.70;
/**
 * Benign-split tie-break: classify off-topic only when contextualized off-topic
 * beats on-topic by at least this margin; otherwise default to on-topic. This
 * keeps "ambiguous / unrelated / cross-lingual" input on-topic (never flagged) —
 * the prior absolute rule's on-topic default — while costing nothing on genuine
 * off-topic (whose margins run well above this). Validated on qwen3-8b: lifts
 * on-topic recall 93%→100%, off-topic stays 100%. The one mildly scale-sensitive
 * constant; small enough to be safe across the tested cosine ranges.
 */
export const OFF_TOPIC_MARGIN = 0.02;
/** Fallback floor when a corpus is unavailable for auto-calibration. */
export const DEFAULT_MALICIOUS_FLOOR = 0.50;

/**
 * Validated per-(provider,model,dims) malicious floors from Phase 55 tuning.
 * Models we have empirically validated get their measured floor directly (no
 * recompute cost); anything not listed falls back to corpus auto-calibration.
 */
interface FloorTableEntry {
  match: (provider: string, model: string, dims: number | undefined) => boolean;
  floor: number;
}
export const VALIDATED_MALICIOUS_FLOORS: FloorTableEntry[] = [
  { match: (_p, m) => /qwen3-embedding-8b/i.test(m), floor: 0.615 },
  { match: (_p, m, d) => m === 'text-embedding-3-small' && d === 256, floor: 0.560 },
  // OpenAI defaults to 1536 dims when `dimensions` is unset.
  { match: (_p, m, d) => m === 'text-embedding-3-small' && (d === 1536 || d === undefined), floor: 0.485 },
];

/** Minimal shape of settings.embeddingDebug this module reads. */
interface EmbeddingDebugLike {
  debugEnabled?: boolean;
  /** Debug-only floor override for the malicious gate; clamped to the hard band. */
  maliciousThreshold?: number;
}

const _autoFloorCache = new Map<string, number>();

/**
 * Auto-calibrate the malicious floor from the corpus: set it just above the
 * highest raw-malicious cosine observed among the BENIGN (on/off-topic)
 * exemplars, so by construction no benign exemplar would trip the gate. Clamped
 * to the hard [MIN, MAX] band so a degenerate/poisoned corpus can neither disable
 * malicious detection (too high) nor over-block (too low).
 */
function autoCalibrateFloor(corpus: FilterCorpusEntry[]): number {
  const malicious = corpus.filter((e) => e.label === 'malicious');
  const benign = corpus.filter((e) => e.label !== 'malicious');
  if (malicious.length === 0 || benign.length === 0) return DEFAULT_MALICIOUS_FLOOR;
  let maxBenignMal = 0;
  for (const b of benign) {
    let best = -1;
    for (const m of malicious) {
      const s = cosine(b.vector, m.vector);
      if (s > best) best = s;
    }
    if (best > maxBenignMal) maxBenignMal = best;
  }
  return Math.min(MALICIOUS_FLOOR_MAX, Math.max(MALICIOUS_FLOOR_MIN, maxBenignMal + 0.02));
}

/**
 * Resolve the malicious-gate floor for the active embedding config. Debug
 * override (clamped) > validated table > corpus auto-calibration (memoized).
 */
export function resolveMaliciousFloor(
  embConfig: EmbeddingConfig,
  corpus: FilterCorpusEntry[],
  embDebug: EmbeddingDebugLike | undefined,
): number {
  if (embDebug?.debugEnabled === true && typeof embDebug.maliciousThreshold === 'number') {
    return Math.min(MALICIOUS_FLOOR_MAX, Math.max(MALICIOUS_FLOOR_MIN, embDebug.maliciousThreshold));
  }
  const { provider, model, dimensions } = embConfig;
  const hit = VALIDATED_MALICIOUS_FLOORS.find((e) => e.match(provider, model, dimensions));
  if (hit) return hit.floor;
  const key = `${provider}:${model}:${dimensions ?? ''}`;
  if (!_autoFloorCache.has(key)) _autoFloorCache.set(key, autoCalibrateFloor(corpus));
  return _autoFloorCache.get(key)!;
}

// ─── Layer 1 (narrow regex fast-path) ────────────────────────────────────────

/**
 * Layer 1 maximum content length. Beyond this threshold, no plausible bare
 * greeting/ack/single-token nonsense fits — defer to Layer 2. Prevents
 * false-positive on inputs like "ok let me describe ..." which embed an
 * ack-shaped prefix inside a real query.
 */
const LAYER_1_MAX_LENGTH = 60;

// Narrow regex set per RESEARCH §"Layer 1 Narrow Regex Set". All are `^...$`
// anchored so they ONLY match when the message IS the greeting/ack/test,
// not when it contains one inside a longer question.
const LAYER_1_REGEXES: RegExp[] = [
  // Pure greetings (entire message)
  /^\s*(hi|hello|hey|hiya|howdy|good\s+(morning|afternoon|evening|night)|greetings|sup|yo)[\s!.?]*$/i,
  // Bare backchannel / ack (entire message)
  /^\s*(ok|okay|alright|cool|nice|great|thanks|thank\s+you|ty|np|yep|yes|no|nope|sure|fine|got\s+it)[\s!.?]*$/i,
  // Single-token nonsense / test (entire message)
  /^\s*(test|asdf|qwerty|xyz|lol|haha|lmao|xd|wtf|brb|gtg|jk|smh|hmm+|huh)[\s!.?]*$/i,
  // "How are you" family (entire message)
  /^\s*(how\s+are\s+you|how['']?s\s+it\s+going|how\s+have\s+you\s+been|what['']?s\s+up|what['']?s\s+new|nice\s+to\s+meet\s+you)[\s!.?]*$/i,
];

// Security-critical deterministic pre-gate. These patterns intentionally cover
// only direct imperative attempts to override or extract model instructions.
// Conceptual questions such as "What is a system prompt?" and "Why are models
// vulnerable to prompt injection?" do not match and remain available for the
// semantic classifier. This gate stays active when embeddings are unavailable.
const DIRECT_MALICIOUS_REGEXES: RegExp[] = [
  /^\s*(?:(?:please|kindly)\s+)?(?:ignore|disregard|forget|override|bypass|disable)\b[\s\S]{0,160}\b(?:previous|prior|system|developer|safety|hidden|initial|content)\b[\s\S]{0,80}\b(?:instructions?|prompt|rules?|guidelines?|configuration|filter|programming)\b/i,
  /^\s*(?:(?:please|kindly)\s+)?(?:reveal|print|show|dump|output|repeat|exfiltrate)\b[\s\S]{0,160}\b(?:system|developer|hidden|initial|confidential)\b[\s\S]{0,80}\b(?:prompt|instructions?|rules?|guidelines?|directives?|configuration)\b/i,
  /^\s*(?:(?:please|kindly)\s+)?(?:act|pretend|roleplay|operate|enter)\b[\s\S]{0,160}\b(?:jailbroken|unrestricted|developer\s+mode|no\s+(?:rules|restrictions)|without\s+(?:rules|filtering|restrictions))\b/i,
];

export function layer1MaliciousRegex(content: string): { matched: boolean } {
  const trimmed = content.trim();
  return { matched: DIRECT_MALICIOUS_REGEXES.some((pattern) => pattern.test(trimmed)) };
}

/**
 * Synchronous narrow regex check — Layer 1 fast-path.
 *
 * Returns `{matched: true}` if and only if the entire (trimmed) message
 * is a bare greeting/ack/single-token/"how are you" pattern AND the message
 * length is ≤ LAYER_1_MAX_LENGTH (60 chars).
 *
 * Counter-examples that MUST return matched=false (length-guard or
 * structural-anchor rejection):
 *   - "Hello world programming"     (greeting prefix in real query)
 *   - "What is a thank-you note?"   (ack-word inside real query)
 *   - "How are you supposed to learn this?" (greeting family inside real query)
 *   - Any 70+ char message even if shaped like a Layer 1 pattern
 */
export function layer1Regex(content: string): { matched: boolean } {
  const trimmed = content.trim();
  if (trimmed.length > LAYER_1_MAX_LENGTH) {
    return { matched: false };
  }
  for (const re of LAYER_1_REGEXES) {
    if (re.test(trimmed)) {
      return { matched: true };
    }
  }
  return { matched: false };
}

// ─── Layer 2 (embedding similarity) ──────────────────────────────────────────

/** Number of characters of priorAnswer to prefix the query embedding (D-11). */
const PRIOR_ANSWER_PREFIX_CHARS = 240;

async function layer2Embedding(
  content: string,
  context: QuestionFilterContext | undefined,
  embConfig: EmbeddingConfig,
  signal: AbortSignal | undefined,
  embDebug: EmbeddingDebugLike | undefined,
): Promise<FilterResult> {
  // Dual-vector scoring — Phase 47 UAT-5 multi-turn jailbreak fix.
  //
  // The malicious classifier ALWAYS scores against the raw content vector.
  // The original D-11 design used a single contextualized vector
  // (`priorAnswer.slice(0, 240) + ' ' + content`) so "but why?" follow-ups
  // would stay on-topic. That dilution accidentally created an evasion vector:
  // user asks a benign question, then sends a verbatim jailbreak as turn 2 —
  // the 240-char benign prefix dominated the embedding direction, dropping
  // cosine vs malicious exemplars below 0.82. Observed in UAT-5: cosine
  // 0.977 (raw) → 0.755 (contextualized) for the same malicious payload.
  //
  // The off-topic + on-topic labels keep D-11 contextualized scoring so
  // legit follow-ups ("but why?", "go deeper") still get the context benefit.
  //
  // Cost: when context.priorAnswer is present, +1 embedText call per
  // follow-up turn (~50-100ms cloud-OpenAI). When no priorAnswer, contextVec
  // aliases rawVec and we skip the duplicate call.
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const rawVec = await embedText(content, embConfig);
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const hasPriorAnswer = !!(context?.priorAnswer && context.priorAnswer.length > 0);
  const contextVec = hasPriorAnswer
    ? await embedText(
        `${context!.priorAnswer!.slice(0, PRIOR_ANSWER_PREFIX_CHARS)} ${content}`,
        embConfig,
      )
    : rawVec;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const corpus = await loadCorpusEmbeddings(embConfig);
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // RAW-ARGMAX gate. The malicious decision compares the RAW (context-free)
  // vector against all three label exemplar sets — buried-payload resistant,
  // because a benign prior-answer context never enters this comparison. The
  // benign off/on split uses the CONTEXTUALIZED vector (D-11 follow-up benefit).
  // When there is no priorAnswer, contextVec aliases rawVec so the off/on raw and
  // contextualized scores coincide and we skip the duplicate cosine.
  let bestMalRaw: { entry: FilterCorpusEntry; score: number } | null = null;
  let bestOffRaw: { entry: FilterCorpusEntry; score: number } | null = null;
  let bestOnRaw: { entry: FilterCorpusEntry; score: number } | null = null;
  let bestOffCtx: { entry: FilterCorpusEntry; score: number } | null = null;
  let bestOnCtx: { entry: FilterCorpusEntry; score: number } | null = null;

  for (const entry of corpus) {
    if (entry.label === 'malicious') {
      const s = cosine(rawVec, entry.vector);
      if (!bestMalRaw || s > bestMalRaw.score) bestMalRaw = { entry, score: s };
    } else if (entry.label === 'off-topic') {
      const sr = cosine(rawVec, entry.vector);
      if (!bestOffRaw || sr > bestOffRaw.score) bestOffRaw = { entry, score: sr };
      const sc = hasPriorAnswer ? cosine(contextVec, entry.vector) : sr;
      if (!bestOffCtx || sc > bestOffCtx.score) bestOffCtx = { entry, score: sc };
    } else {
      const sr = cosine(rawVec, entry.vector);
      if (!bestOnRaw || sr > bestOnRaw.score) bestOnRaw = { entry, score: sr };
      const sc = hasPriorAnswer ? cosine(contextVec, entry.vector) : sr;
      if (!bestOnCtx || sc > bestOnCtx.score) bestOnCtx = { entry, score: sc };
    }
  }

  const floor = resolveMaliciousFloor(embConfig, corpus, embDebug);
  const malRaw = bestMalRaw?.score ?? -1;
  const offRaw = bestOffRaw?.score ?? -1;
  const onRaw = bestOnRaw?.score ?? -1;

  // Phase 55 D-02: dev-gated instrumentation (browser dev build + debug only).
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && embDebug?.debugEnabled === true) {
    console.info(
      '[filter] floor=%o rawMal=%o rawOff=%o rawOn=%o | ctxOff=%o ctxOn=%o',
      floor, malRaw, offRaw, onRaw, bestOffCtx?.score, bestOnCtx?.score,
    );
  }

  // Malicious gate: raw-only argmax above the floor. No context vector enters
  // here, so a benign preamble cannot dilute the malicious score (the structural
  // buried-payload defense — see header comment + CLAUDE.md §"dual-vector scoring").
  if (bestMalRaw && malRaw >= floor && malRaw >= offRaw && malRaw >= onRaw) {
    return {
      label: 'malicious',
      bestMatch: { label: 'malicious', exemplar: bestMalRaw.entry.text, score: malRaw },
    };
  }

  // Benign split: relative comparison on contextualized vectors. Off-topic only
  // when it beats on-topic by OFF_TOPIC_MARGIN, so unrelated / ambiguous input
  // defaults to on-topic (never flagged).
  if (bestOffCtx && bestOffCtx.score - (bestOnCtx?.score ?? -1) >= OFF_TOPIC_MARGIN) {
    return {
      label: 'off-topic',
      bestMatch: { label: 'off-topic', exemplar: bestOffCtx.entry.text, score: bestOffCtx.score },
    };
  }

  return {
    label: 'on-topic',
    bestMatch: bestOnCtx
      ? { label: 'on-topic', exemplar: bestOnCtx.entry.text, score: bestOnCtx.score }
      : undefined,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Hybrid classifier — Layer 1 narrow regex + Layer 2 embedding similarity.
 *
 * Flow:
 *   1. If signal already aborted → throw AbortError.
 *   2. Deterministic malicious pre-gate rejects direct override/extraction commands.
 *   3. Layer 1: if narrow regex hits AND length ≤ 60 → return off-topic
 *      WITHOUT invoking embedText (fast-path skip).
 *   4. Lazy-load embedding config from settingsService (leaf-module discipline).
 *   5. If embConfig is unconfigured → return on-topic (D-12 graceful degradation).
 *   6. Try Layer 2. On any error or post-call abort → log + return on-topic (D-12).
 *
 * @param content       The user-supplied message under classification.
 * @param context       Optional prior Q&A pair for follow-up context (D-11).
 * @param signal        Optional AbortSignal — checked before each await (D-19).
 * @returns A three-label FilterResult with optional bestMatch debug info.
 */
export async function evaluateQuestion(
  content: string,
  context?: QuestionFilterContext,
  signal?: AbortSignal,
): Promise<FilterResult> {
  // D-19 — honor pre-aborted signal.
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Direct prompt override/extraction attempts must fail closed before settings,
  // embeddings, context, provider calls, or persistence are touched.
  if (layer1MaliciousRegex(content).matched) {
    return {
      label: 'malicious',
      bestMatch: { label: 'malicious', exemplar: 'deterministic-direct-command', score: 1 },
    };
  }

  // Layer 1 fast-path.
  const l1 = layer1Regex(content);
  if (l1.matched) {
    return { label: 'off-topic' };
  }

  // Lazy-load settings — keeps this module leaf so node --test can import it.
  const { settingsService } = await import('./settings.service.ts');
  const settings = settingsService.getSync();
  const embConfig = settings.embedding;
  // Phase 55 D-05/D-06: live debug knobs (or undefined → constants used).
  const embDebug = settings.embeddingDebug as EmbeddingDebugLike | undefined;

  // D-12 — graceful degradation when embedding is unconfigured. Direct
  // instruction-override/extraction commands are already rejected by the
  // deterministic pre-gate above; only ambiguous semantic cases degrade to
  // on-topic here.
  if (!embConfig.isConfigured) {
    return { label: 'on-topic' };
  }

  try {
    return await layer2Embedding(content, context, embConfig, signal, embDebug);
  } catch (e: unknown) {
    // AbortError is expected on cancellation — propagate as on-topic (caller
    // is shutting down). Other errors are network/quota/parser failures.
    if (signal?.aborted) {
      return { label: 'on-topic' };
    }
    console.warn(
      '[QuestionTrace] filter Layer 2 failed, defaulting to on-topic:',
      e instanceof Error ? e.message : e,
    );
    return { label: 'on-topic' };
  }
}
