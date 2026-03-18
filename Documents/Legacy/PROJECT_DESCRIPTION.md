# EchoLearn 项目描述文档

## 项目概述

EchoLearn 是一款无后端架构（Serverless）的移动端知识管理与自我提升应用。核心理念是通过 **即时学习、智能关联、间隔复习** 的闭环，帮助用户将碎片化的好奇心转化为系统化的知识体系。

---

## 一、项目目标

### 1.1 核心价值主张

- **触手可及的学习**：任何时刻产生好奇，立即获得解答
- **知识的连接**：新知识自动与已有知识建立联系（费曼学习法）
- **记忆的巩固**：艾宾浩斯曲线自动安排复习，对抗遗忘
- **一天的回顾**：睡前播客总结当日所学，强化记忆编码
- **时间的掌控**：区块化日程管理，聚焦当下任务

### 1.2 目标用户

- 终身学习者
- 学生（备考、知识积累）
- 知识工作者
- 对自我提升有追求的人群

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| 隐私优先 | 所有数据本地存储，用户完全掌控 |
| 零依赖 | 不依赖任何自建服务器，仅调用用户配置的 API |
| 低成本 | 支持本地 LLM，实现零付费使用 |
| 简洁专注 | 界面简洁，减少干扰，专注学习本身 |

---

## 二、功能模块详细设计

### 2.1 AI 即时问答模块

#### 功能描述
用户可随时向 AI 提出任何问题，系统记录对话并自动关联已有知识。每次对话均以持久化的 `ChatSession` 存储，标题取自首条用户消息（截取前 60 字符）。

#### 业务逻辑
```
用户提问
    → 构建增强提示词（包含相关历史问答的摘要）
    → 调用 LLM API 流式回答
    → 将消息追加到当前 ChatSession 并自动保存
    → 返回回答（附带关联知识提示）
    → 用户点击 "New Chat" 时，后台异步触发本次会话的 Flashcard 提取
```

#### 数据模型
```typescript
interface SessionMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  relatedKnowledge?: string[];
  questionId?: string;
  // isStreaming 仅为 UI 瞬态，不持久化
}

interface ChatSession {
  id: string;
  title: string;       // 首条用户消息，最长 60 字符
  createdAt: number;
  updatedAt: number;
  messages: SessionMessage[];
  processed: boolean;  // Flashcard 提取完成后置 true
}

interface Question {
  id: string;                    // UUID
  timestamp: number;             // Unix 时间戳
  date: string;                  // YYYY-MM-DD 格式，用于按日检索
  content: string;               // 用户问题原文
  answer: string;                // AI 回答原文
  summary: string;               // 问答摘要（用于图谱检索）
  keywords: string[];            // 提取的关键词
  relatedQuestionIds: string[];  // 关联问题 ID
  categoryIds: string[];         // 所属分类 ID
  embedding?: number[];          // 语义向量（可选，用于相似度计算）
  reviewSchedule: ReviewSchedule; // 复习计划
}

interface ReviewSchedule {
  nextReviewDate: string;        // 下次复习日期
  reviewCount: number;           // 已复习次数
  easeFactor: number;            // 难度系数（SM-2算法）
}
```

### 2.3 FlashCard 生成模块

#### 功能描述
当用户开始新对话时，系统在后台对刚关闭的会话调用 LLM，从对话记录中提取可记忆的知识点，生成简洁的 FlashCard 卡片对（正面为问题/提示，背面为答案）。

#### 触发时机
- 用户点击 "New Chat" 按钮
- 当前会话至少包含一条用户消息，且 `session.processed === false`

#### 提取流程
```
会话结束（用户开始新对话）
    → 后台发起 LLM 调用（非流式，一次性）
    → 系统提示要求输出 JSON 数组 [{front, back}, ...]
    → 解析结果，为每条条目生成 FlashCard 对象
    → 存入 localStorage (echolearn_flashcards)
    → 将 session.processed 置 true
    → 发出 FLASHCARDS_CREATED 事件
```

