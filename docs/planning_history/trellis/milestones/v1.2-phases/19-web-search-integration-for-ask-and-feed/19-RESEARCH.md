# Phase 19: Web Search Integration for Ask and Feed - Research

**Researched:** 2026-04-03
**Domain:** Web Search API integration, LLM tool-use pattern, feed content enrichment
**Confidence:** HIGH

## Summary

This phase adds web search capability at two integration points: (1) the Ask screen's streaming LLM chat, where the LLM can invoke a `web_search` tool or the user can force it via a globe toggle, and (2) the Home feed, where existing concept posts get web-enriched context and a new "News" post type delivers daily web-sourced content.

The core technical challenge is implementing a web search service that calls an external API from the browser/Capacitor context, then integrating results into two distinct LLM pipelines (chat streaming and post generation). Citation rendering in ChatMessage requires parsing numbered references from LLM output and rendering a collapsible Sources section.

**Primary recommendation:** Use Tavily Search API (1,000 free credits/month, LLM-optimized response format) with a thin service wrapper. Implement the tool-use pattern as a two-pass approach in `askStreaming`: first pass asks the LLM, if it requests web_search OR globe toggle is on, execute search and re-prompt with results. For the feed, append web search context to the post generation prompt and add a separate news post generator.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tool-use pattern -- LLM receives a `web_search` tool definition in its system prompt. It decides autonomously when a question needs real-time information. No keyword heuristics or always-search.
- **D-02:** Globe toggle icon next to the send button in ChatInput. When active, the next message always includes web search results regardless of whether the LLM would have invoked the tool.
- **D-03:** Globe toggle is sticky -- stays on for all subsequent messages in the session until user explicitly taps it off.
- **D-04:** Inline citations in response text -- small numbered links [1][2][3] within the LLM response. A collapsible "Sources" section at the bottom of the message shows full URLs and titles for each citation.
- **D-05:** Search provider at Claude's discretion -- pick whichever works well. Free tier preferred.
- **D-06:** Two modes of web integration: (1) Enriched AI posts get web-searched context during generation. (2) New "News" post type purely web-sourced.
- **D-07:** Periodic background fetch -- separate from main post generation.
- **D-08:** Daily fetch, 2-3 news posts per day. Fetched once per day alongside daily post generation.
- **D-09:** Newspaper style -- headline-forward card with subtle newsprint texture or serif font treatment. Source attribution visible.

### Claude's Discretion
- Web search API provider selection and configuration
- How to structure the `web_search` tool definition for the LLM
- Citation extraction approach (LLM generates citations vs post-processing)
- How enriched AI posts blend web context into their narrative
- News post background fetch scheduling mechanism
- Newsprint texture CSS implementation
- How to handle search API failures/rate limits gracefully
- News post data model (extend DailyPost or new type)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEB-01 | LLM tool-use pattern -- web_search tool definition in system prompt, LLM decides when to search | Two-pass approach: system prompt instructs LLM to output `[TOOL:web_search]{query}` when needed; `askStreaming` detects this marker and executes search |
| WEB-02 | Globe toggle in ChatInput -- forces web search when LLM fails to invoke it | New `webSearchEnabled` state prop on ChatInput, `Globe` icon from lucide-react, sticky per-session state |
| WEB-03 | Inline citations [1][2] with collapsible Sources section | LLM instructed to include numbered citations; post-processing regex extracts `[N]` references; Sources section rendered in ChatMessage |
| WEB-04 | Web search API provider integration (free tier preferred) | Tavily Search API: 1,000 free credits/month, LLM-optimized JSON response with title/url/content/score |
| NEWS-01 | Enriched AI posts -- existing concept posts get web context during generation | Inject web search snippets into concept-feed LLM prompt as additional context block |
| NEWS-02 | New "News" post type -- purely web-sourced, related to user's learning concepts | New `sourceType: 'news'`, `PresentationStyle: 'news'` on DailyPost; generated from Tavily results + LLM summarization |
| NEWS-03 | Daily background fetch -- 2-3 news posts per day, separate from main post generation | Fire-and-forget pattern (like `_backgroundGenerateVideos`), separate localStorage cache key |
| NEWS-04 | Newspaper-style card -- headline-forward, newsprint texture/serif font, source attribution | CSS serif font stack, subtle background pattern, source URL badge on card face |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tavily Search API | v1 (REST) | Web search provider | 1,000 free credits/month, LLM-optimized response (ranked snippets + relevance scores + clean content), simpler than Brave for AI use cases |
| lucide-react | 0.575.0 (installed) | Globe toggle icon | Already in project; `Globe` icon available |
| react-markdown | 10.1.0 (installed) | Citation rendering in Markdown | Already used by `Markdown` component for AI responses |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new packages needed | -- | -- | All functionality built with existing stack + Tavily REST API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tavily | Brave Search API | Brave killed free tier Feb 2026; now $5/1000 requests with $5 monthly credit. Less LLM-optimized response format. Requires more post-processing. |
| Tavily | SearXNG (self-hosted) | Free unlimited but requires server infrastructure. Not viable for a local-first mobile app. |
| Tavily | Google Custom Search | 100 free queries/day but response not optimized for LLM consumption. |

