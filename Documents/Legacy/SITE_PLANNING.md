# EchoLearn Site Planning Document

## Document Purpose

This document defines the minimal screen inventory, navigation structure, states, and edge cases for the EchoLearn mobile application. It serves as a contract between backend requirements and frontend implementation.

---

## Stated Assumptions

Based on clarification from the product owner:

| Decision | Choice |
|----------|--------|
| Onboarding | API configuration required first, with "Skip" option |
| Home Screen | Dashboard with quick summary blocks + microphone quick-ask |
| Podcast Player | Full-screen dedicated experience |
| Primary Platform | Mobile (iOS/Android) |

---

## 1. Minimal Screen Inventory

### 1.1 Screen Map Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APP LAUNCH                                    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │   First Launch Check        │
                    │   (API Configured?)         │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
        ┌───────────────────┐         ┌───────────────────┐
        │  Onboarding Flow  │         │    Home Dashboard │
        │  (API Setup)      │────────▶│                   │
        └───────────────────┘  Skip   └─────────┬─────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
        ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
        │   Ask Screen      │     │  Calendar Screen  │     │  Profile/Settings │
        │   (Full Q&A)      │     │  (Tasks + Blocks) │     │                   │
        └─────────┬─────────┘     └─────────┬─────────┘     └───────────────────┘
                  │                         │
                  ▼                         ▼
        ┌───────────────────┐     ┌───────────────────┐
        │  Question Detail  │     │  Review Session   │
        └───────────────────┘     └───────────────────┘

        ┌───────────────────┐
        │  Podcast Player   │ (full-screen overlay, accessible from Home/notifications)
        └───────────────────┘
```

### 1.2 Complete Screen List

| # | Screen | Type | Priority |
|---|--------|------|----------|
| 1 | Onboarding - Welcome | Modal Flow | P0 |
| 2 | Onboarding - LLM Setup | Modal Flow | P0 |
| 3 | Onboarding - TTS Setup | Modal Flow | P1 |
| 4 | Onboarding - Permissions | Modal Flow | P1 |
| 5 | Home Dashboard | Main Tab | P0 |
| 6 | Ask Screen | Main Tab | P0 |
| 7 | Calendar Screen | Main Tab | P0 |
| 8 | Settings/Profile | Main Tab | P0 |
| 9 | Question Detail | Stacked | P0 |
| 10 | Review Session | Stacked/Modal | P0 |
| 11 | Podcast Player | Full-screen Overlay | P1 |
| 12 | History Browser | Stacked | P2 |

---

## 2. Screen Specifications

### 2.1 Onboarding Flow

#### Screen: Onboarding - Welcome
```
┌─────────────────────────────────┐
│                                 │
│         [App Logo]              │
│                                 │
│      Welcome to EchoLearn       │
│                                 │
│   Turn your curiosity into      │
│   structured knowledge          │
│                                 │
│                                 │
│                                 │
│   ┌─────────────────────────┐   │
│   │      Get Started        │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Understand the app's value and begin setup

**System Responsibility:**
- Check if this is first launch
- Present welcoming introduction
- Transition to API setup

**Usability Risk:** User may not understand why API setup is needed. Consider adding brief explanation: "EchoLearn uses AI to answer your questions. Let's connect to an AI service."

---

#### Screen: Onboarding - LLM Setup
```
┌─────────────────────────────────┐
│  ←                    Step 1/3  │
├─────────────────────────────────┤
│                                 │
│   Connect Your AI              │
│                                 │
│   Choose a provider:           │
│   ┌─────────────────────────┐   │
│   │ ○ OpenAI (GPT)          │   │
│   │ ○ Claude (Anthropic)    │   │
│   │ ○ Local LLM (Advanced)  │   │
│   └─────────────────────────┘   │
│                                 │
│   API Key                       │
│   ┌─────────────────────────┐   │
│   │ sk-••••••••••••••••     │   │
│   └─────────────────────────┘   │
│                                 │
│   [Test Connection]             │
│   ✓ Connection successful       │
│                                 │
│   ┌─────────────────────────┐   │
│   │         Next            │   │
│   └─────────────────────────┘   │
│                                 │
│         Skip for now →          │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Configure LLM access to enable Q&A functionality

**System Responsibility:**
- Validate API key format before testing
- Test connection with a simple API call
- Securely store API key (encrypted)
- Allow skip but track incomplete setup state

**Usability Risks:**
1. User may not have an API key ready - provide "Where do I get this?" link
2. Connection test may fail silently - show clear error messages
3. "Local LLM" option is advanced - hide behind expandable section or show warning

**States:**
| State | Display |
|-------|---------|
| Empty | Provider unselected, API key field empty, Next disabled |
| Partial | Provider selected, API key entered but untested |
| Testing | Spinner on test button, inputs disabled |
| Success | Green checkmark, Next button enabled |
| Error | Red error message below input, retry option |
| Skipped | Warning banner appears on Home indicating setup incomplete |

---

#### Screen: Onboarding - TTS Setup
```
┌─────────────────────────────────┐
│  ←                    Step 2/3  │
├─────────────────────────────────┤
│                                 │
│   Enable Voice Podcasts         │
│                                 │
│   Generate audio summaries of   │
│   your daily learning.          │
│                                 │
│   Provider:                     │
│   ┌─────────────────────────┐   │
│   │ ○ OpenAI TTS            │   │
│   │ ○ Local GPT-SoVITS      │   │
│   └─────────────────────────┘   │
│                                 │
│   API Key                       │
│   ┌─────────────────────────┐   │
│   │ ••••••••••••••••        │   │
│   └─────────────────────────┘   │
│                                 │
│   Voice: [Alloy ▼]              │
│                                 │
│   [▶ Test Voice]                │
│                                 │
│   ┌─────────────────────────┐   │
│   │         Next            │   │
│   └─────────────────────────┘   │
│                                 │
│         Skip for now →          │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Enable podcast generation feature