#### 数据模型
```typescript
interface FlashCard {
  id: string;
  sessionId: string;        // 来源 ChatSession 的 ID
  front: string;            // 简洁问题或提示（≤120 字符）
  back: string;             // 简洁答案（≤200 字符）
  createdAt: number;
  reviewSchedule: ReviewSchedule;
}
```

### 2.4 每日播客生成模块

#### 功能描述
每日自动总结用户的问答，生成故事化/播客化的音频内容。

#### 业务逻辑
```
触发时机：用户设定睡眠时间前 1 小时
    → 收集当日所有问答记录
    → 调用 LLM 生成播客脚本（故事化叙述）
    → 将脚本分段
    → 逐段调用 TTS API 生成音频片段
    → 本地拼接音频片段为完整播客
    → 通知用户播客已就绪
```

#### 数据模型
```typescript
interface DailyPodcast {
  id: string;
  date: string;                  // YYYY-MM-DD
  questionIds: string[];         // 包含的问答 ID
  script: string;                // 播客脚本全文
  audioSegments: AudioSegment[]; // 音频片段
  finalAudioPath: string;        // 合成后的音频文件路径
  duration: number;              // 总时长（秒）
  status: PodcastStatus;
  createdAt: number;
}

type PodcastStatus = 'pending' | 'generating' | 'ready' | 'failed';

interface AudioSegment {
  index: number;
  text: string;
  audioPath: string;
  duration: number;
}
```

### 2.5 艾宾浩斯复习模块

#### 功能描述
基于遗忘曲线自动安排复习，确保知识长期留存。

#### 复习间隔算法（SM-2 变体）
```typescript
function calculateNextReview(
  reviewCount: number,
  easeFactor: number,
  userRating: 1 | 2 | 3 | 4 | 5  // 用户反馈：1=完全忘记，5=轻松记得
): { nextInterval: number; newEaseFactor: number } {

  // 基础间隔：1, 2, 4, 7, 15, 30, 60, 120...
  const baseIntervals = [1, 2, 4, 7, 15, 30, 60, 120];

  let interval: number;
  if (reviewCount < baseIntervals.length) {
    interval = baseIntervals[reviewCount];
  } else {
    interval = baseIntervals[baseIntervals.length - 1] *
               Math.pow(easeFactor, reviewCount - baseIntervals.length + 1);
  }

  // 根据用户反馈调整
  const ratingMultiplier = {1: 0.5, 2: 0.75, 3: 1, 4: 1.2, 5: 1.5};
  interval = Math.round(interval * ratingMultiplier[userRating]);

  // 更新难度系数
  const newEaseFactor = Math.max(1.3,
    easeFactor + (0.1 - (5 - userRating) * (0.08 + (5 - userRating) * 0.02))
  );

  return { nextInterval: interval, newEaseFactor };
}
```

#### 数据模型
```typescript
interface ReviewSession {
  id: string;
  date: string;
  questionIds: string[];         // 今日待复习的问题
  completedIds: string[];        // 已完成复习的问题
  skippedIds: string[];          // 跳过的问题
}
```

### 2.6 日历与待办清单模块

#### 功能描述
将一天划分为多个时间区块，每个区块管理独立的待办清单。

#### 数据模型
```typescript
interface DaySchedule {
  date: string;                  // YYYY-MM-DD
  blocks: TimeBlock[];
  reviewItems: string[];         // 当日需复习的问题 ID（显示在底部）
}

interface TimeBlock {
  id: string;
  startTime: string;             // HH:MM 格式
  endTime: string;
  label: string;                 // 区块名称，如 "上午工作"、"午休"
  todos: TodoItem[];
}

interface TodoItem {
  id: string;
  content: string;               // 待办内容
  status: TodoStatus;
  createdAt: number;
  completedAt?: number;
  postponedFrom?: string;        // 从哪个区块推迟来的
}

type TodoStatus = 'pending' | 'completed' | 'postponed';
```

#### 推迟逻辑
```
用户将任务标记为 "推迟"：
    → 当前区块中该任务状态改为 'postponed'
    → 在下一个区块的 todos 中创建副本，状态为 'pending'
    → 记录 postponedFrom 字段用于追溯
```

