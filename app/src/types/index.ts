import type { StudyCondition } from './research';

export type {
  InteractionEventType,
  QuestionAnswerRecord,
  ResearchIdentity,
  StudyCondition,
  UserInteractionEvent,
} from './research';

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION & KNOWLEDGE DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface Question {
  id: string;
  timestamp: number;
  date: string;
  content: string;
  answer: string;
  summary: string;
  title?: string;          // short AI-derived title (4-7 words), used in listings
  storyHook?: string;      // intriguing one-liner to spark curiosity, shown in Info Flow
  parentId?: string;       // parent node ID for hierarchical graph organisation
  keywords: string[];
  relatedQuestionIds: string[];
  categoryIds: string[];
  reviewSchedule: ReviewSchedule;
  createdAt: number;
  aliases?: string[];
  sourcePrompts?: string[];
  sourceQuestionIds?: string[];
  rootLabel?: string;
  branchLabel?: string;
  clusterLabel?: string;
  nodeSummary?: string;
  placementReason?: string;
  lastReviewedAt?: number;
  pinned?: boolean;
  coCreationSignals?: Partial<Record<StructuralSignalType, number>> & { lastSignalAt?: number };
  embeddingVector?: number[];
  flagged?: boolean;  // true if detected as off-topic/meta-question; user can override
  prunedFromTrellis?: boolean; // true when user explicitly prunes this node from the trellis (D-15/D-17)
  isAnchorNode?: boolean;  // true for concept anchor nodes; undefined/false for Q&A leaf nodes
  qaCount?: number;        // number of Q&A nodes attached to this anchor (incremented on attachment)
  shortSummary?: string;   // <=80 words, used as anchor summary entry when Q&A attaches
  isClusterNode?: boolean; // true for cluster-level container nodes
  clusterNodeId?: string;  // on anchor and Q&A nodes — points to parent cluster entity ID
}

export interface ReviewSchedule {
  nextReviewDate: string;
  reviewCount: number;
  easeFactor: number;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface AppSettings {
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  embeddingDebug: EmbeddingDebugConfig;
  zerotier: ZeroTierConfig;
  preferences: AppPreferences;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'google' | 'local' | 'lmstudio';
  apiKey?: string;
  apiKeys?: Record<string, string>; // Phase 52 GAP-5 — per-provider key memory; undefined for pre-GAP-5 stored settings (read-site fallback, no migration per CLAUDE.md feedback_no_normalize_for_optional_fields)
  model: string;
  baseUrl?: string;
  dimensions?: number;
  isConfigured: boolean;
}

export interface EmbeddingDebugConfig {
  // Legacy field — retained for backwards-compat read side. Phase 55 D-05 stops
  // rendering its slider (it never mapped to any real threshold). Do NOT reconnect
  // this to anchor dedup.
  similarityThreshold: number;
  showScores: boolean;
  // Phase 55 D-05: per-threshold live tuning knobs. Optional + additive — pre-feature
  // stored settings load with these undefined and every read path falls back to the
  // hardcoded service constant (no normalize framework per CLAUDE.md
  // feedback_no_normalize_for_optional_fields). debugEnabled is the master gate:
  // false/undefined = production mode (constants used unconditionally).
  debugEnabled?: boolean;        // master gate; false/undefined = production mode
  offTopicThreshold?: number;    // RETIRED by RAW-ARGMAX (Phase 55): the filter's off/on split is now relative, no absolute off-topic threshold. Field kept for stored-settings backward-compat; not read.
  maliciousThreshold?: number;   // RAW-ARGMAX malicious-FLOOR debug override; clamped to [0.35, 0.70] by resolveMaliciousFloor (was the absolute malicious threshold pre-Phase-55)
  anchorDedupThreshold?: number; // default 0.82 when undefined; clamped to [0.78, 0.85] by service (separate anchor-dedup classifier — unaffected by RAW-ARGMAX)
}

export interface LLMConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'local' | 'lmstudio';
  apiKey?: string;
  apiKeys?: Record<string, string>; // Phase 52 GAP-5 — per-provider key memory; undefined for pre-GAP-5 stored settings (read-site fallback, no migration per CLAUDE.md feedback_no_normalize_for_optional_fields)
  baseUrl?: string;
  model: string;
  isConfigured: boolean;
}

export interface ZeroTierConfig {
  networkId?: string;
  isConnected: boolean;
  virtualIp?: string;
}

/** Supported i18n locales. Canonical source in `app/src/locales/index.ts`; inlined here to avoid cross-module dependency. */
export type SupportedLocale = 'en' | 'zh' | 'es' | 'ja';

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  /** Canonical display locale (D-20). Populated from legacy `language` field on first load when missing. */
  locale: SupportedLocale;
  /** @deprecated Use `locale` instead. Kept for one-time migration only. */
  language?: string;
  onboardingCompleted: boolean;
  /** Explicit user consent to transmit questions to the configured AI provider. Required by App Store / Play Store AI policies. */
  aiConsentGiven?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT SESSION DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  relatedKnowledge?: string[];
  questionId?: string;
  // isStreaming is transient UI state only — never persisted
  /**
   * Discriminator for special-render AI messages. Phase 47 D-01 / D-02:
   *   - undefined / 'normal' → existing markdown body render path.
   *   - 'malicious-block'    → ChatMessage renders the inline rejection
   *                            surface (NO override button, neutral copy
   *                            from i18n key chatMessage.maliciousBlocked.body).
   * useQuestions.askStreaming sets 'malicious-block' when filterResult.label
   * === 'malicious' (pre-LLM gate per D-18). Zero LLM tokens are spent in
   * this branch, no Question is persisted.
   */
  kind?: 'normal' | 'malicious-block';
}