**System Responsibility:**
- Similar validation as LLM setup
- Audio playback for voice preview
- Store TTS configuration

**Usability Risk:** User may skip TTS setup and later be confused why podcasts don't work. Show clear indication in Podcast screen that TTS is not configured.

---

#### Screen: Onboarding - Permissions & Schedule
```
┌─────────────────────────────────┐
│  ←                    Step 3/3  │
├─────────────────────────────────┤
│                                 │
│   Set Your Schedule             │
│                                 │
│   When do you usually sleep?    │
│   ┌─────────────────────────┐   │
│   │       22:30             │   │
│   └─────────────────────────┘   │
│   We'll prepare your podcast    │
│   1 hour before.                │
│                                 │
│   ─────────────────────────     │
│                                 │
│   Notifications                 │
│   ┌─────────────────────────┐   │
│   │ Review reminders    [●] │   │
│   │ Podcast ready       [●] │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │     Start Learning      │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Set up scheduling preferences for automated features

**System Responsibility:**
- Request notification permissions from OS
- Store sleep time for podcast scheduling
- Complete onboarding and transition to Home

**Usability Risk:** Time picker may be unfamiliar. Use native platform time picker. Default to reasonable time (22:00-23:00).

---

### 2.2 Home Dashboard

```
┌─────────────────────────────────┐
│  EchoLearn              [👤]    │
├─────────────────────────────────┤
│                                 │
│  ☀️ Good morning, ready to      │
│     learn something new?        │
│                                 │
│  ┌─────────────────────────────┐│
│  │  📚 Today's Learning        ││
│  │                             ││
│  │  3 questions asked          ││
│  │  2 new connections made     ││
│  │                      → View ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  ✅ Tasks                   ││
│  │                             ││
│  │  5 pending · 2 completed    ││
│  │  Next: "Review chapter 3"   ││
│  │                      → View ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  🧠 Review Due              ││
│  │                             ││
│  │  8 flashcards to review     ││
│  │                    → Start  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  🎧 Tonight's Podcast       ││
│  │  Ready to play (12:34)      ││
│  │                    → Listen ││
│  └─────────────────────────────┘│
│                                 │
│                                 │
│          ┌───────┐              │
│          │  🎤   │              │
│          │  Ask  │              │
│          └───────┘              │
│                                 │
├─────────────────────────────────┤
│  [🏠]    [💬]    [📅]    [⚙️]   │
│  Home     Ask   Calendar  More  │
└─────────────────────────────────┘
```

**User Goal:** Get a quick overview of learning progress and decide next action

**System Responsibility:**
- Aggregate data from multiple services (Questions, Todos, Reviews, Podcasts)
- Dynamically adjust greeting based on time of day
- Show real-time counts
- Provide quick navigation to all major features
- Surface the most relevant action (review due > tasks > new learning)

**Usability Risks:**
1. Information overload - prioritize and collapse sections based on relevance
2. Microphone button may be missed - ensure high visual contrast
3. Card tap targets must be large enough (44pt minimum)

**States:**

| State | Display |
|-------|---------|
| New User (no data) | Encouraging empty state: "Ask your first question to start building your knowledge!" |
| API Not Configured | Warning banner at top with "Complete Setup" button |
| No Reviews Due | Review card shows "All caught up! 🎉" |
| No Tasks | Tasks card shows "No tasks for today. Add one?" |
| Podcast Generating | Podcast card shows progress indicator |
| Podcast Failed | Podcast card shows error with retry option |
| Podcast Not Available | "No learning today to summarize" or "Configure TTS to enable" |

---

### 2.3 Ask Screen

```
┌─────────────────────────────────┐
│  Ask Anything              [📜] │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────────┐│
│  │ What did Marx mean by       ││
│  │ "dialectical materialism"?  ││
│  │                             ││
│  │                        [➤]  ││
│  └─────────────────────────────┘│
│                                 │
│  Recent Questions:              │
│  ┌─────────────────────────────┐│
│  │ • What is capitalism?    →  ││
│  │ • Explain Hegelian logic →  ││
│  │ • Who was Engels?        →  ││
│  └─────────────────────────────┘│
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│  [🏠]    [💬]    [📅]    [⚙️]   │
└─────────────────────────────────┘
```

**After Question Submitted (Loading):**
```
┌─────────────────────────────────┐
│  ←  Ask                         │
├─────────────────────────────────┤
│                                 │
│  You asked:                     │
│  ┌─────────────────────────────┐│
│  │ What did Marx mean by       ││
│  │ "dialectical materialism"?  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │    ◠ ◡ ◠  Thinking...       ││
│  │                             ││
│  │    Finding related past     ││
│  │    questions...             ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘
```

**After Response Received:**
```
┌─────────────────────────────────┐
│  ←                       [⋮]   │
├─────────────────────────────────┤
│                                 │
│  You asked:                     │
│  What did Marx mean by          │
│  "dialectical materialism"?     │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  Dialectical materialism is...  │
│  [Full markdown-rendered        │
│   response content here with    │
│   proper formatting, lists,     │
│   code blocks if applicable]    │
│                                 │
│  ...combines Hegel's dialectic  │
│  method with a materialist      │
│  worldview.                     │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  🔗 Related Knowledge:          │
│  ┌─────────────────────────────┐│
│  │ ⤴ Hegelian dialectics      ││
│  │   (asked 3 days ago)        ││
│  ├─────────────────────────────┤│
│  │ ⤴ Marxist economics        ││
│  │   (asked last week)         ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  🎤  Ask a follow-up        ││
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Ask a question and receive an informative answer with knowledge connections

