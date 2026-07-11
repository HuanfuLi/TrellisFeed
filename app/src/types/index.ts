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

/** A milestone or trivia card injected into the Info Flow every ~5 items. */
export interface BlindboxItem {
  id: string;
  type: 'milestone' | 'trivia';
  emoji: string;
  headline: string;
  body: string;
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

/** Which provider takes priority when generating images. */
export type ImageProviderPrimary = 'nanoBanana' | 'gemini' | 'auto';

export interface ImageGenerationSettings {
  nanoBananaApiKey: string;
  geminiApiKey: string;
  /** Gemini model name — e.g. 'gemini-3.1-flash-image-preview'. User-configurable so it never needs a code change. */
  geminiModel: string;
  maxCacheSizeMb: number;
  cacheTtlDays: number;
  /** Provider order preference. 'auto' tries both based on key availability. */
  primaryProvider: ImageProviderPrimary;
  /** Master toggle for image generation. When false, no API calls attempted. */
  enabled: boolean;
}

export interface AppSettings {
  llm: LLMConfig;
  /**
   * Phase 55.1 GAP-E (BUGFIX-08) — optional low-latency generation model.
   * When `enabled` and configured, the on-open one-shot generators (post body,
   * post-context Q&A) stream from THIS model with thinking/reasoning
   * DISABLED, so the body starts streaming immediately on tap-in (no multi-second
   * "thinking" stall). When unset/disabled, those generators fall back to `llm`
   * with NO behavior change. Mirrors LLMConfig so users can point it at a wholly
   * different provider/model/key (e.g. a fast local LM Studio model while `llm`
   * is a cloud reasoning model). Additive-optional — pre-feature stored settings
   * load the default (disabled) via deepMerge; no migration (CLAUDE.md
   * feedback_no_normalize_for_optional_fields). Ask Q&A and classification are
   * NOT routed through this — they keep `llm`.
   */
  fastModel?: FastModelConfig;
  embedding: EmbeddingConfig;
  embeddingDebug: EmbeddingDebugConfig;
  zerotier: ZeroTierConfig;
  preferences: AppPreferences;
  imageGeneration: ImageGenerationSettings;
  feed: {
    postRetentionDays: number | null; // null = keep all
    dailyGenerationCapMultiplier: number;
    bonusPostCap: number;
  };
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

/**
 * Phase 55.1 GAP-E — low-latency generation model config. Mirrors LLMConfig (so the
 * Settings UI + provider plumbing reuse existing patterns) plus an `enabled` master gate.
 * `resolveGenerationConfig` returns this config (with thinking disabled) ONLY when
 * `enabled === true` AND `isConfigured === true`; otherwise it falls back to the main
 * `llm` config with thinking left on (byte-identical request to today).
 */
export interface FastModelConfig extends LLMConfig {
  enabled: boolean;
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

export interface ChatSession {
  id: string;
  title: string;       // first user message, truncated to 60 chars
  createdAt: number;
  updatedAt: number;
  messages: SessionMessage[];
  processed: boolean;  // true once flashcard post-processing has run
  origin?: SessionOrigin;
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

export type PostNarrativeMode =
  | 'example-first'
  | 'historical-story'
  | 'contrast'
  | 'analogy'
  | 'false-intuition'
  | 'mnemonic'
  | 'mechanism-breakdown'
  | 'starter';

/** Visual presentation style assigned to each feed post by the weighted mix algorithm. */
export type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'suggestion';

export interface FeedTeaser {
  hook: string;
  preview: string;
}

export interface PostSnapshot {
  id: string;
  date: string;
  title: string;
  teaser: FeedTeaser;
  bodyMarkdown: string;
  /** Phase 41 D-03 — optional 350-600w deep variant. Generated on demand,
   *  lives alongside the standard bodyMarkdown teaser. Back-compat additive:
   *  old cached posts without this field remain valid. */
  bodyMarkdownDeep?: string;
  whyCare: string;
  takeaway: string;
  quickAskPrompts: string[];
  narrativeMode: PostNarrativeMode;
  contextLabel: string;
  sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'text-art' | 'suggestion';
  sourceQuestionIds: string[];
  sourceQuestionTitles: string[];
  keywords: string[];
}

export interface DailyPost extends PostSnapshot {
  generatedAt: number;
  origin: 'ai';
  /** ASCII/Unicode text-art content for text-art presentation style. */
  textArtContent?: string;
  /** Visual presentation style assigned by the weighted mix algorithm. */
  presentationStyle?: PresentationStyle;
  /** Suggestion post metadata with topic suggestions for further exploration. */
  suggestionMeta?: SuggestionMeta;
}

/** Metadata for suggestion-type posts that propose new topics to explore. */
export interface SuggestionMeta {
  topics: string[]; // exactly 3 topic strings
}

export interface PostOriginContext {
  post: PostSnapshot;
  sourceQuestions: Array<{
    id: string;
    title: string;
    content: string;
    summary: string;
  }>;
}

export interface SessionOrigin {
  type: 'post';
  postId: string;
  postTitle: string;
  context: PostOriginContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE GENERATION DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export type ImageStyle = 'infograph' | 'illustration' | 'photo';
export type ImageProvider = 'nanoBanana' | 'gemini' | 'mock';

export interface GeneratedImage {
  id: string;
  postId: string;
  prompt: string;
  style: ImageStyle;
  imageUrl?: string;       // Remote URL (if from provider)
  imageBase64?: string;    // Local cache (base64 data URI)
  provider: ImageProvider;
  generatedAt: number;
  cachedAt?: number;
  error?: string;
}

export interface ImageCacheMetadata {
  postId: string;
  style: ImageStyle;
  provider: ImageProvider;
  generatedAt: number;
  cachedAt: number;
  expiresAt: number;
  sizeBytes: number;
}

export interface CacheStats {
  totalSizeBytes: number;
  itemCount: number;
  oldestItemAt: number | null;
  newestItemAt: number | null;
}

export interface ImageGenerationConfig {
  nanoBananaApiKey?: string;
  geminiApiKey?: string;
  maxCacheSizeBytes: number;
  cacheTtlMs: number;
  requestTimeoutMs: number;
  maxRetries: number;
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
  // Emitted once per refill cycle that actually RUNS (the `needsRefill()`
  // early-return does not emit). `added` is the realized queue growth; `error`
  // is set only when the cycle threw. HomeScreen needs this because
  // getDailyPosts() returns [] on a cold start BY DESIGN while refillQueue
  // works in the background — without a completion signal an empty feed is
  // indistinguishable from a broken API key.
  | { type: 'FEED_REFILL_COMPLETED'; payload: { added: number; error?: string } }
  | { type: 'SESSION_CREATED'; payload: ChatSession }
  | { type: 'SESSION_UPDATED'; payload: { id: string } }
  | { type: 'CONCEPT_EXPLORED'; payload: { anchorId: string } }
  | { type: 'ANCHOR_DISMISSED'; payload: { anchorId: string } }
  | { type: 'ENGAGEMENT_CHANGED'; payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss'; id: string } }
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
