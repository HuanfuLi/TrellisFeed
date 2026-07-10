# Phase 6: Question Quality Evaluation - Research

**Researched:** 2025-03-26
**Domain:** Pattern-based and LLM-driven off-topic question detection with user override UX
**Confidence:** HIGH (locked decisions from CONTEXT.md guide research scope)

## Summary

Phase 6 implements intelligent filtering to prevent meta-questions, greetings, and off-topic chat from polluting the knowledge graph. The architecture uses a **hybrid pattern + LLM fallback** approach: simple regex/keyword patterns catch obvious cases (fast, no API calls), while ambiguous edge cases are evaluated by the LLM (leveraging existing API call infrastructure).

The user experience is **silent by default**: a small badge/icon appears below AI messages when a question is flagged, but no explanation is shown unless the user clicks to override. Valid questions auto-save with no friction.

**Primary recommendation:** Implement a dedicated `question-filter.service.ts` that runs synchronously after LLM response parsing but *before* question persistence. Use pattern matching first (array of regex/keyword rules), then conditionally call LLM for edge cases. Add a `flagged: boolean` field to the `Question` type, and modify persistence logic to skip ingestion for flagged questions unless explicitly overridden by user.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Detection mechanism:** Hybrid pattern + LLM (patterns first, LLM fallback for ambiguous cases)
- **Storage:** Auto-save valid questions (no confirmation friction); only show friction when flagged
- **UX:** Small badge/icon below AI message; no explanation text visible by default
- **Transparency:** Silent by default (badge only); details shown on click

### the agent's Discretion
- Specific patterns to detect first (e.g., greetings, jokes, meta-questions)
- LLM evaluation prompt design and caching strategy
- Badge implementation details (icon, positioning, animation)
- Testing strategy and edge case coverage

### Deferred Ideas (OUT OF SCOPE)
- Adaptive filtering based on user behavior (Phase 7+)
- Configuration UI for filtering rules (Phase 7+)
- Analytics on flagged vs saved rates (Phase 8+)

---

## Standard Stack

### Core Pattern Detection
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| native JavaScript | — | Regex + string matching for patterns | Zero dependencies, fast (synchronous), handles 90% of cases (greetings, obvious jokes, meta-questions) |
| Framer Motion | ^12.38.0 | Badge animation on appearance | Already in stack; Material You design expects smooth micro-interactions |
| lucide-react | ^1.6.0 | Badge/warning icon | Already in stack; consistent with existing UI |

### LLM Evaluation (Fallback)
| Component | Current Implementation | Purpose |
|-----------|----------------------|---------|
| chatCompletion() | `src/providers/llm/index.ts` | Existing LLM provider (OpenAI/Claude/Gemini/local) |
| mockSettingsService | `src/services/mock/settings.mock.ts` | Access to LLM config (already used by question.service) |

**Key insight:** LLM evaluation is NOT a separate API call — it's evaluated in the *existing* LLM response parsing (asking the LLM to classify itself). This reuses tokens already spent on generating the answer.

### Supporting Libraries (Existing)
| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.2.0 | Component rendering (ChatMessage extension) |
| TypeScript | ~5.9.3 | Type safety for `flagged` field and filter service |
| Tailwind CSS | ^4.2.1 | Badge styling (inline with Material You tokens) |

### Installation
```bash
# No new dependencies needed — all used libraries already in package.json
npm list framer-motion lucide-react react
```

**Note:** If pattern detection grows to >50 rules, consider migrating to a lightweight library like **"xregexp"** (for named capture groups) or **"minimatch"** (for glob-style patterns). For now, native regex suffices.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── question-filter.service.ts       # NEW: pattern + LLM evaluation
│   ├── question.service.ts              # MODIFIED: call filter before persist
│   ├── canonical-knowledge.service.ts   # MODIFIED: skip ingestion if flagged=true
│   └── db.service.ts                    # MODIFIED: add flagged to schema
├── components/
│   ├── ChatMessage.tsx                  # MODIFIED: render badge + override UI
│   └── OffTopicBadge.tsx                # NEW: badge component with popover
├── types/
│   └── index.ts                         # MODIFIED: add flagged to Question interface
└── lib/
    └── filter-patterns.ts               # NEW: pattern rules registry