**System Responsibility:**
- Accept natural language input
- Show meaningful loading state with progress indication
- Retrieve answer from LLM
- Store Q&A and link to related past questions
- Support follow-up questions in context

**Usability Risks:**
1. Long LLM response times may frustrate users - show streaming response if API supports it
2. Related knowledge may seem random - only show if relevance score is high
3. User may not notice the related knowledge section - use visual hierarchy

**States:**

| State | Display |
|-------|---------|
| Idle | Input field focused, recent questions visible |
| Composing | Character count (optional), send button enabled |
| Submitting | Input disabled, loading indicator |
| Streaming | Response appearing progressively |
| Complete | Full response, related questions, follow-up option |
| Error - API | "Couldn't reach AI service. Check your connection." + Retry |
| Error - No API Key | "Please configure your AI provider in Settings" + Go to Settings |
| Error - Quota | "API quota exceeded. Try again later or check your plan." |

---

### 2.4 Question Detail Screen

```
┌─────────────────────────────────┐
│  ←  Question          [🔗][⋮]  │
├─────────────────────────────────┤
│                                 │
│  Feb 8, 2025 · 14:32           │
│  Philosophy › Marxism           │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                 │
│  Q: What did Marx mean by       │
│     dialectical materialism?    │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                 │
│  [Full answer content with      │
│   markdown rendering]           │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                 │
│  Keywords:                      │
│  [Marx] [Dialectics] [Hegel]    │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                 │
│  🔗 Connected Knowledge (3)     │
│  ┌─────────────────────────────┐│
│  │ Hegelian dialectics      →  ││
│  ├─────────────────────────────┤│
│  │ Historical materialism   →  ││
│  ├─────────────────────────────┤│
│  │ Communist Manifesto      →  ││
│  └─────────────────────────────┘│
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                 │
│  Review Schedule:               │
│  Next review: Feb 10 (in 2d)    │
│  Times reviewed: 0              │
│  [Review Now]                   │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** View complete details of a past question and its connections

**System Responsibility:**
- Display full Q&A content with formatting
- Show metadata (date, categories, keywords)
- Show related past questions
- Show review schedule status

**Usability Risks:**
1. Information density may overwhelm - use collapsible sections

**States:**

| State | Display |
|-------|---------|
| Loading | Skeleton placeholders |
| Loaded | Full content |
| No Related | "No related questions yet." |
| Due for Review | Highlighted review badge |

---

### 2.5 Calendar Screen

```
┌─────────────────────────────────┐
│  February 2025        [+ Block] │
│  ◀  S  M  T  W  T  F  S  ▶     │
│     26 27 28 29 30 31  1        │
│      2  3  4  5  6  7 [8]       │
│      9 10 11 12 13 14 15        │
├─────────────────────────────────┤
│  Today, Feb 8                   │
│                                 │
│  ┌─────────────────────────────┐│
│  │ 08:00 - 12:00               ││
│  │ Morning Work                ││
│  │ ─────────────────────────── ││
│  │ ☑ Review chapter 3          ││
│  │ ☐ Write summary notes       ││
│  │ ⤳ Prepare presentation      ││
│  │                    [+ Add]  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ 12:00 - 13:00               ││
│  │ Lunch Break                 ││
│  │ ─────────────────────────── ││
│  │ ☐ Prepare presentation      ││
│  │   (postponed from above)    ││
│  │                    [+ Add]  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ 13:00 - 18:00               ││
│  │ Afternoon Study             ││
│  │ ─────────────────────────── ││
│  │ ☐ Practice problems set 5   ││
│  │                    [+ Add]  ││
│  └─────────────────────────────┘│
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  📚 Knowledge to Review (8)     │
│  ┌─────────────────────────────┐│
│  │ Start Review Session     →  ││
│  └─────────────────────────────┘│
│                                 │
├─────────────────────────────────┤
│  [🏠]    [💬]    [📅]    [⚙️]   │
└─────────────────────────────────┘
```

**User Goal:** Plan daily tasks in time blocks and see review obligations

**System Responsibility:**
- Display time blocks for selected date
- Show todos within each block with status
- Handle todo status changes (complete, postpone)
- Aggregate review items at bottom
- Create/edit time blocks

**Usability Risks:**
1. Postpone gesture may be unclear - use swipe or explicit button with confirmation
2. Adding blocks may conflict with existing times - validate overlaps
3. Many blocks could make scrolling tedious - consider collapse/expand

**Todo Item Interactions:**
| Gesture | Action |
|---------|--------|
| Tap checkbox | Toggle pending ↔ completed |
| Swipe right | Mark as postponed (moves to next block) |
| Long press | Edit or delete |
| Tap "+ Add" | Add new todo to that block |

**States:**

| State | Display |
|-------|---------|
| No Blocks Defined | "Set up your daily time blocks in Settings" + Quick setup option |
| Empty Block | Block visible, "No tasks. Tap + to add" |
| All Complete | Block shows completion celebration |
| Review Items (0) | Review section shows "All caught up! 🎉" |
| Past Date | Blocks are read-only, show summary |

---

### 2.6 Review Session Screen

```
┌─────────────────────────────────┐
│  ×  Review Session    3/8       │
├─────────────────────────────────┤
│                                 │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  │
│                                 │
│                                 │
│                                 │
│                                 │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │   What is the relationship  ││
│  │   between Hegel's dialectic ││
│  │   and Marx's materialism?   ││
│  │                             ││
│  │                             ││
│  │                             ││
│  │                             ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│                                 │
│  ┌─────────────────────────────┐│
│  │      Tap to Show Answer     ││
│  └─────────────────────────────┘│
│                                 │
│                                 │
│         [Skip →]                │
│                                 │
└─────────────────────────────────┘
```

**After Revealing Answer:**
```
┌─────────────────────────────────┐
│  ×  Review Session    3/8       │
├─────────────────────────────────┤
│                                 │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  │
│                                 │
│  Q: What is the relationship    │
│     between Hegel's dialectic   │
│     and Marx's materialism?     │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  A: Marx took Hegel's           │
│     dialectical method but      │
│     inverted it, replacing      │
│     idealism with materialism...│
│                                 │
│     [Scrollable content area]   │
│                                 │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  How well did you remember?     │
│                                 │
│  ┌─────┬─────┬─────┬─────┬─────┐│
│  │  1  │  2  │  3  │  4  │  5  ││
│  │ 😫  │ 😕  │ 😐  │ 🙂  │ 😄  ││
│  │Forgot│Hard │ OK  │Good │Easy ││
│  └─────┴─────┴─────┴─────┴─────┘│
│                                 │
└─────────────────────────────────┘
```

**Session Complete:**
```
┌─────────────────────────────────┐
│         Review Complete         │
├─────────────────────────────────┤
│                                 │
│              🎉                 │
│                                 │
│      Great job today!           │
│                                 │
│      8 cards reviewed           │
│      2 skipped                  │
│                                 │
│      Average score: 3.8         │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  Next review scheduled:         │
│  • 3 cards tomorrow             │
│  • 5 cards in 3 days            │
│                                 │
│                                 │
│  ┌─────────────────────────────┐│
│  │        Done                 ││
│  └─────────────────────────────┘│
│                                 │
│       Review skipped items →    │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Review due knowledge using spaced repetition