**Installation:**
```bash
# No npm packages to install -- Tavily is a REST API called via fetch
```

**Why Tavily over Brave:**
1. Brave removed its free tier in Feb 2026. New users get $5 monthly credit (~1,000 searches) but must add a credit card. Tavily gives 1,000 free credits/month with no card required.
2. Tavily response includes `content` (clean text snippet) and `score` (relevance) per result -- ready for LLM injection without parsing HTML descriptions.
3. Tavily has a `topic: "news"` parameter that returns news-specific results -- directly useful for NEWS-02.
4. Tavily `include_answer` can provide a pre-summarized answer, reducing token cost for simple queries.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   └── web-search.service.ts     # Tavily API wrapper + caching
├── providers/
│   └── llm/
│       └── index.ts              # Modified: web search tool-use detection
├── components/
│   ├── ChatInput.tsx             # Modified: globe toggle
│   ├── ChatMessage.tsx           # Modified: citation rendering + Sources section
│   └── NewsCard.tsx              # New: newspaper-style card component
├── state/
│   └── useQuestions.ts           # Modified: web search injection in askStreaming
└── types/
    └── index.ts                  # Modified: sourceType union, PresentationStyle, WebSearchResult type
```

### Pattern 1: Two-Pass Tool-Use (for Ask Screen)

**What:** Since the app calls LLM APIs directly (no SDK with built-in tool-use), implement tool-use as a two-pass text protocol. The system prompt tells the LLM about the `web_search` tool. If the LLM outputs a tool invocation marker, `askStreaming` intercepts it, executes the search, and re-prompts with results.

**When to use:** Every `askStreaming` call.

**Why this approach:** The current `chatStream`/`chatCompletion` functions are raw HTTP calls. Claude's tool_use API, OpenAI's function_calling, and Gemini's function_declarations all have different wire formats. A text-based protocol works across all providers without modifying the LLM provider layer.

**Example:**
```typescript
// System prompt addition
const WEB_SEARCH_TOOL_PROMPT = `
You have access to a web search tool. When a question requires current/real-time information,
recent events, up-to-date facts, or verification of claims, output exactly:
[TOOL:web_search]{"query": "your search query here"}

Rules:
- Only invoke the tool when the question genuinely needs current information
- After receiving search results, synthesize them into your answer
- Include numbered citations [1][2] referencing the sources
- Do NOT invoke the tool for conceptual/theoretical questions you can answer from training
`;

// In askStreaming: detect tool invocation in accumulated text
const TOOL_PATTERN = /\[TOOL:web_search\]\s*(\{[^}]+\})/;