```

### Pattern 1: Hybrid Filter Flow
**What:** Synchronous pattern matching → async LLM fallback (on demand)
**When to use:** Always — this is the core of Phase 6
**Example:**
```typescript
// Source: phase requirements
export async function evaluateQuestion(content: string): Promise<FilterResult> {
  // Step 1: Fast pattern matching (no API call)
  const patternResult = matchPatterns(content);
  if (patternResult.matched) {
    return { flagged: true, reason: patternResult.reason, source: 'pattern' };
  }

  // Step 2: LLM evaluation for ambiguous cases (reuses existing LLM call)
  const llmResult = await evaluateWithLLM(content);
  return { flagged: llmResult.isMeta, reason: llmResult.explanation, source: 'llm' };
}
```

**Integration point:** In `question.service.ts`:
- After `chatCompletion()` returns (we have the answer)
- Before `buildAndSave()` is called
- The filter result attaches to the Question as `flagged: boolean`

### Pattern 2: Pattern Rules Registry
**What:** Centralized array of detection rules (regex + keywords)
**When to use:** For maintainability — all pattern rules in one place
**Example:**
```typescript
// Source: common NLP patterns for off-topic detection
export const FILTER_RULES = [
  {
    name: 'greeting',
    patterns: [/^(hi|hello|hey|greetings|hiya|howdy)/i],
    keywords: [],
    reason: 'Greeting or social opener',
  },
  {
    name: 'meta-question',
    patterns: [/^(what did i ask|remind me|what was|tell me what i said)/i],
    keywords: [],
    reason: 'Meta-question about conversation history',
  },
  {
    name: 'joke-request',
    patterns: [/^(tell me a joke|make me laugh|say something funny)/i],
    keywords: ['joke', 'funny', 'laugh'],
    reason: 'Entertainment request, not educational',
  },
  // ... more rules
];

function matchPatterns(content: string): { matched: boolean; reason?: string } {
  const normalized = content.toLowerCase().trim();
  for (const rule of FILTER_RULES) {
    if (rule.patterns.some(p => p.test(normalized))) return { matched: true, reason: rule.reason };
  }
  return { matched: false };
}
```

### Pattern 3: LLM Evaluation (Async Fallback)
**What:** Single LLM prompt to classify ambiguous questions
**When to use:** When pattern matching returns no result (edge cases)
**Key decision:** Embed evaluation in the *existing* LLM response?
- **Option A (RECOMMENDED):** Add classification prompt to system prompt, ask LLM to include `"isOfftopic": true/false` in JSON response
  - ✓ No extra API call (reuses tokens)
  - ✓ Same response parsed alongside answer
  - ✓ Simple to cache (same question → same evaluation)
  - ✗ Slightly longer response (minimal overhead)
- **Option B (Alternative):** Separate follow-up call for edge cases only
  - ✓ Cleaner separation of concerns
  - ✓ Can skip if confidence is high
  - ✗ Extra API call cost + latency
  
**Recommendation:** Use Option A (embed in system prompt) — we're already asking for JSON with structured fields (answer, summary, keywords, knowledgeDecision). Add one more field: `"isOfftopic": boolean`.

**LLM Prompt Addition:**
```
Include in your response JSON:
{
  "answer": "...",
  "summary": "...",
  "keywords": [...],
  "knowledgeDecision": {...},
  "isOfftopic": false,  // NEW: true if meta-question, greeting, joke, or not educational
  "offTopicReason": "..." // NEW: explanation if true
}
```

### Pattern 4: Badge & Override UI (Mobile-First)
**What:** Small icon below AI message; click reveals popover with override options
**When to use:** When `flagged = true` and question not yet confirmed saved
**UX Flow (mobile-native):**
```
1. AI response displayed
2. Small warning badge appears with Framer Motion (0.3s fade-in)
3. User can:
   a. Ignore badge (question stays in session history only)
   b. Tap badge → inline popover appears
   c. Popover shows: "This looks off-topic" + "Yes, save anyway?" | "Discard"
   d. Tap "Save anyway" → flagged set to false, question ingested to knowledge graph
   e. Tap "Discard" → question stays in session history (no persistence)