**System Responsibility:**
- Present questions in flashcard format
- Hide answer until user requests
- Collect rating and update review schedule (SM-2)
- Track session progress
- Handle skip and allow return to skipped items
- Update easeFactor based on ratings

**Usability Risks:**
1. Rating scale meaning unclear - use emojis + text labels
2. User may accidentally rate before ready - require reveal before rating
3. Session feels long - show progress bar prominently
4. User may want to quit mid-session - X button with confirmation

**States:**

| State | Display |
|-------|---------|
| Question Hidden | Question visible, answer hidden, "Tap to reveal" |
| Answer Revealed | Both visible, rating buttons active |
| Rating Selected | Brief feedback animation, auto-advance to next |
| Session Complete | Summary statistics, next review preview |
| No Items Due | "Nothing to review! Check back tomorrow" |
| Session Interrupted | Confirmation dialog, option to save progress |

---

### 2.7 Podcast Player Screen

```
┌─────────────────────────────────┐
│  ×                              │
├─────────────────────────────────┤
│                                 │
│         ┌───────────┐           │
│         │           │           │
│         │   🎧      │           │
│         │           │           │
│         └───────────┘           │
│                                 │
│   Today's Learning Recap        │
│   February 8, 2025              │
│                                 │
│   3 topics · 12:34              │
│                                 │
│  ───○────────────────────────   │
│  2:15              12:34        │
│                                 │
│       ┌───┐  ┌───┐  ┌───┐       │
│       │◀◀ │  │ ▶ │  │ ▶▶│       │
│       │15s│  │   │  │15s│       │
│       └───┘  └───┘  └───┘       │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  Topics covered:                │
│  • Dialectical materialism      │
│  • Hegelian philosophy          │
│  • Economic determinism         │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  [📜 View Script]  [💤 Sleep Timer]│
│                                 │
│  ─────────────────────────────  │
│                                 │
│  [📋 All Podcasts]              │
│                                 │
└─────────────────────────────────┘
```

