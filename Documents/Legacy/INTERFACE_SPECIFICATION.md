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
6. [Integration Strategy](#6-integration-strategy)

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
│       └────────────┴────────────┴────────────┴────────────┘                 │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  STATE MANAGEMENT (Zustand / Context)                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                    ═══════════════╪═══════════════  Interface Boundary
                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER (Backend)                          │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐            │
│  │Question │ │Knowledge │ │Calendar │ │ Review  │ │ Podcast  │   ...      │
│  │Service  │ │  Graph   │ │ Service │ │ Service │ │ Service  │            │
│  │         │ │ Service  │ │         │ │         │ │          │            │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬────┘ └────┬─────┘            │
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
}

interface ReviewSchedule {
  nextReviewDate: string;          // "YYYY-MM-DD"
  reviewCount: number;             // Times reviewed
  easeFactor: number;              // SM-2 ease factor (default 2.5)
}

interface Category {
  id: string;
  name: string;
  parentId?: string;               // For hierarchical categories
  color: string;                   // Hex color code
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

interface KnowledgeNode {
  id: string;                      // Same as Question.id
  label: string;                   // Display label (summary)
  categoryIds: string[];
  weight: number;                  // Visual weight (0-1)
  createdAt: number;
  lastAccessedAt: number;
}

interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationType;
  strength: number;                // 0-1
}

type RelationType =
  | 'prerequisite'    // Source is required to understand target
  | 'extends'         // Target extends/elaborates source
  | 'contradicts'     // Source and target have opposing views
  | 'similar'         // Related by topic
  | 'part_of'         // Source is component of target
  | 'example_of';     // Source is instance of target concept

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
  audioPath?: string;              // Local file path
  duration?: number;               // Total seconds
  status: PodcastStatus;
  progress?: number;               // 0-100 during generation
  error?: string;                  // Error message if failed
  createdAt: number;
}

type PodcastStatus = 'pending' | 'generating' | 'ready' | 'failed';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

interface AppSettings {
  llm: LLMConfig;
  tts: TTSConfig;
  zerotier: ZeroTierConfig;
  podcast: PodcastSettings;
  review: ReviewSettings;
  preferences: AppPreferences;
}

interface LLMConfig {
  provider: 'openai' | 'claude' | 'local';
  apiKey?: string;                 // Encrypted
  baseUrl?: string;
  model: string;
  isConfigured: boolean;
}

interface TTSConfig {
  provider: 'openai' | 'gptsovits';
  apiKey?: string;                 // Encrypted
  baseUrl?: string;
  voice: string;
  speed: number;
  isConfigured: boolean;
}

interface ZeroTierConfig {
  networkId?: string;
  isConnected: boolean;
  virtualIp?: string;
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
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED RESPONSE TYPE
// ═══════════════════════════════════════════════════════════════════════════

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

interface ServiceError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

type ErrorCode =
  | 'NETWORK_ERROR'
  | 'API_KEY_INVALID'
  | 'API_QUOTA_EXCEEDED'
  | 'API_RATE_LIMITED'
  | 'DATABASE_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN_ERROR';
```

---

## 3. Service Layer Interfaces

### 3.1 Service Registry

```typescript
/**
 * Central access point for all services.
 * Initialize once at app startup; use throughout the app.
 */
interface ServiceRegistry {
  readonly settings: SettingsService;
  readonly question: QuestionService;
  readonly knowledgeGraph: KnowledgeGraphService;
  readonly review: ReviewService;
  readonly calendar: CalendarService;
  readonly podcast: PodcastService;
  readonly llm: LLMService;
  readonly tts: TTSService;
  readonly zerotier: ZeroTierService;
  readonly notification: NotificationService;

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
  /** Submit a new question to the AI and store the result. */
  ask(content: string): Promise<ServiceResult<AskResult>>;

  /** Get a single question by ID. */
  getById(id: string): Promise<ServiceResult<Question>>;

