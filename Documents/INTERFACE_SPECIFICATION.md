# EchoLearn Interface Specification

## Document Purpose

This document defines the interface contracts between the UI layer (Frontend) and Service layer (Backend), and breaks down the project into independently developable components. Since EchoLearn is a serverless application, "Backend" refers to the local service layer that handles business logic, data persistence, and external API communication.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Shared Data Types](#2-shared-data-types)
3. [Service Layer Interfaces](#3-service-layer-interfaces)
4. [Event System](#4-event-system)
5. [Component Breakdown](#5-component-breakdown)
6. [Dependency Graph](#6-dependency-graph)
7. [Integration Strategy](#7-integration-strategy)
8. [Development Workflow](#8-development-workflow)

---

## 1. Architecture Overview

### 1.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER (Frontend)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   Home   │ │   Ask    │ │ Calendar │ │  Review  │ │ Settings │   ...    │
│  │  Screen  │ │  Screen  │ │  Screen  │ │  Screen  │ │  Screen  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       │            │            │            │            │                 │
│       └────────────┴────────────┴────────────┴────────────┘                 │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        STATE MANAGEMENT                               │  │
│  │                    (React Context / Zustand / etc)                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                    ═══════════════╪═══════════════  Interface Boundary
                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER (Backend)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         SERVICE REGISTRY                              │  │
│  │     Provides singleton access to all services                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │            │            │            │            │                 │
│       ▼            ▼            ▼            ▼            ▼                 │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐            │
│  │Question │ │Knowledge │ │Calendar │ │ Review  │ │ Podcast  │   ...      │
│  │Service  │ │  Graph   │ │ Service │ │ Service │ │ Service  │            │
│  │         │ │ Service  │ │         │ │         │ │          │            │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬────┘ └────┬─────┘            │
│       │           │            │           │           │                   │
│       └───────────┴────────────┴───────────┴───────────┘                   │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          DATA LAYER                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │  Database   │  │    File     │  │   Secure    │                   │  │
│  │  │  (SQLite)   │  │   Storage   │  │   Storage   │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       EXTERNAL API LAYER                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │ LLM Provider│  │TTS Provider │  │  ZeroTier   │                   │  │
│  │  │   Adapter   │  │   Adapter   │  │   Adapter   │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Communication Principles

| Principle | Description |
|-----------|-------------|
| **Async-First** | All service methods return Promises |
| **Type-Safe** | Full TypeScript interfaces for all contracts |
| **Event-Driven** | Services emit events for cross-cutting concerns |
| **Stateless Services** | Services don't hold UI state; they manage data |
| **Single Responsibility** | Each service handles one domain |

---

## 2. Shared Data Types

### 2.1 Core Entities

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// QUESTION & KNOWLEDGE DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface Question {
  id: string;                      // UUID v4
  timestamp: number;               // Unix timestamp (ms)
  date: string;                    // "YYYY-MM-DD" for grouping
  content: string;                 // User's question text
  answer: string;                  // AI's response (markdown)
  summary: string;                 // Brief summary for display
  keywords: string[];              // Extracted keywords
  relatedQuestionIds: string[];    // Linked question IDs
  categoryIds: string[];           // Category classifications
  embedding?: number[];            // Vector embedding (optional)
  reviewSchedule: ReviewSchedule;
  createdAt: number;
  updatedAt: number;
}

interface ReviewSchedule {
  nextReviewDate: string;          // "YYYY-MM-DD"
  reviewCount: number;             // Times reviewed
  easeFactor: number;              // SM-2 ease factor (default 2.5)
  lastReviewedAt?: number;         // Last review timestamp
}

interface Category {
  id: string;
  name: string;
  parentId?: string;               // For hierarchical categories
  color: string;                   // Hex color code
  questionCount: number;           // Cached count
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  categories: Category[];
  metadata: GraphMetadata;
}

interface KnowledgeNode {
  id: string;                      // Same as Question.id
  label: string;                   // Display label (summary)
  categoryIds: string[];
  weight: number;                  // Visual weight (0-1)
  x?: number;                      // Cached position
  y?: number;
  createdAt: number;
  lastAccessedAt: number;
}

interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationType;
  strength: number;                // 0-1
  createdAt: number;
}

type RelationType =
  | 'prerequisite'    // Source is required to understand target
  | 'extends'         // Target extends/elaborates source
  | 'contradicts'     // Source and target have opposing views
  | 'similar'         // Related by topic
  | 'part_of'         // Source is component of target
  | 'example_of';     // Source is instance of target concept

interface GraphMetadata {
  nodeCount: number;
  edgeCount: number;
  lastUpdated: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR & TODO DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface DaySchedule {
  date: string;                    // "YYYY-MM-DD"
  blocks: TimeBlock[];
  reviewItemCount: number;         // Count of due reviews
}

interface TimeBlock {
  id: string;
  date: string;
  startTime: string;               // "HH:MM"
  endTime: string;                 // "HH:MM"
  label: string;
  todos: TodoItem[];
  sortOrder: number;
}

interface TodoItem {
  id: string;
  blockId: string;
  content: string;
  status: TodoStatus;
  createdAt: number;
  completedAt?: number;
  postponedFrom?: string;          // Original block ID if postponed
}

type TodoStatus = 'pending' | 'completed' | 'postponed';

// ═══════════════════════════════════════════════════════════════════════════
// PODCAST DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface DailyPodcast {
  id: string;
  date: string;                    // "YYYY-MM-DD"
  questionIds: string[];           // Questions included
  script: string;                  // Full script text
  scriptSegments: ScriptSegment[]; // For audio sync
  audioPath?: string;              // Local file path
  duration?: number;               // Total seconds
  status: PodcastStatus;
  progress?: number;               // 0-100 during generation
  error?: string;                  // Error message if failed
  createdAt: number;
  completedAt?: number;
}

interface ScriptSegment {
  index: number;
  text: string;
  startTime?: number;              // Seconds from start
  endTime?: number;
  audioPath?: string;              // Individual segment audio
}

type PodcastStatus = 'pending' | 'generating' | 'ready' | 'failed';

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW SESSION DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface ReviewSession {
  id: string;
  date: string;
  startedAt: number;
  completedAt?: number;
  items: ReviewItem[];
  stats: ReviewStats;
}

interface ReviewItem {
  questionId: string;
  status: 'pending' | 'completed' | 'skipped';
  rating?: 1 | 2 | 3 | 4 | 5;
  reviewedAt?: number;
}

interface ReviewStats {
  total: number;
  completed: number;
  skipped: number;
  averageRating?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface AppSettings {
  // LLM Configuration
  llm: LLMConfig;

  // TTS Configuration
  tts: TTSConfig;

  // ZeroTier Configuration
  zerotier: ZeroTierConfig;

  // Podcast Settings
  podcast: PodcastSettings;

  // Review Settings
  review: ReviewSettings;

  // App Preferences
  preferences: AppPreferences;
}

interface LLMConfig {
  provider: 'openai' | 'claude' | 'local';
  apiKey?: string;                 // Encrypted
  baseUrl?: string;
  model: string;
  isConfigured: boolean;
  lastTestedAt?: number;
}

interface TTSConfig {
  provider: 'openai' | 'gptsovits';
  apiKey?: string;                 // Encrypted
  baseUrl?: string;
  voice: string;
  speed: number;
  isConfigured: boolean;
  lastTestedAt?: number;
}

interface ZeroTierConfig {
  networkId?: string;
  isConnected: boolean;
  virtualIp?: string;
  lastConnectedAt?: number;
}

interface PodcastSettings {
  sleepTime: string;               // "HH:MM"
  advanceMinutes: number;          // Default 60
  autoGenerate: boolean;
}

interface ReviewSettings {
  dailyLimit: number;              // Max cards per day
  notificationsEnabled: boolean;
  reminderTime: string;            // "HH:MM"
}

interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  onboardingCompleted: boolean;
  lastActiveAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

interface ServiceError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  retryable: boolean;
}

type ErrorCode =
  | 'NETWORK_ERROR'
  | 'API_KEY_INVALID'
  | 'API_QUOTA_EXCEEDED'
  | 'API_RATE_LIMITED'
  | 'API_TIMEOUT'
  | 'PARSE_ERROR'
  | 'DATABASE_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'TTS_NOT_CONFIGURED'
  | 'LLM_NOT_CONFIGURED'
  | 'ZEROTIER_DISCONNECTED'
  | 'UNKNOWN_ERROR';

// ═══════════════════════════════════════════════════════════════════════════
// PAGINATION & FILTERING
// ═══════════════════════════════════════════════════════════════════════════

interface PaginationParams {
  limit: number;
  offset: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

interface DateRangeFilter {
  startDate: string;               // "YYYY-MM-DD"
  endDate: string;
}

interface QuestionFilter {
  categoryIds?: string[];
  dateRange?: DateRangeFilter;
  searchQuery?: string;
  hasReviewDue?: boolean;
}
```

### 2.2 Type Export Pattern

All types should be exported from a central types module:

```typescript
// src/types/index.ts
export * from './entities';
export * from './services';
export * from './events';
export * from './errors';
```

---

## 3. Service Layer Interfaces

### 3.1 Service Registry

```typescript
/**
 * Central access point for all services.
 * Ensures singleton instances and proper initialization order.
 */
interface ServiceRegistry {
  // Core Services
  readonly settings: SettingsService;
  readonly question: QuestionService;
  readonly knowledgeGraph: KnowledgeGraphService;
  readonly review: ReviewService;
  readonly calendar: CalendarService;
  readonly podcast: PodcastService;

  // Provider Services
  readonly llm: LLMService;
  readonly tts: TTSService;
  readonly zerotier: ZeroTierService;

  // Utility Services
  readonly scheduler: SchedulerService;
  readonly notification: NotificationService;
  readonly analytics: AnalyticsService;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// Usage in UI:
// import { services } from '@/services';
// const questions = await services.question.getByDate('2025-02-08');
```

### 3.2 Question Service

```typescript
interface QuestionService {
  /**
   * Submit a new question to the AI and store the result.
   * This is the primary entry point for the Q&A flow.
   *
   * Flow:
   * 1. Find related questions from knowledge graph
   * 2. Build augmented prompt with context
   * 3. Call LLM API
   * 4. Extract keywords and update graph
   * 5. Store question and return result
   */
  ask(content: string): Promise<ServiceResult<AskResult>>;

  /**
   * Ask a follow-up question in the context of a previous question.
   */
  askFollowUp(
    content: string,
    previousQuestionId: string
  ): Promise<ServiceResult<AskResult>>;

  /**
   * Get a single question by ID.
   */
  getById(id: string): Promise<ServiceResult<Question>>;

  /**
   * Get questions for a specific date.
   */
  getByDate(date: string): Promise<ServiceResult<Question[]>>;

  /**
   * Get questions with filtering and pagination.
   */
  query(
    filter: QuestionFilter,
    pagination: PaginationParams
  ): Promise<ServiceResult<PaginatedResult<Question>>>;

  /**
   * Get recent questions for display.
   */
  getRecent(limit: number): Promise<ServiceResult<Question[]>>;

  /**
   * Search questions by text.
   */
  search(query: string): Promise<ServiceResult<Question[]>>;

  /**
   * Delete a question and remove from graph.
   */
  delete(id: string): Promise<ServiceResult<void>>;

  /**
   * Get statistics for dashboard.
   */
  getStats(date: string): Promise<ServiceResult<QuestionStats>>;
}

interface AskResult {
  question: Question;
  relatedQuestions: Question[];
  newConnections: number;          // Count of new graph edges created
}

interface QuestionStats {
  todayCount: number;
  totalCount: number;
  newConnectionsToday: number;
  topCategories: Array<{ category: Category; count: number }>;
}
```

### 3.3 Knowledge Graph Service

```typescript
interface KnowledgeGraphService {
  /**
   * Get the full graph for visualization.
   * For large graphs, consider using getSubgraph instead.
   */
  getGraph(): Promise<ServiceResult<KnowledgeGraph>>;

  /**
   * Get a subgraph centered on a specific node.
   */
  getSubgraph(
    centerId: string,
    depth: number
  ): Promise<ServiceResult<KnowledgeGraph>>;

  /**
   * Get nodes connected to a specific node.
   */
  getNeighbors(nodeId: string): Promise<ServiceResult<KnowledgeNode[]>>;

  /**
   * Get edges connected to a specific node.
   */
  getEdges(nodeId: string): Promise<ServiceResult<KnowledgeEdge[]>>;

  /**
   * Get all categories.
   */
  getCategories(): Promise<ServiceResult<Category[]>>;

  /**
   * Create a new category.
   */
  createCategory(
    name: string,
    color: string,
    parentId?: string
  ): Promise<ServiceResult<Category>>;

  /**
   * Update category.
   */
  updateCategory(
    id: string,
    updates: Partial<Pick<Category, 'name' | 'color'>>
  ): Promise<ServiceResult<Category>>;

  /**
   * Delete category (reassigns questions to parent or uncategorized).
   */
  deleteCategory(id: string): Promise<ServiceResult<void>>;

  /**
   * Manually add an edge between two questions.
   */
  addEdge(
    sourceId: string,
    targetId: string,
    type: RelationType,
    strength: number
  ): Promise<ServiceResult<KnowledgeEdge>>;

  /**
   * Remove an edge.
   */
  removeEdge(edgeId: string): Promise<ServiceResult<void>>;

  /**
   * Find questions similar to given text.
   * Used for duplicate detection and relation finding.
   */
  findSimilar(
    text: string,
    limit: number
  ): Promise<ServiceResult<Array<{ question: Question; similarity: number }>>>;

  /**
   * Rebuild graph connections for all questions.
   * Long-running operation, use with progress callback.
   */
  rebuildGraph(
    onProgress?: (progress: number) => void
  ): Promise<ServiceResult<GraphMetadata>>;
}
```

### 3.4 Review Service

```typescript
interface ReviewService {
  /**
   * Get questions due for review today.
   */
  getTodayReviewItems(): Promise<ServiceResult<Question[]>>;

  /**
   * Get count of items due for review.
   */
  getTodayReviewCount(): Promise<ServiceResult<number>>;

  /**
   * Start a new review session.
   */
  startSession(): Promise<ServiceResult<ReviewSession>>;

  /**
   * Get current active session if exists.
   */
  getCurrentSession(): Promise<ServiceResult<ReviewSession | null>>;

  /**
   * Submit a review rating for a question.
   * Updates the review schedule using SM-2 algorithm.
   */
  submitReview(
    questionId: string,
    rating: 1 | 2 | 3 | 4 | 5
  ): Promise<ServiceResult<ReviewSchedule>>;

  /**
   * Skip a question in the current session.
   */
  skipReview(questionId: string): Promise<ServiceResult<void>>;

  /**
   * Complete the current review session.
   */
  completeSession(): Promise<ServiceResult<ReviewStats>>;

  /**
   * Get review history.
   */
  getSessionHistory(
    pagination: PaginationParams
  ): Promise<ServiceResult<PaginatedResult<ReviewSession>>>;

  /**
   * Get upcoming review forecast.
   */
  getReviewForecast(
    days: number
  ): Promise<ServiceResult<Array<{ date: string; count: number }>>>;

  /**
   * Reschedule a specific question's review.
   */
  reschedule(
    questionId: string,
    newDate: string
  ): Promise<ServiceResult<ReviewSchedule>>;
}
```

### 3.5 Calendar Service

```typescript
interface CalendarService {
  /**
   * Get schedule for a specific date.
   */
  getDaySchedule(date: string): Promise<ServiceResult<DaySchedule>>;

  /**
   * Get schedules for a date range.
   */
  getScheduleRange(
    startDate: string,
    endDate: string
  ): Promise<ServiceResult<DaySchedule[]>>;

  // Time Block Operations

  /**
   * Create a new time block.
   */
  createBlock(
    date: string,
    startTime: string,
    endTime: string,
    label: string
  ): Promise<ServiceResult<TimeBlock>>;

  /**
   * Update a time block.
   */
  updateBlock(
    blockId: string,
    updates: Partial<Pick<TimeBlock, 'startTime' | 'endTime' | 'label'>>
  ): Promise<ServiceResult<TimeBlock>>;

  /**
   * Delete a time block.
   */
  deleteBlock(blockId: string): Promise<ServiceResult<void>>;

  /**
   * Reorder blocks within a day.
   */
  reorderBlocks(
    date: string,
    blockIds: string[]
  ): Promise<ServiceResult<TimeBlock[]>>;

  // Todo Operations

  /**
   * Add a todo to a block.
   */
  addTodo(
    blockId: string,
    content: string
  ): Promise<ServiceResult<TodoItem>>;

  /**
   * Update todo status.
   */
  updateTodoStatus(
    todoId: string,
    status: TodoStatus
  ): Promise<ServiceResult<TodoItem>>;

  /**
   * Postpone a todo to the next block.
   * Returns the new todo in the next block.
   */
  postponeTodo(todoId: string): Promise<ServiceResult<TodoItem>>;

  /**
   * Update todo content.
   */
  updateTodoContent(
    todoId: string,
    content: string
  ): Promise<ServiceResult<TodoItem>>;

  /**
   * Delete a todo.
   */
  deleteTodo(todoId: string): Promise<ServiceResult<void>>;

  /**
   * Get todo statistics for a date.
   */
  getTodoStats(date: string): Promise<ServiceResult<TodoStats>>;

  // Template Operations

  /**
   * Save current day as template.
   */
  saveAsTemplate(name: string): Promise<ServiceResult<BlockTemplate>>;

  /**
   * Apply template to a date.
   */
  applyTemplate(
    templateId: string,
    date: string
  ): Promise<ServiceResult<DaySchedule>>;

  /**
   * Get all templates.
   */
  getTemplates(): Promise<ServiceResult<BlockTemplate[]>>;
}

interface TodoStats {
  pending: number;
  completed: number;
  postponed: number;
  completionRate: number;
}

interface BlockTemplate {
  id: string;
  name: string;
  blocks: Omit<TimeBlock, 'id' | 'date' | 'todos'>[];
}
```

### 3.6 Podcast Service

```typescript
interface PodcastService {
  /**
   * Get podcast for a specific date.
   */
  getPodcast(date: string): Promise<ServiceResult<DailyPodcast | null>>;

  /**
   * Get all podcasts with pagination.
   */
  getPodcasts(
    pagination: PaginationParams
  ): Promise<ServiceResult<PaginatedResult<DailyPodcast>>>;

  /**
   * Generate podcast for a date.
   * This is a long-running operation.
   * Subscribe to events for progress updates.
   */
  generatePodcast(date: string): Promise<ServiceResult<DailyPodcast>>;

  /**
   * Cancel ongoing podcast generation.
   */
  cancelGeneration(podcastId: string): Promise<ServiceResult<void>>;

  /**
   * Retry failed podcast generation.
   */
  retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>>;

  /**
   * Get the local audio file path for playback.
   */
  getAudioPath(podcastId: string): ServiceResult<string>;

  /**
   * Get script segments with timing for audio sync.
   */
  getScriptSegments(
    podcastId: string
  ): Promise<ServiceResult<ScriptSegment[]>>;

  /**
   * Delete a podcast and its audio files.
   */
  deletePodcast(podcastId: string): Promise<ServiceResult<void>>;

  /**
   * Get total storage used by podcasts.
   */
  getStorageUsage(): Promise<ServiceResult<StorageUsage>>;

  /**
   * Delete old podcasts to free storage.
   */
  cleanupOldPodcasts(
    keepDays: number
  ): Promise<ServiceResult<{ deletedCount: number; freedBytes: number }>>;
}

interface StorageUsage {
  totalBytes: number;
  podcastCount: number;
  oldestPodcastDate: string;
  newestPodcastDate: string;
}
```

### 3.7 Settings Service

```typescript
interface SettingsService {
  /**
   * Get all settings.
   */
  getAll(): Promise<ServiceResult<AppSettings>>;

  /**
   * Get a specific setting value.
   */
  get<K extends keyof AppSettings>(
    key: K
  ): Promise<ServiceResult<AppSettings[K]>>;

  /**
   * Set a specific setting value.
   */
  set<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<ServiceResult<void>>;

  /**
   * Update multiple settings at once.
   */
  update(
    updates: Partial<AppSettings>
  ): Promise<ServiceResult<void>>;

  /**
   * Reset settings to defaults.
   */
  reset(): Promise<ServiceResult<AppSettings>>;

  /**
   * Export all settings and data.
   */
  exportData(): Promise<ServiceResult<ExportData>>;

  /**
   * Import settings and data.
   */
  importData(data: ExportData): Promise<ServiceResult<ImportResult>>;

  /**
   * Clear all user data (destructive).
   */
  clearAllData(): Promise<ServiceResult<void>>;
}

interface ExportData {
  version: string;
  exportedAt: number;
  settings: AppSettings;
  questions: Question[];
  categories: Category[];
  edges: KnowledgeEdge[];
  timeBlocks: TimeBlock[];
  todos: TodoItem[];
  podcasts: Omit<DailyPodcast, 'audioPath'>[];
}

interface ImportResult {
  questionsImported: number;
  categoriesImported: number;
  todosImported: number;
  errors: string[];
}
```

### 3.8 LLM Service

```typescript
interface LLMService {
  /**
   * Test connection with current configuration.
   */
  testConnection(): Promise<ServiceResult<ConnectionTestResult>>;

  /**
   * Send a chat message and get response.
   */
  chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ServiceResult<ChatResponse>>;

  /**
   * Send a chat message with streaming response.
   */
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<ServiceResult<ChatChunk>>;

  /**
   * Generate embedding vector for text.
   */
  generateEmbedding(text: string): Promise<ServiceResult<number[]>>;

  /**
   * Get available models for current provider.
   */
  getAvailableModels(): Promise<ServiceResult<string[]>>;

  /**
   * Check if LLM is configured and ready.
   */
  isReady(): boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

interface ChatChunk {
  content: string;
  isComplete: boolean;
}

interface ConnectionTestResult {
  success: boolean;
  responseTimeMs: number;
  modelName: string;
  error?: string;
}
```

### 3.9 TTS Service

```typescript
interface TTSService {
  /**
   * Test connection with current configuration.
   */
  testConnection(): Promise<ServiceResult<TTSTestResult>>;

  /**
   * Synthesize text to audio.
   */
  synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<ServiceResult<AudioData>>;

  /**
   * Synthesize and save to file.
   */
  synthesizeToFile(
    text: string,
    filePath: string,
    options?: TTSOptions
  ): Promise<ServiceResult<{ path: string; duration: number }>>;

  /**
   * Get available voices.
   */
  getAvailableVoices(): Promise<ServiceResult<VoiceInfo[]>>;

  /**
   * Check if TTS is configured and ready.
   */
  isReady(): boolean;
}

interface TTSOptions {
  voice?: string;
  speed?: number;           // 0.25 to 4.0
  pitch?: number;           // 0.5 to 2.0
}

interface AudioData {
  format: 'mp3' | 'wav' | 'ogg';
  data: ArrayBuffer;
  duration: number;
}

interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
}

interface TTSTestResult {
  success: boolean;
  responseTimeMs: number;
  voiceName: string;
  sampleAudioPath?: string;
  error?: string;
}
```

### 3.10 ZeroTier Service

```typescript
interface ZeroTierService {
  /**
   * Join a ZeroTier network.
   */
  join(networkId: string): Promise<ServiceResult<ZeroTierStatus>>;

  /**
   * Leave the current network.
   */
  leave(): Promise<ServiceResult<void>>;

  /**
   * Get current connection status.
   */
  getStatus(): Promise<ServiceResult<ZeroTierStatus>>;

  /**
   * Test connectivity to a local endpoint.
   */
  testEndpoint(url: string): Promise<ServiceResult<EndpointTestResult>>;

  /**
   * Check if connected.
   */
  isConnected(): boolean;
}

interface ZeroTierStatus {
  isConnected: boolean;
  networkId?: string;
  virtualIp?: string;
  peerCount: number;
  lastHandshake?: number;
}

interface EndpointTestResult {
  reachable: boolean;
  responseTimeMs?: number;
  error?: string;
}
```

### 3.11 Scheduler Service

```typescript
interface SchedulerService {
  /**
   * Schedule a task to run at a specific time.
   */
  scheduleAt(
    id: string,
    time: Date,
    task: () => Promise<void>
  ): void;

  /**
   * Schedule a recurring task.
   */
  scheduleRecurring(
    id: string,
    cronExpression: string,
    task: () => Promise<void>
  ): void;

  /**
   * Cancel a scheduled task.
   */
  cancel(id: string): void;

  /**
   * Cancel all scheduled tasks.
   */
  cancelAll(): void;

  /**
   * Get next run time for a task.
   */
  getNextRunTime(id: string): Date | null;

  /**
   * Initialize default scheduled tasks.
   * Called on app startup.
   */
  initializeDefaultTasks(): Promise<void>;
}
```

### 3.12 Notification Service

```typescript
interface NotificationService {
  /**
   * Request notification permissions.
   */
  requestPermission(): Promise<ServiceResult<boolean>>;

  /**
   * Check if notifications are enabled.
   */
  isEnabled(): Promise<boolean>;

  /**
   * Schedule a local notification.
   */
  schedule(notification: LocalNotification): Promise<ServiceResult<string>>;

  /**
   * Cancel a scheduled notification.
   */
  cancel(notificationId: string): Promise<ServiceResult<void>>;

  /**
   * Cancel all scheduled notifications.
   */
  cancelAll(): Promise<ServiceResult<void>>;

  /**
   * Get pending notifications.
   */
  getPending(): Promise<ServiceResult<LocalNotification[]>>;
}

interface LocalNotification {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduledAt: Date;
  repeatInterval?: 'daily' | 'weekly';
}
```

---

## 4. Event System

### 4.1 Event Types

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// EVENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

type AppEvent =
  // Question Events
  | { type: 'QUESTION_ASKED'; payload: Question }
  | { type: 'QUESTION_DELETED'; payload: { id: string } }
  | { type: 'QUESTION_UPDATED'; payload: Question }

  // Graph Events
  | { type: 'GRAPH_UPDATED'; payload: GraphMetadata }
  | { type: 'EDGE_CREATED'; payload: KnowledgeEdge }
  | { type: 'EDGE_DELETED'; payload: { id: string } }
  | { type: 'CATEGORY_CREATED'; payload: Category }
  | { type: 'CATEGORY_UPDATED'; payload: Category }
  | { type: 'CATEGORY_DELETED'; payload: { id: string } }

  // Review Events
  | { type: 'REVIEW_SESSION_STARTED'; payload: ReviewSession }
  | { type: 'REVIEW_SUBMITTED'; payload: { questionId: string; rating: number } }
  | { type: 'REVIEW_SESSION_COMPLETED'; payload: ReviewStats }
  | { type: 'REVIEW_DUE_COUNT_CHANGED'; payload: { count: number } }

  // Calendar Events
  | { type: 'TODO_CREATED'; payload: TodoItem }
  | { type: 'TODO_STATUS_CHANGED'; payload: TodoItem }
  | { type: 'TODO_DELETED'; payload: { id: string } }
  | { type: 'BLOCK_CREATED'; payload: TimeBlock }
  | { type: 'BLOCK_UPDATED'; payload: TimeBlock }
  | { type: 'BLOCK_DELETED'; payload: { id: string } }

  // Podcast Events
  | { type: 'PODCAST_GENERATION_STARTED'; payload: { podcastId: string; date: string } }
  | { type: 'PODCAST_GENERATION_PROGRESS'; payload: { podcastId: string; progress: number } }
  | { type: 'PODCAST_GENERATION_COMPLETED'; payload: DailyPodcast }
  | { type: 'PODCAST_GENERATION_FAILED'; payload: { podcastId: string; error: string } }

  // Settings Events
  | { type: 'SETTINGS_CHANGED'; payload: { key: keyof AppSettings; value: unknown } }
  | { type: 'LLM_CONFIG_CHANGED'; payload: LLMConfig }
  | { type: 'TTS_CONFIG_CHANGED'; payload: TTSConfig }
  | { type: 'ZEROTIER_STATUS_CHANGED'; payload: ZeroTierStatus }

  // Connection Events
  | { type: 'NETWORK_STATUS_CHANGED'; payload: { isOnline: boolean } }
  | { type: 'LLM_CONNECTION_ERROR'; payload: ServiceError }
  | { type: 'TTS_CONNECTION_ERROR'; payload: ServiceError }

  // App Lifecycle Events
  | { type: 'APP_FOREGROUNDED'; payload: null }
  | { type: 'APP_BACKGROUNDED'; payload: null };
```

### 4.2 Event Bus Interface

```typescript
interface EventBus {
  /**
   * Subscribe to events.
   */
  subscribe<T extends AppEvent['type']>(
    eventType: T,
    handler: (event: Extract<AppEvent, { type: T }>) => void
  ): Unsubscribe;

  /**
   * Subscribe to multiple event types.
   */
  subscribeMany<T extends AppEvent['type']>(
    eventTypes: T[],
    handler: (event: Extract<AppEvent, { type: T }>) => void
  ): Unsubscribe;

  /**
   * Emit an event.
   */
  emit(event: AppEvent): void;

  /**
   * Remove all subscriptions (cleanup).
   */
  clear(): void;
}

type Unsubscribe = () => void;

// Usage Example:
// const unsubscribe = eventBus.subscribe('QUESTION_ASKED', (event) => {
//   console.log('New question:', event.payload.content);
// });
//
// // Later, to unsubscribe:
// unsubscribe();
```

### 4.3 Using Events in UI

```typescript
// React Hook Example
function useEvent<T extends AppEvent['type']>(
  eventType: T,
  handler: (event: Extract<AppEvent, { type: T }>) => void
) {
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(eventType, handler);
    return unsubscribe;
  }, [eventType, handler]);
}

// Usage in component:
function HomeDashboard() {
  const [reviewCount, setReviewCount] = useState(0);

  useEvent('REVIEW_DUE_COUNT_CHANGED', (event) => {
    setReviewCount(event.payload.count);
  });

  // ...
}
```

---

## 5. Component Breakdown

The project is divided into independent components that can be developed in parallel and assembled at integration time.

### 5.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             COMPONENT HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FOUNDATION LAYER (Build First)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  C01: Core Types    C02: Database    C03: Event Bus    C04: Utils  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  PROVIDER LAYER (External Integrations)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  C05: LLM Provider    C06: TTS Provider    C07: ZeroTier Provider  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  SERVICE LAYER (Business Logic)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  C08: Settings    C09: Question    C10: Graph    C11: Review       │   │
│  │  C12: Calendar    C13: Podcast     C14: Scheduler                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  UI LAYER (Screens & Components)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  C15: UI Kit      C16: Navigation    C17: State Management         │   │
│  │  C18: Onboarding  C19: Home          C20: Ask                      │   │
│  │  C21: Calendar    C22: Review        C23: Podcast                  │   │
│  │  C24: Graph       C25: Settings                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Component Specifications

---

#### C01: Core Types

**Purpose**: Shared TypeScript type definitions

**Deliverables**:
```
src/types/
├── entities/
│   ├── question.ts
│   ├── knowledge-graph.ts
│   ├── calendar.ts
│   ├── podcast.ts
│   ├── review.ts
│   └── settings.ts
├── services/
│   ├── service-result.ts
│   ├── pagination.ts
│   └── errors.ts
├── events/
│   └── app-events.ts
└── index.ts
```

**Dependencies**: None

**Interface Contract**: All types from Section 2

**Test Requirements**:
- Type compilation tests
- JSON schema validation tests

---

#### C02: Database Layer

**Purpose**: SQLite database abstraction with migrations

**Deliverables**:
```
src/data/
├── database.ts           # Database connection manager
├── migrations/
│   ├── 001_initial.ts
│   ├── 002_add_embeddings.ts
│   └── index.ts
├── repositories/
│   ├── question.repository.ts
│   ├── category.repository.ts
│   ├── edge.repository.ts
│   ├── todo.repository.ts
│   ├── block.repository.ts
│   ├── podcast.repository.ts
│   └── settings.repository.ts
└── index.ts
```

**Dependencies**: C01 (Core Types)

**Interface Contract**:
```typescript
interface Database {
  initialize(): Promise<void>;
  close(): Promise<void>;
  runMigrations(): Promise<void>;
  getRepository<T>(name: string): Repository<T>;
}

interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(filter?: FilterOptions): Promise<number>;
}
```

**Test Requirements**:
- Unit tests for each repository
- Migration rollback tests
- Concurrent access tests

---

#### C03: Event Bus

**Purpose**: Pub/sub event system for cross-component communication

**Deliverables**:
```
src/events/
├── event-bus.ts
├── event-types.ts
└── index.ts
```

**Dependencies**: C01 (Core Types)

**Interface Contract**: See Section 4.2

**Test Requirements**:
- Subscribe/unsubscribe tests
- Multiple handlers tests
- Memory leak tests (proper cleanup)

---

#### C04: Utilities

**Purpose**: Shared utility functions

**Deliverables**:
```
src/utils/
├── date.ts              # Date formatting, comparison
├── crypto.ts            # Encryption for API keys
├── uuid.ts              # UUID generation
├── validation.ts        # Input validation
├── markdown.ts          # Markdown processing
├── audio.ts             # Audio file manipulation
└── index.ts
```

**Dependencies**: None

**Interface Contract**:
```typescript
// Date utilities
function formatDate(date: Date, format: string): string;
function parseDate(dateStr: string): Date;
function isToday(date: Date): boolean;
function addDays(date: Date, days: number): Date;

// Crypto utilities
function encryptApiKey(key: string): Promise<string>;
function decryptApiKey(encrypted: string): Promise<string>;

// Validation utilities
function isValidApiKey(key: string, provider: string): boolean;
function isValidTimeFormat(time: string): boolean;
function isValidDateFormat(date: string): boolean;
```

**Test Requirements**:
- Unit tests for all utility functions
- Edge case tests (empty inputs, invalid formats)

---

#### C05: LLM Provider

**Purpose**: Abstraction for multiple LLM providers

**Deliverables**:
```
src/providers/llm/
├── llm-provider.interface.ts
├── openai.provider.ts
├── claude.provider.ts
├── local-llm.provider.ts
├── llm-factory.ts
└── index.ts
```

**Dependencies**: C01, C04

**Interface Contract**: See Section 3.8

**Test Requirements**:
- Mock API response tests
- Streaming tests
- Error handling tests
- Timeout tests

---

#### C06: TTS Provider

**Purpose**: Abstraction for TTS providers

**Deliverables**:
```
src/providers/tts/
├── tts-provider.interface.ts
├── openai-tts.provider.ts
├── gptsovits.provider.ts
├── tts-factory.ts
└── index.ts
```

**Dependencies**: C01, C04

**Interface Contract**: See Section 3.9

**Test Requirements**:
- Mock API response tests
- Audio file generation tests
- Error handling tests

---

#### C07: ZeroTier Provider

**Purpose**: ZeroTier network integration

**Deliverables**:
```
src/providers/zerotier/
├── zerotier.service.ts
├── libzt-bridge.ts        # Native module bridge
└── index.ts
```

**Dependencies**: C01, C04

**Interface Contract**: See Section 3.10

**Test Requirements**:
- Connection state tests
- Network join/leave tests
- Endpoint reachability tests

---

#### C08: Settings Service

**Purpose**: Application settings management

**Deliverables**:
```
src/services/settings/
├── settings.service.ts
├── settings.defaults.ts
├── settings.validation.ts
└── index.ts
```

**Dependencies**: C01, C02, C03, C04

**Interface Contract**: See Section 3.7

**Test Requirements**:
- CRUD operation tests
- Encryption tests for sensitive data
- Default value tests
- Import/export tests

---

#### C09: Question Service

**Purpose**: Q&A functionality and question management

**Deliverables**:
```
src/services/question/
├── question.service.ts
├── prompt-builder.ts
├── keyword-extractor.ts
├── answer-parser.ts
└── index.ts
```

**Dependencies**: C01-C06, C08, C10

**Interface Contract**: See Section 3.2

**Test Requirements**:
- Ask flow integration tests
- Related question finding tests
- Search tests
- Stats calculation tests

---

#### C10: Knowledge Graph Service

**Purpose**: Knowledge graph management and analysis

**Deliverables**:
```
src/services/graph/
├── graph.service.ts
├── similarity-calculator.ts
├── relationship-detector.ts
├── graph-layout.ts
└── index.ts
```

**Dependencies**: C01-C05, C08

**Interface Contract**: See Section 3.3

**Test Requirements**:
- Graph operations tests
- Similarity calculation tests
- Relationship detection tests
- Performance tests (1000+ nodes)

---

#### C11: Review Service

**Purpose**: Spaced repetition review system

**Deliverables**:
```
src/services/review/
├── review.service.ts
├── sm2-algorithm.ts
├── session-manager.ts
└── index.ts
```

**Dependencies**: C01-C03, C08, C09

**Interface Contract**: See Section 3.4

**Test Requirements**:
- SM-2 algorithm tests
- Session state tests
- Scheduling accuracy tests

---

#### C12: Calendar Service

**Purpose**: Time blocks and todo management

**Deliverables**:
```
src/services/calendar/
├── calendar.service.ts
├── block-manager.ts
├── todo-manager.ts
├── template-manager.ts
└── index.ts
```

**Dependencies**: C01-C03, C08

**Interface Contract**: See Section 3.5

**Test Requirements**:
- Block CRUD tests
- Todo state transition tests
- Postpone logic tests
- Template tests

---

#### C13: Podcast Service

**Purpose**: Daily podcast generation

**Deliverables**:
```
src/services/podcast/
├── podcast.service.ts
├── script-generator.ts
├── audio-synthesizer.ts
├── audio-assembler.ts
└── index.ts
```

**Dependencies**: C01-C06, C08, C09

**Interface Contract**: See Section 3.6

**Test Requirements**:
- Script generation tests
- Audio assembly tests
- Progress tracking tests
- Error recovery tests

---

#### C14: Scheduler Service

**Purpose**: Background task scheduling

**Deliverables**:
```
src/services/scheduler/
├── scheduler.service.ts
├── task-registry.ts
├── cron-parser.ts
└── index.ts
```

**Dependencies**: C01, C03, C08

**Interface Contract**: See Section 3.11

**Test Requirements**:
- Task scheduling tests
- Cron expression tests
- Task cancellation tests

---

#### C15: UI Kit

**Purpose**: Reusable UI components

**Deliverables**:
```
src/components/ui/
├── Button/
├── Card/
├── Input/
├── Modal/
├── Toast/
├── Skeleton/
├── ProgressBar/
├── Badge/
├── Avatar/
├── Chip/
├── List/
├── Divider/
└── index.ts
```

**Dependencies**: None (pure UI)

**Interface Contract**: Component props interfaces

**Test Requirements**:
- Snapshot tests
- Accessibility tests
- Interaction tests

---

#### C16: Navigation

**Purpose**: App navigation structure

**Deliverables**:
```
src/navigation/
├── RootNavigator.tsx
├── TabNavigator.tsx
├── StackNavigators/
│   ├── HomeStack.tsx
│   ├── AskStack.tsx
│   ├── CalendarStack.tsx
│   └── SettingsStack.tsx
├── linking.ts           # Deep linking config
└── index.ts
```

**Dependencies**: C15, C17

**Interface Contract**: React Navigation types

**Test Requirements**:
- Navigation flow tests
- Deep link tests

---

#### C17: State Management

**Purpose**: Global state management

**Deliverables**:
```
src/state/
├── store.ts
├── slices/
│   ├── auth.slice.ts
│   ├── settings.slice.ts
│   ├── questions.slice.ts
│   ├── calendar.slice.ts
│   ├── review.slice.ts
│   └── podcast.slice.ts
├── hooks/
│   ├── useSettings.ts
│   ├── useQuestions.ts
│   ├── useCalendar.ts
│   ├── useReview.ts
│   └── usePodcast.ts
├── selectors/
└── index.ts
```

**Dependencies**: C01, C03, C08-C14

**Interface Contract**:
```typescript
// Hooks return type examples
function useSettings(): {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isLoading: boolean;
};

function useQuestions(): {
  questions: Question[];
  ask: (content: string) => Promise<void>;
  isAsking: boolean;
  error: ServiceError | null;
};
```

**Test Requirements**:
- State update tests
- Selector tests
- Hook tests

---

#### C18: Onboarding Screens

**Purpose**: First-time user setup flow

**Deliverables**:
```
src/screens/onboarding/
├── WelcomeScreen.tsx
├── LLMSetupScreen.tsx
├── TTSSetupScreen.tsx
├── PermissionsScreen.tsx
├── components/
│   ├── ProviderSelector.tsx
│   ├── ApiKeyInput.tsx
│   └── ConnectionTester.tsx
└── index.ts
```

**Dependencies**: C15-C17, C05, C06, C08

**Test Requirements**:
- Flow completion tests
- Validation tests
- Skip behavior tests

---

#### C19: Home Screen

**Purpose**: Dashboard with summary cards

**Deliverables**:
```
src/screens/home/
├── HomeScreen.tsx
├── components/
│   ├── GreetingHeader.tsx
│   ├── LearningCard.tsx
│   ├── TasksCard.tsx
│   ├── ReviewCard.tsx
│   ├── PodcastCard.tsx
│   └── QuickAskButton.tsx
└── index.ts
```

**Dependencies**: C15-C17, C09, C11, C12, C13

**Test Requirements**:
- Data aggregation tests
- Card state tests
- Navigation tests

---

#### C20: Ask Screens

**Purpose**: Q&A interface

**Deliverables**:
```
src/screens/ask/
├── AskScreen.tsx
├── QuestionDetailScreen.tsx
├── HistoryScreen.tsx
├── components/
│   ├── QuestionInput.tsx
│   ├── AnswerDisplay.tsx
│   ├── RelatedQuestions.tsx
│   ├── LoadingState.tsx
│   ├── RecentQuestions.tsx
│   └── MarkdownRenderer.tsx
└── index.ts
```

**Dependencies**: C15-C17, C09, C10

**Test Requirements**:
- Ask flow tests
- Streaming display tests
- Related questions tests

---

#### C21: Calendar Screens

**Purpose**: Time block and todo management

**Deliverables**:
```
src/screens/calendar/
├── CalendarScreen.tsx
├── BlockEditorScreen.tsx
├── components/
│   ├── DatePicker.tsx
│   ├── TimeBlockList.tsx
│   ├── TimeBlockCard.tsx
│   ├── TodoList.tsx
│   ├── TodoItem.tsx
│   ├── AddTodoInput.tsx
│   └── ReviewSection.tsx
└── index.ts
```

**Dependencies**: C15-C17, C11, C12

**Test Requirements**:
- Block CRUD UI tests
- Todo interaction tests
- Postpone gesture tests

---

#### C22: Review Screens

**Purpose**: Flashcard review interface

**Deliverables**:
```
src/screens/review/
├── ReviewSessionScreen.tsx
├── ReviewCompleteScreen.tsx
├── components/
│   ├── FlashCard.tsx
│   ├── ProgressBar.tsx
│   ├── RatingButtons.tsx
│   ├── SkipButton.tsx
│   └── SessionStats.tsx
└── index.ts
```

**Dependencies**: C15-C17, C11

**Test Requirements**:
- Card flip animation tests
- Rating flow tests
- Session completion tests

---

#### C23: Podcast Screens

**Purpose**: Podcast player interface

**Deliverables**:
```
src/screens/podcast/
├── PodcastPlayerScreen.tsx
├── PodcastListScreen.tsx
├── components/
│   ├── AudioPlayer.tsx
│   ├── ProgressSlider.tsx
│   ├── PlaybackControls.tsx
│   ├── ScriptView.tsx
│   ├── SleepTimer.tsx
│   └── PodcastListItem.tsx
└── index.ts
```

**Dependencies**: C15-C17, C13

**Test Requirements**:
- Playback control tests
- Script sync tests
- Sleep timer tests

---

#### C24: Graph Screen

**Purpose**: Knowledge graph visualization

**Deliverables**:
```
src/screens/graph/
├── GraphScreen.tsx
├── components/
│   ├── GraphCanvas.tsx
│   ├── NodeRenderer.tsx
│   ├── EdgeRenderer.tsx
│   ├── NodePopup.tsx
│   ├── CategoryFilter.tsx
│   └── GraphLegend.tsx
└── index.ts
```

**Dependencies**: C15-C17, C10

**Test Requirements**:
- Rendering performance tests
- Interaction tests
- Filter tests

---

#### C25: Settings Screens

**Purpose**: App configuration interface

**Deliverables**:
```
src/screens/settings/
├── SettingsScreen.tsx
├── LLMConfigScreen.tsx
├── TTSConfigScreen.tsx
├── ZeroTierScreen.tsx
├── ReviewSettingsScreen.tsx
├── DataManagementScreen.tsx
├── components/
│   ├── SettingsGroup.tsx
│   ├── SettingsRow.tsx
│   ├── ProviderConfig.tsx
│   └── ConnectionStatus.tsx
└── index.ts
```

**Dependencies**: C15-C17, C05-C08

**Test Requirements**:
- Config save tests
- Connection test UI tests
- Data export/import tests

---

## 6. Dependency Graph

```
                                    ┌─────────┐
                                    │   C01   │ Core Types
                                    │  Types  │
                                    └────┬────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
              ┌─────────┐          ┌─────────┐          ┌─────────┐
              │   C02   │          │   C03   │          │   C04   │
              │Database │          │ Events  │          │  Utils  │
              └────┬────┘          └────┬────┘          └────┬────┘
                   │                    │                    │
                   └────────────────────┼────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
              ┌─────────┐         ┌─────────┐         ┌─────────┐
              │   C05   │         │   C06   │         │   C07   │
              │   LLM   │         │   TTS   │         │ZeroTier │
              └────┬────┘         └────┬────┘         └────┬────┘
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
        ┌─────────┐              ┌─────────┐              ┌─────────┐
        │   C08   │              │   C09   │◄────────────▶│   C10   │
        │Settings │              │Question │              │  Graph  │
        └────┬────┘              └────┬────┘              └────┬────┘
             │                        │                        │
             │    ┌───────────────────┼───────────────────┐    │
             │    │                   │                   │    │
             │    ▼                   ▼                   ▼    │
             │ ┌─────────┐      ┌─────────┐         ┌─────────┐│
             │ │   C11   │      │   C12   │         │   C13   ││
             │ │ Review  │      │Calendar │         │ Podcast ││
             │ └────┬────┘      └────┬────┘         └────┬────┘│
             │      │                │                   │     │
             └──────┼────────────────┼───────────────────┼─────┘
                    │                │                   │
                    └────────────────┼───────────────────┘
                                     │
                               ┌─────────┐
                               │   C14   │
                               │Scheduler│
                               └────┬────┘
                                    │
    ════════════════════════════════╪════════════════════════════════
                                    │       UI BOUNDARY
                                    ▼
        ┌─────────┐           ┌─────────┐           ┌─────────┐
        │   C15   │           │   C16   │           │   C17   │
        │  UI Kit │           │  Nav    │           │  State  │
        └────┬────┘           └────┬────┘           └────┬────┘
             │                     │                     │
             └─────────────────────┼─────────────────────┘
                                   │
        ┌──────────┬───────────┬───┴───┬───────────┬──────────┐
        │          │           │       │           │          │
        ▼          ▼           ▼       ▼           ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │  C18   │ │  C19   │ │  C20   │ │  C21   │ │  C22   │ │  C23   │
   │Onboard │ │  Home  │ │  Ask   │ │Calendar│ │ Review │ │Podcast │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘

                         ┌────────┐ ┌────────┐
                         │  C24   │ │  C25   │
                         │ Graph  │ │Settings│
                         └────────┘ └────────┘
```

---

## 7. Integration Strategy

### 7.1 Integration Phases

```
PHASE 1: Foundation (Week 1-2)
├── C01: Core Types ────────────┐
├── C02: Database Layer ────────┤
├── C03: Event Bus ─────────────┼──▶ Integration Test: Data Layer
├── C04: Utilities ─────────────┘
└── C15: UI Kit ───────────────────▶ Storybook Setup

PHASE 2: Providers (Week 2-3)
├── C05: LLM Provider ──────────┐
├── C06: TTS Provider ──────────┼──▶ Integration Test: External APIs
└── C07: ZeroTier Provider ─────┘

PHASE 3: Core Services (Week 3-5)
├── C08: Settings Service ──────┐
├── C09: Question Service ──────┤
├── C10: Graph Service ─────────┼──▶ Integration Test: Q&A Flow
├── C11: Review Service ────────┤
├── C12: Calendar Service ──────┤
├── C13: Podcast Service ───────┤
└── C14: Scheduler Service ─────┘

PHASE 4: UI Foundation (Week 4-5)
├── C16: Navigation ────────────┐
└── C17: State Management ──────┴──▶ Integration Test: State Flow

PHASE 5: Screens (Week 5-7)
├── C18: Onboarding ────────────┐
├── C19: Home ──────────────────┤
├── C20: Ask ───────────────────┤
├── C21: Calendar ──────────────┼──▶ Integration Test: Full E2E
├── C22: Review ────────────────┤
├── C23: Podcast ───────────────┤
├── C24: Graph ─────────────────┤
└── C25: Settings ──────────────┘

PHASE 6: Polish & Release (Week 7-8)
├── Performance Optimization
├── Accessibility Audit
├── Bug Fixes
└── Release Preparation
```

### 7.2 Integration Points

| Integration Point | Components | Test Strategy |
|-------------------|------------|---------------|
| Data Layer | C01, C02, C03 | Unit + Integration tests with SQLite |
| LLM Integration | C05, C09 | Mock API tests + Live API tests |
| TTS Integration | C06, C13 | Mock API tests + Audio validation |
| Q&A Flow | C05, C09, C10 | End-to-end flow tests |
| Review Flow | C09, C11, C17 | Session state tests |
| Calendar Flow | C12, C17, C21 | Todo state transition tests |
| Podcast Flow | C05, C06, C09, C13 | Generation pipeline tests |
| Settings Flow | C08, C17, C25 | Persistence tests |

### 7.3 Interface Contracts for Integration

Each integration point should have a contract test:

```typescript
// Example: Q&A Flow Contract Test
describe('Q&A Flow Contract', () => {
  it('should return AskResult with required fields', async () => {
    const result = await questionService.ask('What is TypeScript?');

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      question: expect.objectContaining({
        id: expect.any(String),
        content: 'What is TypeScript?',
        answer: expect.any(String),
        keywords: expect.any(Array),
      }),
      relatedQuestions: expect.any(Array),
      newConnections: expect.any(Number),
    });
  });
});
```

---

## 8. Development Workflow

### 8.1 Parallel Development Strategy

```
TEAM A (2 developers): Foundation + Services
├── Week 1-2: C01, C02, C03, C04
├── Week 2-3: C05, C06, C07
├── Week 3-5: C08, C09, C10, C11, C12, C13, C14
└── Week 6-7: Integration support

TEAM B (2 developers): UI + Screens
├── Week 1-2: C15 (UI Kit)
├── Week 2-3: C16, C17
├── Week 3-7: C18-C25
└── Week 7-8: Polish

TEAM C (1 developer): Quality & Integration
├── Week 1-8: Test infrastructure
├── Week 3-5: Integration tests
├── Week 6-8: E2E tests + Bug fixes
```

### 8.2 Mock Interfaces for Parallel Development

UI developers can work with mock services:

```typescript
// src/services/__mocks__/question.service.mock.ts
export const mockQuestionService: QuestionService = {
  async ask(content: string) {
    await delay(1000); // Simulate API delay
    return {
      success: true,
      data: {
        question: createMockQuestion(content),
        relatedQuestions: [createMockQuestion('Related 1')],
        newConnections: 2,
      },
    };
  },
  // ... other methods
};
```

### 8.3 Feature Flags for Incremental Integration

```typescript
// src/config/features.ts
export const features = {
  // Enable/disable features during development
  KNOWLEDGE_GRAPH: true,
  PODCAST_GENERATION: false,  // Enable when TTS ready
  ZEROTIER_SUPPORT: false,    // Enable when native module ready
  STREAMING_RESPONSES: true,
};

// Usage in UI:
if (features.PODCAST_GENERATION) {
  showPodcastCard();
}
```

### 8.4 Version Compatibility

```typescript
// Service version tracking for compatibility
interface ServiceVersion {
  name: string;
  version: string;
  minCompatibleVersion: string;
}

const serviceVersions: ServiceVersion[] = [
  { name: 'QuestionService', version: '1.0.0', minCompatibleVersion: '1.0.0' },
  { name: 'GraphService', version: '1.0.0', minCompatibleVersion: '1.0.0' },
  // ...
];
```

---

## Appendix A: Error Handling Patterns

### A.1 Service Layer Error Handling

```typescript
// Wrap all service methods with error handler
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<ServiceResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: mapToServiceError(error, context),
    };
  }
}

// Usage:
async ask(content: string): Promise<ServiceResult<AskResult>> {
  return withErrorHandling(
    () => this.doAsk(content),
    'QuestionService.ask'
  );
}
```

### A.2 UI Layer Error Handling

```typescript
// React hook for service calls
function useServiceCall<T>(
  serviceCall: () => Promise<ServiceResult<T>>
) {
  const [state, setState] = useState<{
    data: T | null;
    error: ServiceError | null;
    isLoading: boolean;
  }>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const result = await serviceCall();
    if (result.success) {
      setState({ data: result.data, error: null, isLoading: false });
    } else {
      setState({ data: null, error: result.error, isLoading: false });
    }
  }, [serviceCall]);

  return { ...state, execute };
}
```

---

## Appendix B: Testing Strategy

### B.1 Test Categories

| Category | Scope | Tools | Run Frequency |
|----------|-------|-------|---------------|
| Unit | Single function/class | Jest | Every commit |
| Integration | Component interactions | Jest + Supertest | Every PR |
| E2E | Full user flows | Detox/Maestro | Nightly |
| Performance | Response times, memory | Custom benchmarks | Weekly |
| Accessibility | A11y compliance | axe-core | Every PR |

### B.2 Test File Structure

```
src/
├── services/
│   ├── question/
│   │   ├── question.service.ts
│   │   ├── question.service.test.ts        # Unit tests
│   │   └── question.service.integration.ts # Integration tests
│   └── ...
└── screens/
    ├── ask/
    │   ├── AskScreen.tsx
    │   ├── AskScreen.test.tsx              # Component tests
    │   └── AskScreen.e2e.ts                # E2E tests
    └── ...
```

---

## Appendix C: API Request/Response Examples

### C.1 Question Service - Ask

**Request:**
```typescript
await questionService.ask("What is dialectical materialism?");
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "question": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": 1707408000000,
      "date": "2025-02-08",
      "content": "What is dialectical materialism?",
      "answer": "Dialectical materialism is a philosophy...",
      "summary": "Marx's philosophical framework combining dialectics with materialism",
      "keywords": ["Marx", "dialectics", "materialism", "Hegel"],
      "relatedQuestionIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "categoryIds": ["philosophy"],
      "reviewSchedule": {
        "nextReviewDate": "2025-02-09",
        "reviewCount": 0,
        "easeFactor": 2.5
      },
      "createdAt": 1707408000000,
      "updatedAt": 1707408000000
    },
    "relatedQuestions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "content": "What is Hegelian dialectics?",
        "summary": "Hegel's method of philosophical reasoning"
      }
    ],
    "newConnections": 2
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "API_QUOTA_EXCEEDED",
    "message": "OpenAI API quota has been exceeded. Please check your billing.",
    "details": {
      "provider": "openai",
      "statusCode": 429
    },
    "retryable": true
  }
}
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-02-09 | System | Initial specification |