```

**Why this pattern (vs. full modal):**
- ✓ Minimal UI overhead (badge is <30px button)
- ✓ Non-disruptive (user can ignore)
- ✓ Native mobile feel (inline popover, not modal)
- ✓ Consistent with Phase 5 ("minimal UI preferred")
- ✓ Matches Slack's "threaded replies suggested" indicator

**Icon & Animation:**
```typescript
// Badge component
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function OffTopicBadge({ onTap }: { onTap: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        marginTop: '4px',
        fontSize: '0.75rem',
        color: 'var(--warning-color)',
        backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <AlertCircle size={14} />
      Off-topic
    </motion.button>
  );
}
```

### Anti-Patterns to Avoid
- **Adding LLM call to every question:** Increases latency, costs, and API quota. Use patterns first.
- **Showing explanation text by default:** "This question won't be saved" clutters the UI. Badge only; details on click.
- **Modal dialog for override:** Too heavy for a learning app. Use inline popover.
- **Strict off-topic rules:** Filtering should be conservative — better to save an off-topic question than block a valid educational one. Flag edge cases, let user decide.
- **Storing `flagged` as immutable:** Once a user overrides, set `flagged = false` and persist. The override is a user decision.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text similarity for edge cases | Custom embedding comparison | LLM classification in existing call | LLM already trained on off-topic vs. on-topic; hand-rolled logic has false positives |
| Badge animation | CSS transitions | Framer Motion (in stack) | Framer Motion handles spring physics, mobile performance, and Material You spring tokens |
| Pattern registry | Scattered regex throughout code | Centralized FILTER_RULES array | Single source of truth; easier to test, document, and tune |
| Override state management | useState in ChatMessage | Add `flagged` to Question type, managed by question.service | Question is source of truth; state consistency across sessions/reloads |
| Popover menu for override | Custom absolute positioning | Floating UI / Headless UI popover library | Hand-rolled positioning has z-index bugs, mobile scroll issues, accessibility gaps |

**Key insight:** The tempting hand-roll is a "smarter" local embedding model for off-topic detection. Resist it — we already have LLM API calls, and LLM classification is more accurate than hand-rolled heuristics.

---

## Runtime State Inventory

**Trigger:** This is a feature addition (not a rename/refactor/migration), so no existing runtime state to migrate. However, as we add the `flagged` field to Question, we need to handle backwards compatibility:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing questions in localStorage (no `flagged` field yet) | Add migration: set `flagged = false` for all existing questions on first load (they are pre-approved by being persisted) |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | None | — |

**Migration approach:**
```typescript
// In question.service.ts, after loadStore():
function hydrateExistingQuestions(questions: Question[]): Question[] {
  return questions.map(q => ({
    ...q,
    flagged: q.flagged ?? false,  // Set to false if missing (backward compat)
  }));
}
```

---

## Common Pitfalls

### Pitfall 1: LLM Evaluation Lag
**What goes wrong:** Calling a separate LLM endpoint for edge cases adds 200-500ms latency per question, making the app feel slow.
**Why it happens:** Misunderstanding the cost-benefit of an extra API round-trip.
**How to avoid:** Embed off-topic classification in the *existing* LLM response (add a field to the JSON). No extra API call = no latency penalty.
**Warning signs:** If you see `await evaluateWithLLM(question)` as a separate function call, refactor to include it in the main `chatCompletion()` prompt.

### Pitfall 2: Over-Aggressive Filtering
**What goes wrong:** Rules filter out legitimate educational questions (e.g., "Why is Python better than Java?" might match a pattern for comparison jokes).
**Why it happens:** Writing rules without testing against real questions; being too strict to "reduce knowledge graph noise."
**How to avoid:** Start with only the most obvious patterns (greetings, explicit jokes, meta-questions). Test against 50+ real questions first. Default to "if uncertain, let user decide" (show badge, allow override).
**Warning signs:** When >10% of questions are flagged, review the rule set — likely over-aggressive.

### Pitfall 3: Losing Override Intent Across Sessions
**What goes wrong:** User overrides a flagged question, but the override is lost on app reload (because `flagged` wasn't persisted correctly).
**Why it happens:** Forgetting to persist the updated Question object after override, or setting `flagged = false` in memory only.
**How to avoid:** When user clicks "Save anyway", immediately call `questionService.patchQuestion(id, { flagged: false })` and persist. The Question object in storage is the source of truth.
**Warning signs:** If reopening the app and loading the chat history shows the same question re-flagged, the persistence failed.

### Pitfall 4: Badge Accessibility
**What goes wrong:** Badge is a button but lacks proper ARIA labels, semantic structure, or keyboard navigation on desktop.
**Why it happens:** Mobile-first design sometimes forgets desktop/keyboard users.
**How to avoid:** Badge button should be semantically <button>, have aria-label="Question flagged as off-topic", and respond to keyboard/Tab navigation.
**Warning signs:** If a screen reader doesn't announce the badge, or Tab key skips over it, accessibility is broken.

### Pitfall 5: Unbounded Pattern Rule Growth
**What goes wrong:** Over time, 5 rules become 50 rules, and maintenance becomes hard. False positives increase as rules conflict.
**Why it happens:** Each user report of a missed case leads to a new rule, without removing old ones or testing interactions.
**How to avoid:** Keep rule count to <20. Before adding a new rule, test it against existing questions and check for false positives. Periodically review rules (every phase) to retire ones that rarely match.
**Warning signs:** If FILTER_RULES has >50 entries, or if two rules contradict each other, consolidate.

---

## Code Examples

### Example 1: Pattern Detection Service
```typescript
// Source: Phase 6 architecture pattern
// File: src/services/question-filter.service.ts