  /** Get questions for a specific date. */
  getByDate(date: string): Promise<ServiceResult<Question[]>>;

  /** Get the N most recent questions. */
  getRecent(limit: number): Promise<ServiceResult<Question[]>>;

  /** Full-text search across questions and answers. */
  search(query: string): Promise<ServiceResult<Question[]>>;

  /** Delete a question and its graph connections. */
  delete(id: string): Promise<ServiceResult<void>>;
}

interface AskResult {
  question: Question;
  relatedQuestions: Question[];    // Related historical questions
  newConnections: number;          // Count of new graph edges created
}
```

### 3.3 Knowledge Graph Service

```typescript
interface KnowledgeGraphService {
  /** Get nodes directly connected to a specific node. */
  getNeighbors(nodeId: string): Promise<ServiceResult<KnowledgeNode[]>>;

  /** Get all categories. */
  getCategories(): Promise<ServiceResult<Category[]>>;

  /** Create a new category. */
  createCategory(
    name: string,
    color: string,
    parentId?: string
  ): Promise<ServiceResult<Category>>;
}
```

### 3.4 Review Service

```typescript
interface ReviewService {
  /** Get questions due for review today, capped by dailyLimit setting. */
  getTodayReviewItems(): Promise<ServiceResult<Question[]>>;

  /** Get count of items due for review (for badge/notification). */
  getTodayReviewCount(): Promise<ServiceResult<number>>;

  /**
   * Submit a review rating for a question.
   * Updates the review schedule using SM-2 algorithm.
   */
  submitReview(
    questionId: string,
    rating: 1 | 2 | 3 | 4 | 5
  ): Promise<ServiceResult<ReviewSchedule>>;

  /** Skip a question — resets to due tomorrow. */
  skipReview(questionId: string): Promise<ServiceResult<void>>;
}
```

### 3.5 Calendar Service

```typescript
interface CalendarService {
  /** Get the full schedule for a specific date. */
  getDaySchedule(date: string): Promise<ServiceResult<DaySchedule>>;

  // ── Time Block Operations ──────────────────────────────────────────────

  /** Create a new time block for a given date. */
  createBlock(
    date: string,
    startTime: string,
    endTime: string,
    label: string
  ): Promise<ServiceResult<TimeBlock>>;

  /** Update a time block's label or time range. */
  updateBlock(
    blockId: string,
    updates: Partial<Pick<TimeBlock, 'startTime' | 'endTime' | 'label'>>
  ): Promise<ServiceResult<TimeBlock>>;

  /** Delete a time block and all its todos. */
  deleteBlock(blockId: string): Promise<ServiceResult<void>>;

  // ── Todo Operations ────────────────────────────────────────────────────

  /** Add a todo to a specific time block. */
  addTodo(blockId: string, content: string): Promise<ServiceResult<TodoItem>>;

  /** Toggle todo status: pending → completed → pending. */
  updateTodoStatus(
    todoId: string,
    status: TodoStatus
  ): Promise<ServiceResult<TodoItem>>;

  /**
   * Postpone a todo to the next block.
   * Returns the new todo item created in the next block.
   */
  postponeTodo(todoId: string): Promise<ServiceResult<TodoItem>>;

  /** Delete a todo. */
  deleteTodo(todoId: string): Promise<ServiceResult<void>>;
}
```

### 3.6 Podcast Service

```typescript
interface PodcastService {
  /** Get podcast for a specific date. */
  getPodcast(date: string): Promise<ServiceResult<DailyPodcast | null>>;

  /** Get all podcasts, most recent first. */
  getPodcasts(limit?: number): Promise<ServiceResult<DailyPodcast[]>>;

  /**
   * Generate podcast for a date.
   * Long-running — subscribe to PODCAST_GENERATION_PROGRESS events for updates.
   */
  generatePodcast(date: string): Promise<ServiceResult<DailyPodcast>>;

  /** Retry a failed podcast generation. */
  retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>>;

  /** Get the local audio file path for playback. */
  getAudioPath(podcastId: string): ServiceResult<string>;

