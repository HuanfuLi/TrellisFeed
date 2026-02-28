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
  keywords: string[];
  relatedQuestionIds: string[];
  categoryIds: string[];
  embedding?: number[];
  reviewSchedule: ReviewSchedule;
  createdAt: number;
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
// CALENDAR & TODO DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface DaySchedule {
  date: string;
  blocks: TimeBlock[];
  reviewItemCount: number;
}

export interface TimeBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  todos: TodoItem[];
  sortOrder: number;
  pinned?: boolean;     // if true, block appears on every day
  templateId?: string;  // present on injected copies; equals the original pinned block's id
}

export interface TodoItem {
  id: string;
  blockId: string;
  content: string;
  status: TodoStatus;
  createdAt: number;
  completedAt?: number;
  postponedFrom?: string;
  pinned?: boolean;  // if true, todo appears in its block every day
}

export type TodoStatus = 'pending' | 'completed' | 'postponed';

// ═══════════════════════════════════════════════════════════════════════════
// PODCAST DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface DailyPodcast {
  id: string;
  date: string;
  questionIds: string[];
  script: string;
  audioPath?: string;
  duration?: number;
  status: PodcastStatus;
  progress?: number;
  error?: string;
  createdAt: number;
}

export type PodcastStatus = 'pending' | 'generating' | 'ready' | 'failed';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface AppSettings {
  llm: LLMConfig;
  tts: TTSConfig;
  zerotier: ZeroTierConfig;
  podcast: PodcastSettings;
  review: ReviewSettings;
  preferences: AppPreferences;
}

export interface LLMConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'local' | 'lmstudio';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  isConfigured: boolean;
}

export interface TTSConfig {
  provider: 'openai' | 'gptsovits';
  apiKey?: string;
  baseUrl?: string;
  voice: string;
  speed: number;
  isConfigured: boolean;
}

export interface ZeroTierConfig {
  networkId?: string;
  isConnected: boolean;
  virtualIp?: string;
}

export interface PodcastSettings {
  sleepTime: string;
  advanceMinutes: number;
  autoGenerate: boolean;
}

export interface ReviewSettings {
  dailyLimit: number;
  notificationsEnabled: boolean;
  reminderTime: string;
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  onboardingCompleted: boolean;
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
}

export interface ChatSession {
  id: string;
  title: string;       // first user message, truncated to 60 chars
  createdAt: number;
  updatedAt: number;
  messages: SessionMessage[];
  processed: boolean;  // true once flashcard post-processing has run
}

// ═══════════════════════════════════════════════════════════════════════════
// FLASHCARD DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

export interface FlashCard {
  id: string;
  sessionId: string;        // which ChatSession produced this card
  front: string;            // concise question / concept (≤120 chars)
  back: string;             // concise answer (≤200 chars)
  createdAt: number;
  pinned?: boolean;         // if true, appears in review queue every day
  reviewSchedule: ReviewSchedule;
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
  | 'API_QUOTA_EXCEEDED'
  | 'API_RATE_LIMITED'
  | 'DATABASE_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN_ERROR';

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
  | { type: 'REVIEW_SUBMITTED'; payload: { questionId: string; rating: number } }
  | { type: 'REVIEW_DUE_COUNT_CHANGED'; payload: { count: number } }
  | { type: 'TODO_CREATED'; payload: TodoItem }
  | { type: 'TODO_STATUS_CHANGED'; payload: TodoItem }
  | { type: 'BLOCK_CREATED'; payload: TimeBlock }
  | { type: 'BLOCK_UPDATED'; payload: TimeBlock }
  | { type: 'PODCAST_GENERATION_STARTED'; payload: { podcastId: string; date: string } }
  | { type: 'PODCAST_GENERATION_PROGRESS'; payload: { podcastId: string; progress: number } }
  | { type: 'PODCAST_GENERATION_COMPLETED'; payload: DailyPodcast }
  | { type: 'PODCAST_GENERATION_FAILED'; payload: { podcastId: string; error: string } }
  | { type: 'LLM_CONFIG_CHANGED'; payload: LLMConfig }
  | { type: 'TTS_CONFIG_CHANGED'; payload: TTSConfig }
  | { type: 'ZEROTIER_STATUS_CHANGED'; payload: ZeroTierConfig }
  | { type: 'NETWORK_STATUS_CHANGED'; payload: { isOnline: boolean } }
  | { type: 'SESSION_CREATED'; payload: ChatSession }
  | { type: 'SESSION_UPDATED'; payload: { id: string } }
  | { type: 'FLASHCARDS_CREATED'; payload: { sessionId: string; count: number } };