**Script View (Sheet):**
```
┌─────────────────────────────────┐
│  Script              [×]        │
├─────────────────────────────────┤
│                                 │
│  ▶ Playing: 2:15                │
│                                 │
│  Welcome back! Today you        │
│  explored some fascinating      │
│  philosophical concepts...      │
│                                 │
│  [Currently playing section     │
│   is highlighted]               │
│                                 │
│  You asked about dialectical    │
│  materialism, which is Marx's   │
│  philosophical framework...     │
│                                 │
│  [Tap any paragraph to jump     │
│   to that position in audio]    │
│                                 │
└─────────────────────────────────┘
```

**Podcast List (Sheet):**
```
┌─────────────────────────────────┐
│  All Podcasts          [×]      │
├─────────────────────────────────┤
│                                 │
│  February 2025                  │
│  ┌─────────────────────────────┐│
│  │ Feb 8  · 12:34       ▶ Now ││
│  │ 3 topics                    ││
│  ├─────────────────────────────┤│
│  │ Feb 7  · 08:21         ▶   ││
│  │ 2 topics                    ││
│  ├─────────────────────────────┤│
│  │ Feb 6  · 15:02         ▶   ││
│  │ 5 topics                    ││
│  ├─────────────────────────────┤│
│  │ Feb 5  · Generating... ◐   ││
│  │                             ││
│  ├─────────────────────────────┤│
│  │ Feb 4  · Failed       ↻    ││
│  │ [Retry]                     ││
│  └─────────────────────────────┘│
│                                 │
│  January 2025                   │
│  ...                            │
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Listen to daily learning summary in podcast format, with playback controls

**System Responsibility:**
- Play audio from local storage
- Provide standard playback controls (play/pause, seek, skip)
- Display current position and duration
- Support sleep timer for bedtime listening
- Allow script viewing with audio sync
- List all available podcasts by date
- Handle generating/failed states

**Usability Risks:**
1. Audio won't play if TTS not configured - show clear message with setup link
2. Sleep timer may stop mid-sentence - consider ending at paragraph break
3. Background playback may be unexpected - show notification with controls
4. Script sync may lag - highlight paragraphs not individual words

**States:**

| State | Display |
|-------|---------|
| Loading | Spinner, controls disabled |
| Playing | Pause button shown, progress updating |
| Paused | Play button shown, progress frozen |
| Buffering | Spinner on play button |
| Complete | "Finished" state, replay option |
| Error | "Playback error" + retry button |
| TTS Not Configured | "Configure voice in Settings to enable podcasts" |
| No Podcast Today | "No learning recorded today. Ask some questions!" |
| Generating | Progress indicator, estimated time if available |
| Failed | Error message, "Retry" button |

---

### 2.8 Settings Screen

```
┌─────────────────────────────────┐
│  ←  Settings                    │
├─────────────────────────────────┤
│                                 │
│  AI CONFIGURATION               │
│  ┌─────────────────────────────┐│
│  │ LLM Provider            →  ││
│  │ OpenAI (GPT-4)              ││
│  ├─────────────────────────────┤│
│  │ TTS Provider            →  ││
│  │ OpenAI TTS                  ││
│  ├─────────────────────────────┤│
│  │ ZeroTier Network        →  ││
│  │ Not connected               ││
│  └─────────────────────────────┘│
│                                 │
│  SCHEDULE                       │
│  ┌─────────────────────────────┐│
│  │ Sleep Time              →  ││
│  │ 22:30                       ││
│  ├─────────────────────────────┤│
│  │ Podcast Prep Time       →  ││
│  │ 1 hour before               ││
│  └─────────────────────────────┘│
│                                 │
│  REVIEW                         │
│  ┌─────────────────────────────┐│
│  │ Daily Review Limit      →  ││
│  │ 50 cards                    ││
│  ├─────────────────────────────┤│
│  │ Review Notifications   [●] ││
│  └─────────────────────────────┘│
│                                 │
│  CALENDAR                       │
│  ┌─────────────────────────────┐│
│  │ Time Blocks Template    →  ││
│  │ Edit default daily blocks   ││
│  └─────────────────────────────┘│
│                                 │
│  DATA                           │
│  ┌─────────────────────────────┐│
│  │ Export Data             →  ││
│  │ Import Data             →  ││
│  ├─────────────────────────────┤│
│  │ Clear All Data          →  ││
│  └─────────────────────────────┘│
│                                 │
│  ABOUT                          │
│  ┌─────────────────────────────┐│
│  │ Version 1.0.0               ││
│  │ View Licenses           →  ││
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