import { FILTER_RULES } from '../lib/filter-patterns.ts';

export interface FilterResult {
  flagged: boolean;
  reason?: string;
  source: 'pattern' | 'llm' | 'none';
}

function matchPatterns(content: string): { matched: boolean; reason?: string } {
  const normalized = content.toLowerCase().trim();
  
  for (const rule of FILTER_RULES) {
    // Check regex patterns
    if (rule.patterns.some(p => p.test(normalized))) {
      return { matched: true, reason: rule.reason };
    }
    
    // Check keyword presence
    if (rule.keywords.length > 0) {
      const hasKeywords = rule.keywords.some(kw => normalized.includes(kw));
      if (hasKeywords) {
        return { matched: true, reason: rule.reason };
      }
    }
  }
  
  return { matched: false };
}

function extractIsOfftopicFromLLMResponse(jsonResponse: {
  answer?: string;
  summary?: string;
  keywords?: string[];
  isOfftopic?: boolean;
  offTopicReason?: string;
  knowledgeDecision?: object;
}): FilterResult {
  const isOfftopic = jsonResponse.isOfftopic ?? false;
  const reason = jsonResponse.offTopicReason || 'LLM classified as off-topic';
  
  return {
    flagged: isOfftopic,
    reason: isOfftopic ? reason : undefined,
    source: 'llm',
  };
}