// ═══════════════════════════════════════════════════════════════════════════
// FLASHCARD DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export type StructuralSignalType = 'sameIdea' | 'connect' | 'refine';

export interface KnowledgeNode {
  id: string;
  title: string;
  content: string;
  answer: string;
  summary: string;
  storyHook?: string;
  keywords: string[];
  relatedQuestionIds: string[];
  parentId?: string;
  aliases: string[];
  sourcePrompts: string[];
  sourceQuestionIds: string[];
  rootLabel: string;
  branchLabel: string;
  clusterLabel: string;
  nodeSummary: string;
  placementReason: string;
  reviewSchedule: ReviewSchedule;
  createdAt: number;
  date: string;
  timestamp: number;
  lastReviewedAt?: number;
  pinned?: boolean;
  coCreationSignals?: Partial<Record<StructuralSignalType, number>> & { lastSignalAt?: number };
}

export interface HierarchySummary {
  id: string;
  label: string;
  summary: string;
  representativeKeywords: string[];
  representativeNodeIds: string[];
  nodeCount: number;
}

export interface CandidateContextPack {
  roots: HierarchySummary[];
  branches: HierarchySummary[];
  clusters: HierarchySummary[];
  candidates: KnowledgeNode[];
}

export interface IngestionDecision {
  outcome: 'merge' | 'refine' | 'new';
  targetNodeId?: string;
}

export interface ClassificationResult {
  briefAnswer: string;
  keyword: string;
  rootLabel: string;
  branchLabel: string;
  clusterLabel: string;
  anchorName: string;
  anchorId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED RESPONSE TYPE
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

export interface ServiceError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'API_KEY_INVALID'
  | 'API_KEY_NOT_CONFIGURED'
  | 'API_QUOTA_EXCEEDED'
  | 'API_RATE_LIMITED'
  | 'DATABASE_ERROR'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'RETRIES_EXHAUSTED'
  | 'VALIDATION_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN_ERROR'
  | 'NO_BACKUP'
  | 'REVERT_ERROR'
  | 'IN_PROGRESS'
  | 'TOO_FEW'
  | 'PARSE_ERROR'
  | 'SEARCH_FAILED'
  | 'LLM_ERROR'
  | 'COVERAGE_ERROR'
  // Phase 47 — pre-LLM filter gate (D-01). Returned from question.service.ask
  // when the filter classifies the input as malicious; no override path.
  | 'BLOCKED_MALICIOUS'
  // Phase 47 — pre-LLM filter gate (D-19). Returned from question.service.ask
  // when the abort signal fires during the pre-gate (LOCALE_CHANGED, etc.).
  | 'ABORTED'
  // Phase 48 — graphCommandService.delete returns this when the underlying
  // questionService.delete reports { success: false } (e.g. SQLite write
  // failure). Plan 48-02 Task 3 uses this for the Blocker #2 abort-before-
  // journal path. Retryable: the operator can retry the command.
  | 'STORAGE_ERROR'
  // Phase 48 — Plan 48-02 ships graphCommandService with method-stubs for
  // merge/detach/prune (filled in Plan 48-03) and undo (filled in Plan
  // 48-04). Callers see NOT_IMPLEMENTED until the implementing plans land.
  | 'NOT_IMPLEMENTED';

export interface AskResult {
  question: Question;
  relatedQuestions: Question[];
  newConnections: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type AppEvent =
  | { type: 'QUESTION_ASKED'; payload: Question }
  | { type: 'QUESTION_DELETED'; payload: { id: string } }
  | { type: 'CATEGORY_CREATED'; payload: Category }
  | { type: 'LLM_CONFIG_CHANGED'; payload: LLMConfig }
  | { type: 'LOCALE_CHANGED'; payload: { locale: SupportedLocale } }
  | { type: 'ZEROTIER_STATUS_CHANGED'; payload: ZeroTierConfig }
  | { type: 'NETWORK_STATUS_CHANGED'; payload: { isOnline: boolean } }
  | { type: 'POST_DELETED'; payload: { id: string } }
  | { type: 'CONCEPT_EXPLORED'; payload: { anchorId: string } }
  | { type: 'ENGAGEMENT_CHANGED'; payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'dismiss' | 'undismiss'; id: string } }
  | { type: 'RESEARCH_IDENTITY_BOUND'; payload: { userId: string; condition: StudyCondition; topicId: string } }
  | { type: 'UPLOAD_STATUS_CHANGED'; payload: { pending: number; lastSuccessAt: string | null } }
  // Unified graph-mutation signal. Fires after any classification commit, anchor
  // creation, prune, or replant step. Subscribers don't need to discriminate
  // why the graph changed — just re-read store. Replaces the former
  // CLASSIFICATION_COMPLETED event (semantic duplicate of this one; payload was
  // never read by any subscriber).
  //
  | {
      type: 'GRAPH_UPDATED';
      payload?: {
        kind?: 'classification';
        anchorId?: string;
        affectedIds?: string[];
      };
    };