**LLM Provider Detail:**
```
┌─────────────────────────────────┐
│  ←  LLM Provider                │
├─────────────────────────────────┤
│                                 │
│  Provider                       │
│  ┌─────────────────────────────┐│
│  │ ● OpenAI                    ││
│  │ ○ Claude (Anthropic)        ││
│  │ ○ Local LLM                 ││
│  └─────────────────────────────┘│
│                                 │
│  API Key                        │
│  ┌─────────────────────────────┐│
│  │ sk-••••••••••••••••••••    ││
│  └─────────────────────────────┘│
│  [Show] [Clear]                 │
│                                 │
│  API Base URL (optional)        │
│  ┌─────────────────────────────┐│
│  │ https://api.openai.com/v1  ││
│  └─────────────────────────────┘│
│                                 │
│  Model                          │
│  ┌─────────────────────────────┐│
│  │ gpt-4-turbo           ▼    ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │      Test Connection        ││
│  └─────────────────────────────┘│
│                                 │
│  ✓ Connection successful        │
│  Response time: 1.2s            │
│                                 │
│  ┌─────────────────────────────┐│
│  │          Save               ││
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

**User Goal:** Configure app settings, API connections, and preferences

**System Responsibility:**
- Persist settings securely (encrypt API keys)
- Validate settings before saving
- Test connections on demand
- Provide data export/import for backup
- Warn before destructive actions

**Usability Risks:**
1. API key entry is error-prone - provide paste button, validate format
2. ZeroTier setup is complex - provide step-by-step guide or link to docs
3. "Clear All Data" is destructive - require confirmation + typing "DELETE"
4. Settings don't apply until saved - show unsaved changes indicator

---

## 3. Navigation Structure

### 3.1 Primary Navigation (Tab Bar)

```
┌─────────────────────────────────────────┐
│  [🏠 Home]  [💬 Ask]  [📅 Calendar]  [⚙️ More] │
└─────────────────────────────────────────┘
```

| Tab | Screen | Badge |
|-----|--------|-------|
| Home | Home Dashboard | Review count (if due) |
| Ask | Ask Screen | - |
| Calendar | Calendar Screen | Task count (optional) |
| More | Settings + secondary navigation | Setup incomplete indicator |

### 3.2 Navigation Flow Diagram

```
                                    ┌──────────────┐
                                    │   App Open   │
                                    └──────┬───────┘
                                           │
                              ┌────────────┴────────────┐
                              │  First Launch?          │
                              └────────────┬────────────┘
                                    Yes    │    No
                              ┌────────────┴────────────┐
                              ▼                         ▼
                    ┌──────────────────┐      ┌──────────────────┐
                    │   Onboarding     │      │   Home Dashboard │
                    │   Flow           │──────│                  │
                    └──────────────────┘      └────────┬─────────┘
                                                       │
         ┌───────────────────────┬────────────────────┼────────────────────┬───────────────────────┐
         │                       │                    │                    │                       │
         ▼                       ▼                    ▼                    ▼                       ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│  Ask Screen    │    │ Calendar       │    │ Review         │    │ Podcast        │    │ Settings       │
│                │    │ Screen         │    │ Session        │    │ Player         │    │                │
└───────┬────────┘    └───────┬────────┘    └────────────────┘    └────────────────┘    └───────┬────────┘
        │                     │                                                                  │
        ▼                     │                                                                  ▼