---

## 三、技术架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        EchoLearn App                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   UI Layer  │  │   UI Layer  │  │   UI Layer  │    ...      │
│  │  (问答页面)  │  │  (日历页面)  │               │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                    Service Layer                            │
│  │  ┌──────────┐        ┌──────────┐ ┌──────────┐             │
│  │  │ Question │        │ Podcast  │ │ Calendar │             │
│  │  │ Service  │        │ Service  │ │ Service  │             │
│  │  │          │        │          │ │          │             │
│  │  └────┬─────┘        └────┬─────┘ └────┬─────┘             │
│  └───────┼─────────────────────────────────┼────────────────────┤
│          │                                 │                   │
│          ▼                                 ▼                   │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                     Data Layer                              │
│  │  ┌─────────────────────────────────────────────────────┐   │
│  │  │              Local Database (SQLite)                 │   │
│  │  │  - Questions Table    - Podcasts Table              │   │
│  │  │  - TodoItems Table    - TimeBlocks Table            │   │
│  │  │  - Settings Table     - ReviewSchedule Table        │   │
│  │  └─────────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┤
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   LLM API    │  │   TTS API    │  │   ZeroTier   │
    │              │  │              │  │   (libzt)    │
    │ - OpenAI     │  │ - OpenAI TTS │  │              │
    │ - Claude     │  │ - GPT-SoVITS │  │ 连接本地部署  │
    │ - Local LLM  │  │   (本地)     │  │  的 LLM/TTS  │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### 3.2 API 接入层设计

#### LLM API 抽象接口
```typescript
interface LLMProvider {
  name: string;
  sendMessage(
    messages: ChatMessage[],
    options?: LLMOptions
  ): Promise<LLMResponse>;

  generateEmbedding?(text: string): Promise<number[]>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}
```

#### TTS API 抽象接口
```typescript
interface TTSProvider {
  name: string;
  synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<AudioData>;
}

interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
}

interface AudioData {
  format: 'mp3' | 'wav' | 'ogg';
  data: ArrayBuffer;
  duration: number;
}
```

#### 支持的 Provider 实现

| Provider | 类型 | 说明 |
|----------|------|------|
| OpenAIProvider | LLM | OpenAI GPT 系列 |
| ClaudeProvider | LLM | Anthropic Claude 系列 |
| LocalLLMProvider | LLM | 兼容 OpenAI API 格式的本地 LLM（LM Studio） |
| OpenAITTSProvider | TTS | OpenAI TTS API |
| GPTSoVITSProvider | TTS | 本地部署的 GPT-SoVITS |

### 3.3 ZeroTier 内网穿透集成

#### 目的
允许移动设备访问用户 PC 上本地部署的 LLM（如 LM Studio）和 TTS（如 GPT-SoVITS）。

#### 实现方式
```typescript
interface ZeroTierConfig {
  networkId: string;             // ZeroTier 网络 ID
  localLLMEndpoint?: string;     // 如 "http://192.168.194.1:1234/v1"
  localTTSEndpoint?: string;     // 如 "http://192.168.194.1:9880"
}

// 使用 libzt (ZeroTier SDK) 建立虚拟网络连接
// 参考: https://github.com/zerotier/libzt
```

#### 连接流程
```
1. 用户在设置中输入 ZeroTier Network ID
2. App 使用 libzt 加入该虚拟网络
3. 用户输入本地服务的虚拟 IP 地址和端口
4. App 通过虚拟网络直接访问本地服务
```

### 3.4 本地数据存储

#### 数据库选型
- **SQLite**：作为主要关系型存储
- **文件系统**：存储音频文件