  /** Delete a podcast and its audio files. */
  deletePodcast(podcastId: string): Promise<ServiceResult<void>>;
}
```

### 3.7 Settings Service

```typescript
interface SettingsService {
  /** Get all settings. */
  getAll(): Promise<ServiceResult<AppSettings>>;

  /** Get a specific settings group. */
  get<K extends keyof AppSettings>(key: K): Promise<ServiceResult<AppSettings[K]>>;

  /** Update a specific settings group. */
  set<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<ServiceResult<void>>;

  /** Reset all settings to factory defaults. */
  reset(): Promise<ServiceResult<AppSettings>>;
}
```

### 3.8 LLM Service

```typescript
interface LLMService {
  /** Test connection with current configuration. */
  testConnection(): Promise<ServiceResult<ConnectionTestResult>>;

  /** Send a chat message and get response. */
  chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ServiceResult<ChatResponse>>;

  /** Send a chat message with streaming response. */
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<ServiceResult<ChatChunk>>;

  /** Generate embedding vector for text. */
  generateEmbedding(text: string): Promise<ServiceResult<number[]>>;

  /** Check if LLM is configured and ready. */
  isReady(): boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

interface ChatResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

interface ChatChunk {
  content: string;
  isComplete: boolean;
}

interface ConnectionTestResult {
  success: boolean;
  responseTimeMs: number;
  error?: string;
}
```

### 3.9 TTS Service

```typescript
interface TTSService {
  /** Test connection with current configuration. */
  testConnection(): Promise<ServiceResult<ConnectionTestResult>>;

  /** Synthesize text and save to a local file. */
  synthesizeToFile(
    text: string,
    filePath: string,
    options?: TTSOptions
  ): Promise<ServiceResult<{ path: string; duration: number }>>;

  /** Get available voices for current provider. */
  getAvailableVoices(): Promise<ServiceResult<VoiceInfo[]>>;

  /** Check if TTS is configured and ready. */
  isReady(): boolean;
}

interface TTSOptions {
  voice?: string;
  speed?: number;   // 0.25 to 4.0
}

interface VoiceInfo {
  id: string;
  name: string;
  language: string;
}
```

### 3.10 ZeroTier Service

```typescript
interface ZeroTierService {
  /** Join a ZeroTier network. */
  join(networkId: string): Promise<ServiceResult<ZeroTierStatus>>;

  /** Leave the current network. */
  leave(): Promise<ServiceResult<void>>;

  /** Get current connection status. */
  getStatus(): Promise<ServiceResult<ZeroTierStatus>>;

  /** Test connectivity to a local endpoint (e.g., local LLM). */
  testEndpoint(url: string): Promise<ServiceResult<{ reachable: boolean; responseTimeMs?: number }>>;

  /** Check if connected. */
  isConnected(): boolean;
}

interface ZeroTierStatus {
  isConnected: boolean;
  networkId?: string;
  virtualIp?: string;
}
```

### 3.11 Notification Service

```typescript
interface NotificationService {
  /** Request notification permissions from the OS. */
  requestPermission(): Promise<ServiceResult<boolean>>;

  /** Schedule a local notification. */
  schedule(notification: LocalNotification): Promise<ServiceResult<string>>;

  /** Cancel a specific scheduled notification. */
  cancel(notificationId: string): Promise<ServiceResult<void>>;

  /** Cancel all scheduled notifications (used on shutdown). */
  cancelAll(): Promise<ServiceResult<void>>;
}

interface LocalNotification {
  id?: string;
  title: string;
  body: string;
  scheduledAt: Date;
  repeatInterval?: 'daily';
}
```

---

## 4. Event System

### 4.1 Event Types

```typescript
type AppEvent =
  // Question Events
  | { type: 'QUESTION_ASKED'; payload: Question }
  | { type: 'QUESTION_DELETED'; payload: { id: string } }