┌────────────────┐            │                                                         ┌────────────────┐
│  Question      │◄───────────┘                                                         │ API Config     │
│  Detail        │                                                                      │ Screens        │
└────────────────┘                                                                      └────────────────┘
```

### 3.3 Deep Linking Support

| Route | Screen | Parameters |
|-------|--------|------------|
| `/` | Home Dashboard | - |
| `/ask` | Ask Screen | `?q=prefilled+question` |
| `/question/:id` | Question Detail | question ID |
| `/calendar` | Calendar | `?date=2025-02-08` |
| `/calendar/:blockId` | Calendar focused on block | block ID |
| `/review` | Review Session | - |
| `/podcast` | Podcast Player | `?date=2025-02-08` |
| `/podcast/list` | Podcast List | - |
| `/settings` | Settings | - |
| `/settings/llm` | LLM Config | - |
| `/settings/tts` | TTS Config | - |

---

## 4. Complete State Inventory

### 4.1 Global States

| State | Trigger | System Behavior | UI Indicator |
|-------|---------|-----------------|--------------|
| App Loading | Cold start | Load settings, check API status | Splash screen |
| Offline | No network detected | Queue requests, show cached data | Banner: "Offline mode" |
| API Not Configured | No LLM API key | Block Q&A features | Banner + redirect to Settings |
| API Error | LLM/TTS request fails | Show error, offer retry | Toast/modal with details |
| Background Sync | App returns to foreground | Refresh review counts, podcast status | Silent or subtle indicator |
| Podcast Generating | Scheduled generation starts | Background process, notify on complete | Home card shows progress |

### 4.2 Screen-by-Screen States Matrix

| Screen | Loading | Empty | Error | Success | Partial |
|--------|---------|-------|-------|---------|---------|
| Home Dashboard | Skeleton cards | Welcome message | Per-card error | Full data | Some cards failed |
| Ask Screen | Thinking animation | Recent questions | API error message | Answer displayed | - |
| Question Detail | Skeleton | - | Load failed | Full content | - |
| Calendar | Skeleton | No blocks message | Load failed | Blocks + todos | - |
| Review Session | Loading cards | "All caught up" | Card load failed | Cards ready | - |
| Podcast Player | Audio buffering | No podcast | Playback error | Playing | Partially loaded |
| Settings | - | - | Save failed | Saved confirmation | Validation errors |

---

## 5. Edge Cases & Failure Modes

### 5.1 First-Time User Experience

| Scenario | Risk | Mitigation |
|----------|------|------------|
| User skips all setup | App is non-functional | Show persistent banner, block Q&A with clear message |
| User enters invalid API key | Frustration, abandonment | Immediate validation, helpful error messages |
| User doesn't grant notification permission | Misses reviews/podcasts | Explain value, allow re-request later |
| User sets unrealistic sleep time | Podcast generates at wrong time | Validate reasonable range (18:00-03:00) |

### 5.2 Data Edge Cases

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Zero questions asked | No data, empty podcast | Encourage with prompts, disable podcast for that day |
| 1000+ questions | Performance degradation | Pagination, lazy loading |
| Very long answer from LLM | UI overflow | Scrollable container, "Show more" collapse |
| LLM returns malformed response | Parse failure | Fallback display, error logging |
| Duplicate question asked | Redundant data | Detect similarity, suggest existing answer |

### 5.3 Network & API Edge Cases

| Scenario | Risk | Mitigation |
|----------|------|------------|
| API request times out | Stuck loading state | 30s timeout, retry button, cancel option |
| API rate limited | Features blocked | Show cooldown, suggest local LLM |
| ZeroTier connection drops | Local LLM/TTS unreachable | Auto-reconnect, fallback to cloud if configured |
| TTS fails mid-podcast | Incomplete audio | Retry segment, show text fallback |
| Partial response (streaming) | Incomplete answer | Detect interruption, offer retry |

### 5.4 User Behavior Edge Cases

| Scenario | Risk | Mitigation |
|----------|------|------------|
| User closes app during review | Lost progress | Auto-save after each rating |
| User postpones task to non-existent next block | Task disappears | Create overflow block or move to next day |
| User reviews same card multiple times quickly | Inflated stats | Debounce, one rating per session |
| User deletes all data then regrets | Data loss | 30-day soft delete, export before clear |
| User changes sleep time after podcast started generating | Wasted generation | Complete current, schedule next for new time |

### 5.5 Platform-Specific Edge Cases

| Scenario | Platform | Mitigation |
|----------|----------|------------|
| Background audio interrupted by call | iOS/Android | Resume on call end, show notification |
| App killed by OS during podcast generation | Both | Resume generation on next launch |
| Notification permissions revoked | Both | Check on app launch, re-request gracefully |
| Device storage full | Both | Warn user, offer to delete old podcasts |
| Screen reader active | Accessibility | Full VoiceOver/TalkBack support for all elements |

---

## 6. Confirmation & Destructive Action Dialogs

### 6.1 Required Confirmations

| Action | Dialog Type | Content |
|--------|-------------|---------|
| Delete question | Confirm | "Delete this question?" |
| Clear all data | Destructive confirm | "Type DELETE to confirm. This cannot be undone." |
| Cancel review session | Confirm | "Exit review? Your progress (3/8) will be saved." |
| Skip onboarding | Warn | "Some features won't work without AI configuration. You can set this up later in Settings." |
| Disconnect ZeroTier | Confirm | "Disconnect from local network? Local LLM/TTS will be unavailable." |
| Postpone all block tasks | Confirm | "Move all 5 tasks to the next block?" |

### 6.2 Dialog Design Pattern

```
┌─────────────────────────────────┐
│                                 │
│   [Icon]                        │
│                                 │
│   Title                         │
│   Description text explaining   │
│   the consequences.             │
│                                 │
│   ┌───────────┐ ┌─────────────┐ │
│   │  Cancel   │ │   Confirm   │ │
│   └───────────┘ └─────────────┘ │
│                                 │
└─────────────────────────────────┘
```

For destructive actions, use red/warning color on confirm button.

---

## 7. Error Message Guidelines

### 7.1 Error Message Structure

```
[Icon] Error Title