#### 数据库表结构
```sql
-- 问答记录表
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    answer TEXT NOT NULL,
    summary TEXT,
    keywords TEXT,  -- JSON array
    related_question_ids TEXT,  -- JSON array
    category_ids TEXT,  -- JSON array
    embedding BLOB,  -- 向量数据
    next_review_date TEXT,
    review_count INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    created_at INTEGER NOT NULL
);

-- 播客表
CREATE TABLE podcasts (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    question_ids TEXT NOT NULL,  -- JSON array
    script TEXT,
    audio_path TEXT,
    duration INTEGER,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 时间区块表
CREATE TABLE time_blocks (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL
);

-- 待办事项表
CREATE TABLE todo_items (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    postponed_from TEXT,
    FOREIGN KEY (block_id) REFERENCES time_blocks(id)
);

-- 设置表
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 索引
CREATE INDEX idx_questions_date ON questions(date);
CREATE INDEX idx_questions_next_review ON questions(next_review_date);
CREATE INDEX idx_time_blocks_date ON time_blocks(date);
CREATE INDEX idx_todo_items_block ON todo_items(block_id);
```

---

## 四、前端硬性需求规范

> **重要**：以下是后端数据层和服务层对前端的最低硬性需求。前端 UI/UX 设计可以自由发挥，但必须满足这些功能性约束。

### 4.1 必须实现的页面/视图

| 页面 | 必要性 | 说明 |
|------|--------|------|
| 问答主页 | **必须** | 用户输入问题、显示回答的核心交互界面 |
| 日历视图 | **必须** | 展示时间区块和待办清单 |
| 复习视图 | **必须** | 展示今日待复习内容，支持复习交互 |
| 播客播放器 | **必须** | 播放每日生成的播客 |
| 设置页 | **必须** | 配置 API、ZeroTier、睡眠时间等 |
| 历史记录 | **建议** | 按日期浏览历史问答 |

### 4.2 问答页面硬性要求

#### 必须提供的 UI 元素
- [ ] **文本输入框**：用户输入问题
- [ ] **发送按钮**：触发问答请求
- [ ] **回答显示区**：展示 AI 回答，支持 Markdown 渲染
- [ ] **关联知识提示**：显示与本问题相关的历史问题（可点击跳转）
- [ ] **加载状态指示**：API 请求期间的加载反馈

#### 必须调用的 Service 方法
```typescript
// 提交问题
QuestionService.ask(content: string): Promise<QuestionResult>

// 返回结果包含
interface QuestionResult {
  question: Question;           // 完整问答记录
  relatedQuestions: Question[]; // 相关历史问题
}
```

#### 数据绑定要求
- 回答显示必须绑定 `question.answer`
- 关联问题必须绑定 `relatedQuestions` 数组
- 必须处理 API 错误状态并向用户展示

### 4.3 日历页面硬性要求

#### 必须提供的 UI 元素
- [ ] **日期选择器**：选择查看哪一天
- [ ] **时间区块列表**：垂直排列当天的时间区块
- [ ] **区块内待办清单**：每个区块内显示其待办事项
- [ ] **待办状态切换**：点击切换 pending/completed/postponed
- [ ] **添加待办按钮**：在指定区块添加新待办
- [ ] **复习区域**：日历底部显示当日需复习的问题

#### 必须调用的 Service 方法
```typescript
// 获取某日的完整日程
CalendarService.getDaySchedule(date: string): Promise<DaySchedule>

// 添加待办
CalendarService.addTodo(blockId: string, content: string): Promise<TodoItem>

// 更新待办状态
CalendarService.updateTodoStatus(
  todoId: string,
  status: TodoStatus
): Promise<void>

// 推迟待办到下一区块
CalendarService.postponeTodo(todoId: string): Promise<TodoItem>

// 获取当日待复习问题
ReviewService.getTodayReviewItems(): Promise<Question[]>
```

#### 待办状态显示要求
- `pending`：显示为未勾选状态
- `completed`：显示为已勾选状态，建议有删除线或变灰效果
- `postponed`：显示为特殊标记（如箭头图标），表示已移至下一区块

### 4.4 复习页面硬性要求

#### 必须提供的 UI 元素
- [ ] **待复习问题卡片**：逐个展示待复习的问题
- [ ] **显示/隐藏答案**：先显示问题，用户点击后显示答案
- [ ] **记忆评分按钮**：1-5 分评价记忆程度
- [ ] **进度指示**：显示已复习/总数
- [ ] **跳过按钮**：跳过当前问题