  // Graph Events
  | { type: 'GRAPH_UPDATED'; payload: { nodeCount: number; edgeCount: number } }
  | { type: 'CATEGORY_CREATED'; payload: Category }

  // Review Events
  | { type: 'REVIEW_SUBMITTED'; payload: { questionId: string; rating: number } }
  | { type: 'REVIEW_DUE_COUNT_CHANGED'; payload: { count: number } }

  // Calendar Events
  | { type: 'TODO_CREATED'; payload: TodoItem }
  | { type: 'TODO_STATUS_CHANGED'; payload: TodoItem }
  | { type: 'BLOCK_CREATED'; payload: TimeBlock }
  | { type: 'BLOCK_UPDATED'; payload: TimeBlock }

  // Podcast Events
  | { type: 'PODCAST_GENERATION_STARTED'; payload: { podcastId: string; date: string } }
  | { type: 'PODCAST_GENERATION_PROGRESS'; payload: { podcastId: string; progress: number } }
  | { type: 'PODCAST_GENERATION_COMPLETED'; payload: DailyPodcast }
  | { type: 'PODCAST_GENERATION_FAILED'; payload: { podcastId: string; error: string } }

  // Settings Events
  | { type: 'LLM_CONFIG_CHANGED'; payload: LLMConfig }
  | { type: 'TTS_CONFIG_CHANGED'; payload: TTSConfig }
  | { type: 'ZEROTIER_STATUS_CHANGED'; payload: ZeroTierStatus }

  // Network Events
  | { type: 'NETWORK_STATUS_CHANGED'; payload: { isOnline: boolean } };
```

### 4.2 Event Bus Interface

```typescript
interface EventBus {
  subscribe<T extends AppEvent['type']>(
    eventType: T,
    handler: (event: Extract<AppEvent, { type: T }>) => void
  ): Unsubscribe;