export async function evaluateQuestion(
  content: string,
  llmResponse: object, // The parsed JSON from LLM
): Promise<FilterResult> {
  // Step 1: Fast pattern matching
  const patternResult = matchPatterns(content);
  if (patternResult.matched) {
    return {
      flagged: true,
      reason: patternResult.reason,
      source: 'pattern',
    };
  }
  
  // Step 2: LLM evaluation (embedded in existing response)
  const llmResult = extractIsOfftopicFromLLMResponse(llmResponse);
  if (llmResult.flagged) {
    return llmResult;
  }
  
  // All checks passed
  return { flagged: false, source: 'none' };
}
```

### Example 2: Pattern Rules Registry
```typescript
// Source: Phase 6 architecture pattern
// File: src/lib/filter-patterns.ts

export interface FilterRule {
  name: string;
  patterns: RegExp[];
  keywords: string[];
  reason: string;
}

export const FILTER_RULES: FilterRule[] = [
  {
    name: 'greeting',
    patterns: [/^(hi|hello|hey|greetings|hiya|howdy)\b/i],
    keywords: [],
    reason: 'Social greeting, not an educational question',
  },
  {
    name: 'meta-question',
    patterns: [
      /^(what did i|remind me|what was|tell me what i said|repeat my question|what was my last question)/i,
      /^(did you answer|did i ask|have we discussed)/i,
    ],
    keywords: [],
    reason: 'Question about conversation history, not educational content',
  },
  {
    name: 'joke-request',
    patterns: [/^(tell me a joke|make me laugh|say something funny|joke please)/i],
    keywords: ['joke', 'funny', 'hilarious', 'laughing'],
    reason: 'Entertainment request, not educational',
  },
  {
    name: 'small-talk',
    patterns: [/^(how are you|what's up|what's new|how's it going|nice day)/i],
    keywords: ['weather', 'busy', 'tired'],
    reason: 'Social small talk, not educational',
  },
  {
    name: 'off-topic-chat',
    patterns: [],
    keywords: ['random', 'just wondering', 'tangent', 'off-topic'],
    reason: 'User-flagged off-topic chat',
  },
];

// Reserved for Phase 7+ (user could configure these)
export const ADVANCED_RULES: FilterRule[] = [];
```

### Example 3: Integration in question.service.ts
```typescript
// Source: Phase 6 integration point
// File: src/services/question.service.ts (modified excerpt)

import { evaluateQuestion } from './question-filter.service.ts';

export const questionService = {
  async ask(content: string): Promise<ServiceResult<AskResult>> {
    // ... existing code (LLM call, parsing) ...
    
    const raw = await chatCompletion([...], llmConfig);
    
    let answer: string;
    let summary: string;
    let keywords: string[];
    let storyHook: string | undefined;
    let knowledgeDecision: object | undefined;
    let isOfftopic: boolean = false;
    let offTopicReason: string | undefined;
    
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
        answer?: string;
        summary?: string;
        keywords?: string[];
        storyHook?: string;
        knowledgeDecision?: object;
        isOfftopic?: boolean;          // NEW field
        offTopicReason?: string;       // NEW field
      };
      
      answer = parsed.answer ?? raw;
      summary = parsed.summary ?? extractSummary(answer);
      keywords = Array.isArray(parsed.keywords) ? parsed.keywords : extractKeywords(answer);
      storyHook = typeof parsed.storyHook === 'string' && parsed.storyHook ? parsed.storyHook : undefined;
      knowledgeDecision = parsed.knowledgeDecision;
      isOfftopic = parsed.isOfftopic ?? false;       // NEW: capture from LLM
      offTopicReason = parsed.offTopicReason;        // NEW: capture reason
    } catch {
      answer = raw;
      summary = extractSummary(raw);
      keywords = extractKeywords(raw);
    }
    
    // NEW: Pattern + LLM evaluation
    const filterResult = await evaluateQuestion(content, {
      isOfftopic,
      offTopicReason,
      answer,
      summary,
      keywords,
      knowledgeDecision,
    });
    
    // Build question with flagged field
    const question = this.buildAndSave(content, answer, store, {
      summary,
      keywords,
      storyHook,
      knowledgeDecision,
      flagged: filterResult.flagged,          // NEW: attach flag result
      filterReason: filterResult.reason,      // NEW: for UI
      preComputedEmbedding: queryEmbedding,
    });
    
    return {
      success: true,
      data: { question, relatedQuestions, newConnections: question.relatedQuestionIds.length },
    };
  },
  
  buildAndSave(
    content: string,
    answer: string,
    existingQuestions?: Question[],
    meta?: {
      summary?: string;
      keywords?: string[];
      storyHook?: string;
      knowledgeDecision?: object;
      flagged?: boolean;              // NEW field
      filterReason?: string;          // NEW: for UI
      preComputedEmbedding?: number[];
    },
  ): Question {
    // ... existing code ...
    
    const question: Question = {
      id: newId(),
      timestamp: Date.now(),
      date: today(),
      content,
      answer,
      summary,
      title: deriveTitleFromQuestion(content),
      flagged: meta?.flagged ?? false,       // NEW: store in question
      filterReason: meta?.filterReason,      // NEW: for UI tooltip
      // ... rest of fields ...
    };
    
    saveStore([question, ...store]);
    persistToSQLite(question);
    eventBus.emit({ type: 'QUESTION_ASKED', payload: question });
    
    return question;
  },
};
```

### Example 4: Badge Component
```typescript
// Source: Phase 6 UI pattern
// File: src/components/OffTopicBadge.tsx

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OffTopicBadgeProps {
  reason?: string;
  onSaveAnyway: () => void;
  onDiscard: () => void;
}