#### 必须调用的 Service 方法
```typescript
// 获取今日待复习
ReviewService.getTodayReviewItems(): Promise<Question[]>

// 提交复习结果
ReviewService.submitReview(
  questionId: string,
  rating: 1 | 2 | 3 | 4 | 5
): Promise<void>

// 跳过复习
ReviewService.skipReview(questionId: string): Promise<void>
```

#### 评分按钮要求
评分必须为 1-5 整数，对应含义：
| 评分 | 含义 |
|------|------|
| 1 | 完全忘记 |
| 2 | 大部分忘记，看到答案才想起 |
| 3 | 有印象但不完整 |
| 4 | 记得较清楚 |
| 5 | 轻松记得 |

### 4.5 播客播放器硬性要求

#### 必须提供的 UI 元素
- [ ] **播放/暂停按钮**
- [ ] **进度条**：可拖动跳转
- [ ] **当前时间/总时长显示**
- [ ] **播客列表**：按日期列出可用播客
- [ ] **播客状态指示**：显示 generating/ready/failed

#### 必须调用的 Service 方法
```typescript
// 获取播客列表
PodcastService.getPodcasts(): Promise<DailyPodcast[]>

// 获取指定日期的播客
PodcastService.getPodcast(date: string): Promise<DailyPodcast | null>

// 手动触发生成
PodcastService.generatePodcast(date: string): Promise<void>

// 获取音频文件路径
PodcastService.getAudioPath(podcastId: string): string
```

#### 音频播放要求
- 必须能播放本地存储的音频文件
- 必须支持后台播放（如果平台允许）
- 播放进度应可保存和恢复

### 4.6 设置页硬性要求

#### 必须提供的配置项

##### LLM 配置
- [ ] **Provider 选择**：下拉选择 OpenAI / Claude / Local LLM
- [ ] **API Key 输入**：安全文本输入框
- [ ] **API Base URL**：自定义 API 地址（用于本地 LLM）
- [ ] **模型选择**：选择使用的模型
- [ ] **连接测试按钮**：测试 API 是否可用

##### TTS 配置
- [ ] **Provider 选择**：OpenAI TTS / GPT-SoVITS
- [ ] **API Key 输入**：安全文本输入框
- [ ] **API Base URL**：自定义 API 地址
- [ ] **语音选择**：选择 TTS 语音
- [ ] **试听按钮**：播放测试音频

##### ZeroTier 配置
- [ ] **Network ID 输入**
- [ ] **连接状态显示**
- [ ] **连接/断开按钮**

##### 播客配置
- [ ] **睡眠时间设置**：时间选择器
- [ ] **提前生成时间**：默认 1 小时，可调整

##### 复习配置
- [ ] **每日复习上限**：限制每日最大复习数量
- [ ] **复习提醒开关**

#### 必须调用的 Service 方法
```typescript
// 保存设置
SettingsService.set(key: string, value: any): Promise<void>

// 读取设置
SettingsService.get<T>(key: string): Promise<T | null>

// 测试 LLM 连接
LLMService.testConnection(): Promise<boolean>

// 测试 TTS 连接
TTSService.testConnection(): Promise<boolean>

// ZeroTier 操作
ZeroTierService.join(networkId: string): Promise<void>
ZeroTierService.leave(): Promise<void>
ZeroTierService.getStatus(): Promise<ZTStatus>
```

### 4.7 通用 UI 要求

#### 错误处理
- 所有 API 调用失败必须向用户展示错误信息
- 网络错误应提示用户检查连接
- API 配额耗尽应明确提示

#### 加载状态
- 所有异步操作必须有加载指示
- 长时间操作（如播客生成）应显示进度

#### 数据同步
- 数据变更后相关视图必须刷新
- 使用状态管理确保数据一致性

#### 通知
- 复习提醒需要系统通知
- 播客生成完成需要通知

### 4.8 必须响应的后台事件

#### 定时任务触发器
前端必须实现以下定时检查逻辑：