  emit(event: AppEvent): void;
}

type Unsubscribe = () => void;

// Usage example:
// const unsub = eventBus.subscribe('QUESTION_ASKED', (event) => {
//   console.log('New question:', event.payload.content);
// });
// unsub(); // cleanup
```

### 4.3 React Hook Pattern

```typescript
function useEvent<T extends AppEvent['type']>(
  eventType: T,
  handler: (event: Extract<AppEvent, { type: T }>) => void
) {
  useEffect(() => {
    return eventBus.subscribe(eventType, handler);
  }, [eventType, handler]);
}

// Usage in component:
function HomeDashboard() {
  const [reviewCount, setReviewCount] = useState(0);
  useEvent('REVIEW_DUE_COUNT_CHANGED', (e) => setReviewCount(e.payload.count));
}
```

---

## 5. Component Breakdown

Components are organized into four build layers. Each layer depends only on the layers below it.

### 5.1 Component Overview

```
FOUNDATION LAYER  ──────────────────────────────────────────────────────────
  C01: Core Types      C02: Database       C03: Utilities + Event Bus

PROVIDER LAYER  ────────────────────────────────────────────────────────────
  C04: LLM Provider    C05: TTS Provider   C06: ZeroTier Provider

SERVICE LAYER  ─────────────────────────────────────────────────────────────
  C07: Settings        C08: Question       C09: Knowledge Graph
  C10: Review          C11: Calendar       C12: Podcast

UI LAYER  ──────────────────────────────────────────────────────────────────
  C13: UI Kit          C14: Navigation + State
  C15: Onboarding      C16: Home           C17: Ask
  C18: Calendar        C19: Review         C20: Podcast
                       C22: Settings
```

### 5.2 Foundation Layer

---

#### C01: Core Types

**Purpose**: Shared TypeScript type definitions used by all other components.

**Deliverables**: `src/types/index.ts` — all types from Section 2.

**Dependencies**: None

---

#### C02: Database Layer

**Purpose**: SQLite database abstraction with migrations and typed repositories.

**Deliverables**:
```
src/data/
├── database.ts
├── migrations/
│   └── 001_initial.ts
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

**Dependencies**: C01

**Interface Contract**:
```typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: { limit?: number; filter?: Record<string, unknown> }): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

---

#### C03: Utilities + Event Bus

**Purpose**: Shared utility functions and pub/sub event system.

**Deliverables**:
```
src/lib/
├── event-bus.ts     # EventBus implementation (Section 4.2)
├── date.ts          # Date formatting and comparison
├── crypto.ts        # Encryption for API keys
├── uuid.ts          # UUID generation
└── index.ts
```

**Dependencies**: None

---

### 5.3 Provider Layer

---

#### C04: LLM Provider

**Purpose**: Abstraction for multiple LLM providers (OpenAI, Claude, Local).

**Deliverables**:
```
src/providers/llm/
├── openai.provider.ts
├── claude.provider.ts
├── local-llm.provider.ts
├── llm-factory.ts      # Returns correct provider from settings
└── index.ts
```

**Dependencies**: C01, C03

**Interface Contract**: See Section 3.8

---

#### C05: TTS Provider

**Purpose**: Abstraction for TTS providers (OpenAI TTS, GPT-SoVITS).

**Deliverables**:
```
src/providers/tts/
├── openai-tts.provider.ts
├── gptsovits.provider.ts
├── tts-factory.ts
└── index.ts
```

**Dependencies**: C01, C03

**Interface Contract**: See Section 3.9

---

#### C06: ZeroTier Provider

**Purpose**: ZeroTier virtual network integration for local LLM/TTS access.

**Deliverables**:
```
src/providers/zerotier/
├── zerotier.service.ts
├── libzt-bridge.ts     # Native module bridge
└── index.ts
```

**Dependencies**: C01, C03

**Interface Contract**: See Section 3.10

---

### 5.4 Service Layer

---

#### C07: Settings Service

**Purpose**: Application settings persistence and retrieval.

**Deliverables**: `src/services/settings/index.ts`

**Dependencies**: C01, C02, C03

**Interface Contract**: See Section 3.7

---

#### C08: Question Service

**Purpose**: Q&A submission, retrieval, search, and lifecycle.

**Deliverables**:
```
src/services/question/
├── question.service.ts
├── prompt-builder.ts    # Builds augmented prompts with related context
└── index.ts
```

**Dependencies**: C01–C05, C07, C09

**Interface Contract**: See Section 3.2

---

#### C09: Knowledge Graph Service

**Purpose**: Knowledge graph construction, storage, and querying.

**Deliverables**:
```
src/services/graph/
├── graph.service.ts
├── similarity-calculator.ts
└── index.ts
```

**Dependencies**: C01–C05, C07

**Interface Contract**: See Section 3.3

---

#### C10: Review Service

**Purpose**: Spaced repetition scheduling and review session management.

**Deliverables**:
```
src/services/review/
├── review.service.ts
├── sm2-algorithm.ts
└── index.ts
```

**Dependencies**: C01–C03, C07, C08

**Interface Contract**: See Section 3.4

---

#### C11: Calendar Service

**Purpose**: Time blocks and todo management.

**Deliverables**:
```
src/services/calendar/
├── calendar.service.ts
└── index.ts
```

**Dependencies**: C01–C03, C07

**Interface Contract**: See Section 3.5

---

#### C12: Podcast Service

**Purpose**: Daily podcast script generation and audio synthesis.

**Deliverables**:
```
src/services/podcast/
├── podcast.service.ts
├── script-generator.ts   # LLM prompt → script
├── audio-synthesizer.ts  # TTS → audio files
└── index.ts
```

**Dependencies**: C01–C07, C08

**Interface Contract**: See Section 3.6

---

### 5.5 UI Layer

---

#### C13: UI Kit

**Purpose**: Reusable, unstyled base components.

**Deliverables**: `src/components/ui/` — Button, Card, Input, Modal, Toast, Skeleton, ProgressBar, Badge.

**Dependencies**: None (pure UI)

---

#### C14: Navigation + State Management

**Purpose**: App navigation structure and global state store.

**Deliverables**:
```
src/navigation/          # Tab + Stack navigators
src/state/
├── store.ts
├── slices/              # One slice per domain
└── hooks/               # useSettings, useQuestions, useReview, etc.
```

**Dependencies**: C01, C03, C07–C12

**Interface Contract**:
```typescript
// Hook return type examples
function useQuestions(): {
  questions: Question[];
  ask: (content: string) => Promise<void>;
  isAsking: boolean;
  error: ServiceError | null;
};

function useReview(): {
  items: Question[];
  submitReview: (id: string, rating: 1 | 2 | 3 | 4 | 5) => Promise<void>;
  skipReview: (id: string) => Promise<void>;
  isLoading: boolean;
};
```

---

#### C15: Onboarding Screens

**Purpose**: First-time API configuration flow.

**Key screens**: WelcomeScreen, LLMSetupScreen, TTSSetupScreen, PermissionsScreen

**Dependencies**: C13, C14, C04, C05, C07

---

#### C16: Home Screen

**Purpose**: Dashboard with summary cards and quick-ask entry.

**Key components**: GreetingHeader, LearningCard (today's Q count), ReviewCard (due count), TasksCard, PodcastCard, QuickAskButton

**Dependencies**: C13, C14, C08, C10, C11, C12

---

#### C17: Ask Screens

**Purpose**: Q&A interface with chat-style layout.

**Key screens**: AskScreen, QuestionDetailScreen, HistoryScreen

**Key components**: QuestionInput, AnswerDisplay (streaming Markdown), RelatedQuestions

**Dependencies**: C13, C14, C08, C09

---

#### C18: Calendar Screens

**Purpose**: Time block and todo management.

**Key screens**: CalendarScreen, BlockEditorScreen

**Key components**: DatePicker, TimeBlockList, TimeBlockCard, TodoList, ReviewSection (bottom)

**Dependencies**: C13, C14, C10, C11

---

#### C19: Review Screens

**Purpose**: Flashcard-style spaced repetition interface.

**Key screens**: ReviewSessionScreen, ReviewCompleteScreen

**Key components**: FlashCard (question → reveal answer), RatingButtons (1–5), ProgressBar

**Dependencies**: C13, C14, C10

---

#### C20: Podcast Screens

**Purpose**: Podcast player and list.

**Key screens**: PodcastPlayerScreen, PodcastListScreen, ScriptFullScreen

**Key components**: AudioPlayer, ProgressSlider, PlaybackControls (play/pause + ±10s seek), PodcastListItem, ScriptViewer

**Playback controls**: Play/Pause button flanked by −10s (RotateCcw) and +10s (RotateCw) seek buttons. Seeking works for both real audio (adjusts `HTMLAudioElement.currentTime`) and simulated playback (adjusts progress percentage directly).

**Script full-screen view**: Tapping the Script Preview section opens a fixed full-screen overlay (`z-index: 1000`) with a scrollable area showing the complete script. A back button (ArrowLeft) returns to the player. The overlay unmounts on back — no persistent state needed.

**Dependencies**: C13, C14, C12

---

#### C21: Settings Screens

**Purpose**: App configuration for LLM, TTS, ZeroTier, and preferences.

**Key screens**: SettingsScreen, LLMConfigScreen, TTSConfigScreen, ZeroTierScreen, ReviewSettingsScreen

**Key components**: SettingsGroup, SettingsRow, ProviderConfig, ConnectionStatus

**Dependencies**: C13, C14, C04–C07

---

## 6. Integration Strategy

### 6.1 Build Phases

```
PHASE 1: Foundation (Week 1)
  C01 Core Types ─────────────────────────────▶ All other components depend on this
  C02 Database ────────────────────────────────▶ Repositories ready for services
  C03 Utilities + Event Bus ───────────────────▶ Shared infrastructure ready
  C13 UI Kit ──────────────────────────────────▶ Base components for all screens

PHASE 2: Providers + Settings (Week 2)
  C04 LLM Provider ────────────────────────────┐
  C05 TTS Provider ────────────────────────────┼──▶ External API integration verified
  C06 ZeroTier Provider ───────────────────────┘
  C07 Settings Service ────────────────────────▶ Settings persisted and readable

PHASE 3: Core Services (Week 3–4)
  C08 Question Service ────────────────────────┐
  C09 Knowledge Graph Service ─────────────────┼──▶ Full Q&A flow working
  C10 Review Service ──────────────────────────┤
  C11 Calendar Service ────────────────────────┤
  C12 Podcast Service ─────────────────────────┘

PHASE 4: UI Foundation + Screens (Week 4–6)
  C14 Navigation + State ──────────────────────▶ App shell navigable
  C15 Onboarding ──────────────────────────────┐
  C16 Home ────────────────────────────────────┤
  C17 Ask ─────────────────────────────────────┤
  C18 Calendar ────────────────────────────────┼──▶ All screens integrated E2E
  C19 Review ──────────────────────────────────┤
  C20 Podcast ─────────────────────────────────┤
  C21 Settings ────────────────────────────────┘
```

### 6.2 Mock Services for UI Development

UI screens can be developed in parallel with services using mocks:

```typescript
// src/services/__mocks__/question.service.mock.ts
export const mockQuestionService: QuestionService = {
  async ask(content: string) {
    await delay(800); // Simulate API delay
    return {
      success: true,
      data: {
        question: createMockQuestion(content),
        relatedQuestions: [createMockQuestion('Related question 1')],
        newConnections: 2,
      },
    };
  },
  // ... other methods
};
```

### 6.3 Feature Flags

Use feature flags to enable features incrementally as services are completed:

```typescript
// src/config/features.ts
export const features = {
  KNOWLEDGE_GRAPH: true,
  PODCAST_GENERATION: false,  // Enable when TTS is ready
  ZEROTIER_SUPPORT: false,    // Enable when native module is ready
  STREAMING_RESPONSES: true,
};
```

---

## Appendix A: Error Handling Patterns

### Service Layer

```typescript
// Wrap service methods with a consistent error handler
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
  return withErrorHandling(() => this.doAsk(content), 'QuestionService.ask');
}
```

### UI Layer

```typescript
// React hook for service calls
function useServiceCall<T>(serviceCall: () => Promise<ServiceResult<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await serviceCall();
    if (result.success) {
      setData(result.data ?? null);
    } else {
      setError(result.error ?? null);
    }
    setIsLoading(false);
  }, [serviceCall]);

  return { data, error, isLoading, execute };
}
```

---

## Appendix B: Request/Response Example

### Question Service — Ask

**Request:**
```typescript
await questionService.ask("What is dialectical materialism?");
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "question": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "date": "2025-02-08",
      "content": "What is dialectical materialism?",
      "answer": "Dialectical materialism is a philosophy...",
      "summary": "Marx's philosophical framework combining dialectics with materialism",
      "keywords": ["Marx", "dialectics", "materialism", "Hegel"],
      "relatedQuestionIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "reviewSchedule": { "nextReviewDate": "2025-02-09", "reviewCount": 0, "easeFactor": 2.5 },
      "createdAt": 1707408000000
    },
    "relatedQuestions": [{ "id": "...", "content": "What is Hegelian dialectics?", "summary": "..." }],
    "newConnections": 2
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "API_QUOTA_EXCEEDED",
    "message": "OpenAI API quota exceeded. Please check your billing.",
    "retryable": true
  }
}
```

---

## Document Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-02-09 | Initial specification |
| 1.1.0 | 2026-02-26 | Simplified: reduced service methods to MVP, merged C03/C04, reduced components from 25→22, removed AnalyticsService and SchedulerService, simplified event types and error codes |
| 1.2.0 | 2026-02-27 | C20 Podcast: added ±10s seek controls; added Script full-screen overlay with scrollable script view |