// Pass 1: Stream LLM response
// If TOOL_PATTERN matched OR globe toggle is on:
//   Execute Tavily search
//   Pass 2: Re-prompt with search results injected as context
```

### Pattern 2: Globe Toggle State Management

**What:** Session-level sticky toggle state managed in AskScreen, passed down to ChatInput as prop, and consumed by `askStreaming` logic.

**Example:**
```typescript
// AskScreen.tsx
const [webSearchEnabled, setWebSearchEnabled] = useState(false);

// Pass to ChatInput
<ChatInput
  onSend={handleSend}
  webSearchEnabled={webSearchEnabled}
  onToggleWebSearch={() => setWebSearchEnabled(prev => !prev)}
/>

// In askStreaming call: if webSearchEnabled, skip tool-use detection
// and always execute search before LLM call
```

### Pattern 3: Citation Extraction and Rendering

**What:** LLM is instructed to include `[1]`, `[2]` etc. in response text and list sources at the end. Post-processing extracts source list and renders citations as superscript links with a collapsible Sources section.

**Example:**
```typescript
// Citation extraction from LLM response
interface Citation {
  index: number;
  title: string;
  url: string;
}

function extractCitations(content: string): { cleanContent: string; citations: Citation[] } {
  // Look for a Sources/References section at the end
  const sourcesPattern = /\n(?:Sources|References):\s*\n((?:\[\d+\].+\n?)+)/i;
  const match = content.match(sourcesPattern);
  if (!match) return { cleanContent: content, citations: [] };

  const cleanContent = content.slice(0, match.index).trimEnd();
  const citations: Citation[] = [];
  const linePattern = /\[(\d+)\]\s*(?:\[([^\]]+)\]\(([^)]+)\)|(.+?)(?:\s*[-:]\s*(.+))?)\s*$/gm;
  // ... parse each citation line
  return { cleanContent, citations };
}
```

### Pattern 4: News Post Background Fetch

**What:** Fire-and-forget pattern (identical to `_backgroundGenerateVideos`) that runs once per day when `getDailyPosts` is called, generating 2-3 news posts from Tavily search results.

**Example:**
```typescript
const NEWS_CACHE_KEY = 'echolearn_news_posts';

let _newsGenPromise: Promise<void> | null = null;