export function OffTopicBadge({
  reason = 'This looks off-topic and won\'t be saved',
  onSaveAnyway,
  onDiscard,
}: OffTopicBadgeProps) {
  const [showPopover, setShowPopover] = useState(false);
  
  return (
    <div style={{ marginTop: '8px' }}>
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={() => setShowPopover(!showPopover)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          fontSize: '0.75rem',
          color: 'var(--warning-color, #FF6F00)',
          backgroundColor: 'rgba(255, 111, 0, 0.08)',
          border: '1px solid rgba(255, 111, 0, 0.2)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        aria-label="Question flagged as off-topic"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 111, 0, 0.15)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 111, 0, 0.08)')}
      >
        <AlertCircle size={12} />
        Off-topic
      </motion.button>
      
      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: 'var(--surface-variant)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              color: 'var(--foreground)',
            }}
          >
            <p style={{ marginBottom: '12px', margin: 0 }}>{reason}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowPopover(false);
                  onSaveAnyway();
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'var(--primary-40)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}
              >
                Yes, save
              </button>
              <button
                onClick={() => {
                  setShowPopover(false);
                  onDiscard();
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}
              >
                Discard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Example 5: ChatMessage Integration
```typescript
// Source: Phase 6 integration with ChatMessage
// File: src/components/ChatMessage.tsx (modified excerpt)

interface ChatMessageProps {
  messageId: string;
  type: MessageType;
  content: string;
  relatedKnowledge?: string[];
  onKnowledgeClick?: (knowledge: string) => void;
  // NEW: off-topic state and handlers
  flagged?: boolean;
  filterReason?: string;
  onOverrideSave?: () => void;
  onDiscard?: () => void;
  // ... existing props ...
}

export function ChatMessage({
  type,
  content,
  relatedKnowledge,
  onKnowledgeClick,
  flagged,
  filterReason,
  onOverrideSave,
  onDiscard,
  // ... existing destructuring ...
}: ChatMessageProps) {
  // ... existing code ...
  
  if (type === 'ai') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
        <div style={{ maxWidth: '85%', minWidth: 0 }}>
          <div style={{ /* bubble styles */ }}>
            <Markdown>{content}</Markdown>
            {relatedKnowledge && relatedKnowledge.length > 0 && (
              // ... existing related knowledge UI ...
            )}
          </div>
          
          {/* NEW: Off-topic badge and override */}
          {flagged && onOverrideSave && onDiscard && (
            <OffTopicBadge
              reason={filterReason}
              onSaveAnyway={onOverrideSave}
              onDiscard={onDiscard}
            />
          )}
          
          {/* Existing action chips */}
          {showActions && (/* ... existing code ... */)}
        </div>
      </div>
    );
  }
  
  // ... rest of component ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store all questions indiscriminately | Filter meta/off-topic before storage | Phase 6 (this phase) | Cleaner knowledge graph; users control what gets persisted |
| Modal dialog for all question actions | Inline badge + popover for secondary actions | Phase 5-6 | Faster UX, less UI friction, native mobile feel |
| Single LLM API call (answer only) | Structured JSON response with classification fields | Phase 1 → Phase 6 | LLM response already includes decision data; classification adds minimal overhead |

**Deprecated/outdated:**
- "Ask the user to confirm saving every question" — Replaced by auto-save valid questions (Phase 6). Only friction when flagged.
- "Full-text search for off-topic questions in knowledge graph" — Prevented by flagging at source (Phase 6).

---

## Open Questions

1. **Should we cache LLM off-topic evaluations per question content?**
   - What we know: LLM evaluation is deterministic (same question → same result)
   - What's unclear: Storage overhead vs. API cost benefit trade-off
   - Recommendation: Log flagging frequency per rule; if >50% of questions trigger LLM fallback, implement a simple in-memory cache (Map<contentHash, result>) during the session. Defer persistent caching to Phase 7.

2. **How strictly should we detect meta-questions?**
   - What we know: CONTEXT.md says "allow diverse topics" but filter meta-questions
   - What's unclear: What counts as meta? ("What is X?" vs. "Tell me about X?")
   - Recommendation: Start conservative — only flag "What did I ask?" type questions. "What is X?" is a legitimate educational question.

3. **Should off-topic flagging affect review schedules?**
   - What we know: Flagged questions can be overridden and saved
   - What's unclear: Should a flagged-but-saved question have lower review priority?
   - Recommendation: No change to review schedule. User's override decision is definitive.

4. **How do we handle false positives in testing?**
   - What we know: Over-aggressive filtering damages trust
   - What's unclear: What's the acceptable false positive rate?
   - Recommendation: Aim for <5% of valid educational questions flagged. Test against 100+ real questions before shipping.

---

## Environment Availability

**Step 2.6: SKIPPED** — Phase 6 has no external dependencies beyond the existing LLM providers (already configured in Phase 1). No new tools, databases, runtimes, or CLIs are required.

---

## Validation Architecture

**Trigger:** workflow.nyquist_validation not explicitly set to false in .planning/config.json, so section is ENABLED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 (recommended) + @testing-library/react (not yet in stack) |
| Config file | `vitest.config.ts` (to be created) |
| Quick run command | `npm run test:filter` (pattern tests only, <1 second) |
| Full suite command | `npm run test` (all tests including integration) |

**Note:** EchoLearn currently has no test infrastructure. Phase 6 research identifies the need; Phase 6 planning will include Wave 0 to set up Vitest + Testing Library. For now, document the strategy.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHASE-6-1 | Pattern matching detects greetings | unit | `vitest run src/services/__tests__/question-filter.test.ts -t "greeting"` | ❌ Wave 0 |
| PHASE-6-2 | Pattern matching detects meta-questions | unit | `vitest run src/services/__tests__/question-filter.test.ts -t "meta"` | ❌ Wave 0 |
| PHASE-6-3 | LLM response includes isOfftopic field | unit | `vitest run src/services/__tests__/question-filter.test.ts -t "llm"` | ❌ Wave 0 |
| PHASE-6-4 | Flagged question not ingested unless overridden | integration | `vitest run src/services/__tests__/question.test.ts -t "flagged"` | ❌ Wave 0 |
| PHASE-6-5 | Badge appears for flagged questions in ChatMessage | component | `vitest run src/components/__tests__/ChatMessage.test.tsx -t "badge"` | ❌ Wave 0 |
| PHASE-6-6 | Override "Save anyway" persists flagged=false | integration | `vitest run src/services/__tests__/question.test.ts -t "override"` | ❌ Wave 0 |
| PHASE-6-7 | <5% of real educational questions flagged | manual/sampling | Approve sample of 100 questions before /gsd-verify-work | — |

### Sampling Rate
- **Per task commit:** `npm run test:filter` (quick pattern unit tests)
- **Per wave merge:** `npm run test` (full suite if framework is set up in Wave 0)
- **Phase gate:** Manual review of 20 flagged questions before `/gsd-verify-work` to catch false positives

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest configuration (mirror vite.config.ts settings)
- [ ] `src/services/__tests__/question-filter.test.ts` — Pattern matching unit tests (PHASE-6-1, PHASE-6-2, PHASE-6-3)
- [ ] `src/services/__tests__/question.test.ts` — Integration tests for question.service.ts (flagged persistence, override)
- [ ] `src/components/__tests__/ChatMessage.test.tsx` — Badge rendering and interaction tests
- [ ] `package.json` scripts — Add `test` and `test:filter` scripts
- [ ] Install dev dependencies: `npm install -D vitest @testing-library/react @testing-library/dom happy-dom`

**Recommended test implementation order:**
1. Set up Vitest config (1 task)
2. Pattern matching unit tests (tests for each rule)
3. Integration tests (flagged field persists correctly)
4. Component tests (badge renders, popover works)
5. Manual sampling (run Phase 6 implementation, flag 20+ real questions, review for false positives)

---

## Sources

### Primary (HIGH confidence)
- **Context7 + CONTEXT.md** — Locked decisions and phase scope (patterns verified from CONTEXT.md)
- **EchoLearn codebase** — question.service.ts, types/index.ts, ChatMessage.tsx (current architecture understood)
- **npm registry** — Verified versions: React 19.2.0, Framer Motion 12.38.0, Tailwind CSS 4.2.2, lucide-react 1.6.0, Vitest 4.1.1

### Secondary (MEDIUM confidence)
- **NPM search results** — simple-offtopic (0.1.1) exists, @framers/agentos-ext-topicality exists (alternative approaches documented)
- **Material Design 3 patterns** — Badge and popover guidance (standard mobile UX patterns)

### Tertiary (ANALYSIS + INFERENCE)
- **Design of question-filter.service.ts** — Derived from CONTEXT.md locked decisions + question.service.ts architecture
- **LLM embedding in response** — Recommended over separate API call based on cost/latency analysis
- **Pattern rules** — Common NLP off-topic detection patterns (industry standard; verified against typical chatbot systems)

---

## Metadata

**Confidence breakdown:**
- **Standard Stack (HIGH):** All libraries verified in npm registry with current versions
- **Architecture (HIGH):** Locked decisions from CONTEXT.md; integration points verified in codebase
- **Patterns (MEDIUM-HIGH):** Derived from NLP best practices; specific to EchoLearn's context (educational Q&A)
- **LLM Integration (HIGH):** question.service.ts structure analyzed; JSON embedding is low-risk
- **Testing Strategy (MEDIUM):** Test infrastructure not yet in place; strategy is sound but requires Wave 0 setup

**Research date:** 2025-03-26
**Valid until:** 2025-04-09 (14 days — pattern detection and LLM integration are stable; minor updates only for new libraries)

---

## Next Steps for Planner

1. **REQUIRED:** Create Wave 0 task for Vitest setup (vitest.config.ts, test scripts in package.json)
2. **IMPLEMENTATION ORDER:**
   - Add `flagged` field to Question type (types/index.ts)
   - Create question-filter.service.ts with pattern rules
   - Integrate filter into question.service.ts (after LLM parsing)
   - Extend ChatMessage to render OffTopicBadge component
   - Implement override handling (patch question, persist, event)
   - Unit tests for patterns + integration tests for persistence
   - Manual sampling (flag 20+ questions, review for false positives)
3. **BLOCKED ON:** None — all decisions are locked from CONTEXT.md

---