What happened:
Brief explanation of the error.

What you can do:
• First option
• Second option

[Primary Action] [Secondary Action]
```

### 7.2 Common Error Messages

| Error | Title | Message | Actions |
|-------|-------|---------|---------|
| LLM API unreachable | "Can't reach AI service" | "Check your internet connection or API configuration." | [Retry] [Settings] |
| Invalid API key | "Invalid API key" | "The API key was rejected. Please check it in Settings." | [Go to Settings] |
| TTS generation failed | "Podcast generation failed" | "There was an error creating today's audio. You can try again or read the script." | [Retry] [View Script] |
| No questions today for podcast | "Nothing to summarize" | "Ask some questions today to generate your evening podcast!" | [Ask Now] |
| Review load failed | "Couldn't load reviews" | "There was an error loading your review cards." | [Retry] |

---

## 8. Accessibility Requirements

### 8.1 Minimum Requirements

| Requirement | Implementation |
|-------------|----------------|
| Touch target size | Minimum 44x44pt for all interactive elements |
| Color contrast | WCAG AA minimum (4.5:1 for text) |
| Screen reader | All elements labeled with accessibility labels |
| Motion | Respect "reduce motion" system setting |
| Font scaling | Support dynamic type up to 200% |
| Focus order | Logical tab order for keyboard/switch control |

### 8.2 Screen-Specific Accessibility

| Screen | Considerations |
|--------|----------------|
| Review Cards | Announce "Tap to reveal answer" state |
| Podcast Player | Audio controls accessible, sleep timer announced |
| Calendar | Time blocks navigable as list |

---

## 9. Implementation Priority

### Phase 1 (MVP)
1. Onboarding - LLM Setup (skip TTS/ZeroTier)
2. Home Dashboard (simplified)
3. Ask Screen + Question Display
4. Settings - LLM Configuration

### Phase 2 (Core Features)
5. Calendar Screen + Todo Management
6. Review Session
7. Question Detail
8. History Browser

### Phase 3 (Knowledge Features)
9. Related Questions in Ask

### Phase 4 (Audio Features)
10. TTS Configuration
11. Podcast Generation
12. Podcast Player

### Phase 5 (Advanced)
13. ZeroTier Integration
14. Local LLM/TTS Support
15. Data Export/Import

---

## Appendix A: Screen Thumbnail Reference

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ On- │ │Home │ │ Ask │ │ Cal │ │ Set │
│board│ │Dash │ │     │ │     │ │     │
│     │ │     │ │     │ │     │ │     │
│ [1] │ │ [5] │ │ [6] │ │ [7] │ │ [9] │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘

┌─────┐ ┌─────┐ ┌─────┐
│ Q   │ │ Rev │ │ Pod │
│ Det │ │ Ses │ │ Ply │
│     │ │     │ │     │
│ [8] │ │ [10]│ │ [11]│
└─────┘ └─────┘ └─────┘
```

---

## Appendix B: Design Tokens Reference

These should be defined in the design system:

| Token | Purpose |
|-------|---------|
| `color.primary` | Primary actions, links |
| `color.success` | Completed states, success messages |
| `color.warning` | Warnings, pending states |
| `color.error` | Errors, destructive actions |
| `color.background.primary` | Main background |
| `color.background.card` | Card surfaces |
| `spacing.xs` through `spacing.xl` | Consistent spacing scale |
| `radius.card` | Card corner radius |
| `shadow.card` | Card elevation |
| `typography.heading` | Heading styles |
| `typography.body` | Body text styles |
| `animation.duration.fast` | Quick transitions |
| `animation.duration.slow` | Deliberate animations |