function _backgroundGenerateNews(): void {
  if (_newsGenPromise) return; // already running
  const cached = readNewsCache();
  if (cached?.date === today() && cached.posts.length > 0) return; // already generated today

  _newsGenPromise = generateNewsPosts()
    .then((posts) => {
      writeNewsCache(posts);
      eventBus.emit({ type: 'NEWS_POSTS_READY', payload: posts });
    })
    .catch(console.warn)
    .finally(() => { _newsGenPromise = null; });
}
```

### Anti-Patterns to Avoid
- **Native tool_use API per provider:** Do NOT implement Claude tool_use, OpenAI function_calling, and Gemini function_declarations separately. The text-based protocol works across all providers with zero provider-layer changes.
- **Always-search:** Do NOT search on every query. The LLM decides, or the user forces it with the globe toggle. This preserves Tavily free tier quota.
- **Blocking the feed on news:** News generation MUST be fire-and-forget. Never block `getDailyPosts` on news fetch.
- **Storing API key in code:** Use the existing `mockSettingsService` localStorage pattern for the Tavily API key, same as LLM API keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web search | Custom web scraper | Tavily Search API | Rate limits, legal issues, parsing complexity, CORS |
| Citation parsing | Complex NLP | Regex + LLM instruction | LLM generates structured citations when instructed; regex extracts them reliably |
| News content summarization | Custom summarizer | LLM prompt with Tavily snippets | Tavily already provides clean text snippets; LLM synthesizes into post format |
| Newspaper font rendering | Custom font loader | System serif font stack | `Georgia, 'Times New Roman', serif` covers all platforms without font downloads |

**Key insight:** The web search API does the heavy lifting (query execution, relevance ranking, content extraction). The app only needs a thin service wrapper and smart prompting.

## Common Pitfalls

### Pitfall 1: CORS Blocking Tavily API Calls
**What goes wrong:** Browser fetch to `api.tavily.com` may be blocked by CORS in development.
**Why it happens:** Tavily API returns CORS headers but dev servers may not proxy correctly.
**How to avoid:** Use CapacitorHttp on native platforms (same pattern as `localPost` in llm/index.ts). On web, Tavily's API supports CORS for browser-based apps. Test in dev early.
**Warning signs:** Network errors with no response body.

### Pitfall 2: Exhausting Free Tier Quota
**What goes wrong:** 1,000 credits/month depleted in a few days if every chat message triggers a search.
**Why it happens:** No rate limiting or budget tracking.
**How to avoid:** (1) LLM decides when to search (not every message). (2) Cache search results for identical/similar queries within a session. (3) News generation uses 2-3 searches/day max. (4) Show remaining credits in Settings if possible.
**Warning signs:** Tavily returns 432 (plan limit exceeded).

### Pitfall 3: Tool-Use Detection False Positives
**What goes wrong:** LLM outputs something that looks like `[TOOL:web_search]` in normal text.
**Why it happens:** Pattern matching on streamed text can match partial content.
**How to avoid:** Only check for tool invocation AFTER streaming completes (check final accumulated text, not mid-stream). Use a very specific marker pattern unlikely to appear in natural text.
**Warning signs:** Unexpected search calls on conceptual questions.

### Pitfall 4: Citation Index Mismatch
**What goes wrong:** LLM generates `[1]` in text but the Sources section has different numbering.
**Why it happens:** LLM may skip numbers, reorder, or generate citations inconsistently.
**How to avoid:** Post-process to renumber citations sequentially. Only display sources that are actually referenced in the text body.
**Warning signs:** Clicking `[2]` shows wrong source.

### Pitfall 5: Streaming Interruption on Two-Pass
**What goes wrong:** User sees LLM start generating, then sees `[TOOL:web_search]`, then the response restarts.
**Why it happens:** Two-pass means the first pass may stream partial text before the tool marker.
**How to avoid:** On tool detection, clear the accumulated text and show a "Searching the web..." indicator. Then stream the second pass from scratch.
**Warning signs:** Jumpy UI, text appearing then disappearing.

### Pitfall 6: News Post Generation Failing Silently
**What goes wrong:** News posts never appear in the feed.
**Why it happens:** Background fetch fails (no API key, rate limited) with only console.warn.
**How to avoid:** Log failures to a visible place (e.g., a subtle "News unavailable" badge). Check that the Tavily API key is configured before attempting news generation.
**Warning signs:** News cache is always empty.

## Code Examples

### Web Search Service (Tavily wrapper)
```typescript
// src/services/web-search.service.ts
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { ServiceResult } from '../types';
import { settingsService } from './settings.service';

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;  // clean text snippet
  score: number;    // relevance 0-1
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  responseTime: number;
}