```typescript
// 每日复习检查（建议每天早上触发）
async function checkDailyReview() {
  const items = await ReviewService.getTodayReviewItems();
  if (items.length > 0) {
    showNotification(`今日有 ${items.length} 条知识需要复习`);
  }
}

// 播客生成触发（睡前1小时）
async function checkPodcastGeneration() {
  const settings = await SettingsService.get('sleepTime');
  const now = new Date();
  // 如果当前时间是睡前1小时，且今日播客未生成
  if (isOneHourBeforeSleep(now, settings.sleepTime)) {
    const podcast = await PodcastService.getPodcast(today());
    if (!podcast || podcast.status === 'failed') {
      await PodcastService.generatePodcast(today());
    }
  }
}
```

---

## 五、非功能性需求

### 5.1 性能要求
- 问答响应：取决于 LLM API 延迟，前端应支持流式显示
- 数据库查询：常用查询应在 100ms 内完成

### 5.2 安全要求
- API Key 必须加密存储
- 本地数据库建议加密（可选）
- 网络传输使用 HTTPS

### 5.3 平台要求
- 主要平台：iOS 和 Android
- 建议框架：React Native / Flutter
- 最低系统版本：iOS 14+ / Android 8+

---

## 六、开发路线图建议

### Phase 1: MVP（核心体验）
- [ ] 基础问答功能
- [ ] 本地数据存储
- [ ] API 配置界面
- [ ] 简单的历史记录

### Phase 2: 知识关联
- [ ] 关键词提取与关联问题自动链接（内部数据结构）
- [ ] 问答页面展示关联历史问题提示

### Phase 3: 复习系统
- [ ] 艾宾浩斯算法
- [ ] 复习界面
- [ ] 复习提醒

### Phase 4: 日程管理
- [ ] 日历视图
- [ ] 时间区块
- [ ] 待办清单

### Phase 5: 播客功能
- [ ] TTS 集成
- [ ] 音频生成
- [ ] 播客播放器

### Phase 6: 高级功能
- [ ] ZeroTier 集成
- [ ] 本地 LLM 支持
- [ ] 本地 TTS 支持

---

## 附录 A：设置项 Key 定义

| Key | 类型 | 说明 |
|-----|------|------|
| `llm.provider` | string | 'openai' \| 'claude' \| 'local' |
| `llm.apiKey` | string | API 密钥（加密存储） |
| `llm.baseUrl` | string | API 基础地址 |
| `llm.model` | string | 模型名称 |
| `tts.provider` | string | 'openai' \| 'gptsovits' |
| `tts.apiKey` | string | TTS API 密钥 |
| `tts.baseUrl` | string | TTS API 地址 |
| `tts.voice` | string | 语音名称 |
| `zerotier.networkId` | string | ZeroTier 网络 ID |
| `podcast.sleepTime` | string | 睡眠时间 HH:MM |
| `podcast.advanceMinutes` | number | 提前生成分钟数 |
| `review.dailyLimit` | number | 每日复习上限 |
| `review.notificationEnabled` | boolean | 是否开启复习提醒 |

---

## 附录 B：LLM Prompt 模板

### 问答增强 Prompt
```
你是一个知识助手。用户问了一个问题，请回答这个问题。

用户之前问过以下相关问题，请在回答时自然地提及这些关联（如果相关的话）：
{related_questions_summary}

用户问题：{user_question}

请提供清晰、准确、有深度的回答。如果问题与之前的知识有关联，请指出这些联系帮助用户构建知识网络。
```

### 关键词提取 Prompt
```
请从以下问答中提取 3-5 个关键概念词：

问题：{question}
回答：{answer}

以 JSON 数组格式返回：["关键词1", "关键词2", ...]
```

### 播客脚本生成 Prompt
```
请将以下今日学习内容整理成一个 5-10 分钟的播客脚本。

要求：
1. 以轻松的对话风格叙述
2. 自然地串联各个主题
3. 强调知识之间的联系
4. 结尾做简要总结

今日学习内容：
{daily_questions_and_answers}

请生成播客脚本：
```