export async function webSearch(
  query: string,
  options?: { topic?: 'general' | 'news'; maxResults?: number }
): Promise<ServiceResult<WebSearchResponse>> {
  const settings = settingsService.getSync();
  const apiKey = settings.webSearch?.tavilyApiKey;
  if (!apiKey) {
    return { success: false, error: { code: 'NOT_CONFIGURED', message: 'Tavily API key not set', retryable: false } };
  }

  const body = {
    query,
    topic: options?.topic ?? 'general',
    max_results: options?.maxResults ?? 5,
    search_depth: 'basic',           // 1 credit per search
    include_answer: false,
    include_raw_content: false,
  };

  try {
    const url = 'https://api.tavily.com/search';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    let data: Record<string, unknown>;
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({ url, headers, data: body });
      data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    } else {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Tavily API error ${res.status}`);
      data = await res.json() as Record<string, unknown>;
    }

    const results = (data.results as Array<Record<string, unknown>>).map((r) => ({
      title: r.title as string,
      url: r.url as string,
      content: r.content as string,
      score: r.score as number,
    }));

    return {
      success: true,
      data: { results, query: data.query as string, responseTime: data.response_time as number },
    };
  } catch (e) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : String(e), retryable: true },
    };
  }
}
```

### Globe Toggle in ChatInput
```typescript
// Addition to ChatInput props
interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
}

// Globe button between mic and input field
<button
  type="button"
  onClick={onToggleWebSearch}
  title={webSearchEnabled ? 'Web search ON' : 'Web search OFF'}
  style={{
    flexShrink: 0,
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: webSearchEnabled ? 'var(--primary-40)' : 'transparent',
    color: webSearchEnabled ? 'white' : 'var(--muted-foreground)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s, color 0.2s',
  }}
>
  <Globe size={17} />
</button>
```

### Citation Rendering in ChatMessage
```typescript
// In ChatMessage, after <Markdown>{content}</Markdown>
// Detect and render sources section

interface SourceCitation {
  index: number;
  title: string;
  url: string;
}

function parseSources(content: string): { body: string; sources: SourceCitation[] } {
  // Split at "Sources:" or "References:" line
  const dividerIdx = content.search(/\n\s*(?:Sources|References)\s*:\s*\n/i);
  if (dividerIdx === -1) return { body: content, sources: [] };

  const body = content.slice(0, dividerIdx).trimEnd();
  const sourcesBlock = content.slice(dividerIdx);
  const sources: SourceCitation[] = [];

  const lineRx = /\[(\d+)\]\s*\[?([^\]\n]+?)\]?\s*(?:\(([^)\n]+)\)|[-:]\s*(https?:\/\/\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = lineRx.exec(sourcesBlock))) {
    sources.push({ index: Number(m[1]), title: m[2], url: m[3] || m[4] });
  }
  return { body, sources };
}

// Collapsible Sources section component
function SourcesSection({ sources }: { sources: SourceCitation[] }) {
  const [expanded, setExpanded] = useState(false);
  if (sources.length === 0) return null;
  return (
    <div style={{ marginTop: '12px' }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        fontSize: '0.78rem',
        color: 'var(--muted-foreground)',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <Globe size={13} />
        {sources.length} source{sources.length > 1 ? 's' : ''}
        <span style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>^</span>
      </button>
      {expanded && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sources.map((s) => (
            <a key={s.index} href={s.url} target="_blank" rel="noopener noreferrer" style={{
              fontSize: '0.8rem', color: 'var(--primary-40)', textDecoration: 'none',
            }}>
              [{s.index}] {s.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Newspaper-Style News Card CSS
```typescript
// NewsCard styling -- serif font, headline-forward
const newsCardStyle: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', 'Noto Serif', serif",
  backgroundColor: '#faf8f4',           // warm newsprint tone
  borderRadius: 'var(--radius-xl)',
  padding: '20px',
  position: 'relative',
  overflow: 'hidden',
};

const headlineStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  lineHeight: 1.3,
  color: '#1a1a1a',
  marginBottom: '8px',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const sourceAttributionStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '12px',
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brave Search free tier (2,000/month) | Brave killed free tier, now $5/1000 req | Feb 2026 | Tavily is the better free option |
| Full tool_use API per provider | Text-based tool markers (provider-agnostic) | Ongoing | Simpler for multi-provider apps that do raw HTTP |
| Scraping search results | Dedicated search APIs (Tavily, Brave) | 2024+ | Reliable, legal, structured results |

**Deprecated/outdated:**
- Brave Search free tier: Removed Feb 12, 2026. New users get $5 monthly credit with card required.
- Google Custom Search free tier: Still exists (100/day) but response format requires heavy parsing for LLM use.

## Open Questions

1. **Tavily CORS in Capacitor WebView**
   - What we know: Tavily API supports CORS headers. Capacitor's CapacitorHttp bypasses CORS on native.
   - What's unclear: Whether Tavily CORS works correctly in Android/iOS WebView for web-mode testing.
   - Recommendation: Use CapacitorHttp on native (same pattern as existing LLM calls). Test web mode in dev. Fall back to a proxy only if needed.

2. **Tavily API Key Storage UX**
   - What we know: LLM API keys are stored via mockSettingsService in localStorage. Same pattern applies.
   - What's unclear: Where in SettingsScreen to place the Tavily key field.
   - Recommendation: Add under a "Web Search" section in SettingsScreen, below the LLM config. Include a "Test Connection" button (same pattern as LLM test).

3. **Credit Budget Tracking**
   - What we know: 1,000 credits/month free. Each basic search = 1 credit.
   - What's unclear: Whether to show remaining credits to user or just fail gracefully.
   - Recommendation: Start with graceful failure (toast on 429/432). Add credit tracking later if users report issues.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner |
| Config file | none (scripts in package.json) |
| Quick run command | `node --test app/tests/**/*.test.mjs` |
| Full suite command | `node --test app/tests/**/*.test.mjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEB-01 | Tool-use detection in LLM response | unit | `node --test app/tests/services/web-search.test.mjs` | No -- Wave 0 |
| WEB-02 | Globe toggle state management | unit | `node --test app/tests/components/chat-input.test.mjs` | No -- Wave 0 |
| WEB-03 | Citation extraction and parsing | unit | `node --test app/tests/services/web-search.test.mjs` | No -- Wave 0 |
| WEB-04 | Tavily API integration | unit | `node --test app/tests/services/web-search.test.mjs` | No -- Wave 0 |
| NEWS-01 | Enriched post generation with web context | unit | `node --test app/tests/services/concept-feed.test.mjs` | Exists (extend) |
| NEWS-02 | News post type and data model | unit | `node --test app/tests/services/web-search.test.mjs` | No -- Wave 0 |
| NEWS-03 | Daily background news fetch | unit | `node --test app/tests/services/web-search.test.mjs` | No -- Wave 0 |
| NEWS-04 | News card rendering | manual-only | Visual inspection | N/A |

### Sampling Rate
- **Per task commit:** `node --test app/tests/services/web-search.test.mjs`
- **Per wave merge:** `node --test app/tests/**/*.test.mjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/tests/services/web-search.test.mjs` -- covers WEB-01, WEB-03, WEB-04, NEWS-02, NEWS-03
- [ ] Citation parsing unit tests (pure function, highly testable)
- [ ] Tool-use marker detection unit tests

## Sources

### Primary (HIGH confidence)
- Tavily API docs (https://docs.tavily.com) -- endpoint format, request/response schema, pricing, credits
- Brave Search API pricing page (https://api-dashboard.search.brave.com/documentation/pricing) -- confirmed free tier removal
- Project source code -- `providers/llm/index.ts`, `ChatInput.tsx`, `ChatMessage.tsx`, `useQuestions.ts`, `concept-feed.service.ts`, `youtube.service.ts`

### Secondary (MEDIUM confidence)
- Web search: "Brave Kills Free Search API Tier" (https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/) -- confirmed Feb 2026 change
- Web search: Tavily pricing (https://www.tavily.com/pricing) -- 1,000 free credits/month verified
- Web search: Firecrawl blog on search API comparisons (https://www.firecrawl.dev/blog/best-web-search-apis) -- ecosystem overview

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Tavily API is well-documented, pricing verified from multiple sources, response format confirmed from official docs
- Architecture: HIGH -- Two-pass tool-use pattern is a known approach for provider-agnostic apps; code patterns mirror existing project conventions
- Pitfalls: HIGH -- CORS, quota, and streaming interruption are well-known issues with search-augmented LLM apps

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain; Tavily pricing may change)
