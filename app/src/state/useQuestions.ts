import { useState, useEffect, useCallback } from 'react';
import type { Question, ServiceError, SessionMessage } from '../types';
import { questionService } from '../services/question.service';
import { settingsService } from '../services/settings.service';
import { chatStream } from '../providers/llm';
import { today } from '../lib/date';
import { buildCandidateContextPack, classifyAndAnchorIncremental, formatCandidateContextPack } from '../services/canonical-knowledge.service';
import { getRateLimitStatus, incrementAskCount } from '../services/ask-rate-limiter.service';
import { evaluateQuestion as filterQuestion, type FilterResult, type QuestionFilterContext } from '../services/question-filter.service';
import { eventBus } from '../lib/event-bus';
import { webSearch } from '../services/web-search.service';
import { toast } from '../lib/toast';
import i18n from '../locales';

const WEB_SEARCH_TOOL_PROMPT = `
You have access to a web search tool. When a question requires current/real-time information, recent events, up-to-date facts, or verification of claims, output exactly:
[TOOL:web_search]{"query": "your search query here"}

Rules:
- Only invoke the tool when the question genuinely needs current information
- After receiving search results, synthesize them into your answer
- Include numbered citations [1][2] referencing the sources
- List sources at the end in this format:
  Sources:
  [1] [Title](URL)
  [2] [Title](URL)
- Do NOT invoke the tool for conceptual/theoretical questions you can answer from training
`;

const TOOL_PATTERN = /\[TOOL:web_search\]\s*(\{[^}]+\})/;

interface UseQuestionsReturn {
  questions: Question[];
  isAsking: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  ask: (content: string) => Promise<Question | null>;
  askStreaming: (content: string, onToken: (accumulated: string) => void, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[], webSearchEnabled?: boolean) => Promise<Question | null>;
  getByDate: (date: string) => Question[];
  getRecent: (n: number) => Question[];
  getById: (id: string) => Question | undefined;
}

export function useQuestions(): UseQuestionsReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await questionService.getRecent(50);
      if (result.success && result.data) {
        setQuestions(result.data);
      }
      setIsLoading(false);
    };
    load();

    // Sync with questions created by OTHER hook instances (e.g. AskScreen's
    // useQuestions adds a question, HomeScreen's instance needs to know).
    const unsubAsked = eventBus.subscribe('QUESTION_ASKED', (event) => {
      setQuestions((prev) => [event.payload, ...prev.filter((q) => q.id !== event.payload.id)]);
    });
    // Reload from store after the async classification step creates anchor/cluster
    // nodes. QUESTION_ASKED only carries the Q&A node; new anchors land in storage
    // later when commitClassificationResult runs and emits GRAPH_UPDATED. Without
    // this subscriber, useQuestions never sees the new anchors → buildConceptBatch
    // returns 0 anchors → refillQueue exits early → home/planner stay empty after
    // the first question on a fresh-install device.
    const unsubGraph = eventBus.subscribe('GRAPH_UPDATED', () => {
      void questionService.getRecent(50).then((result) => {
        if (result.success && result.data) setQuestions(result.data);
      });
    });
    return () => { unsubAsked(); unsubGraph(); };
  }, []);

  const ask = useCallback(async (content: string): Promise<Question | null> => {
    setIsAsking(true);
    setError(null);
    const result = await questionService.ask(content);
    if (result.success && result.data) {
      setQuestions((prev) => [result.data!.question, ...prev.filter((q) => q.id !== result.data!.question.id)]);
      setIsAsking(false);
      return result.data.question;
    } else {
      setError(result.error ?? null);
      setIsAsking(false);
      return null;
    }
  }, []);

  const askStreaming = useCallback(
    async (content: string, onToken: (accumulated: string) => void, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[], webSearchEnabled?: boolean): Promise<Question | null> => {
      setIsAsking(true);
      setError(null);

      const settings = settingsService.getSync();
      const llmConfig = settings.llm;

      if (!settings.preferences.aiConsentGiven) {
        const msg = 'AI features are disabled. Go to Settings → Privacy & Data and enable "AI Data Transmission" to use AI responses.';
        onToken(msg);
        setError({ code: 'NOT_CONFIGURED', message: msg, retryable: false });
        setIsAsking(false);
        return null;
      }

      if (!llmConfig.isConfigured) {
        const msg = 'Add your API key in Settings to get AI responses.';
        onToken(msg);
        setError({ code: 'NOT_CONFIGURED', message: msg, retryable: false });
        setIsAsking(false);
        return null;
      }

      const monthlyLimit = settings.preferences.askMonthlyLimit ?? 0;
      const rateLimitStatus = getRateLimitStatus(monthlyLimit);
      if (!rateLimitStatus.canAsk) {
        const resetMsg = `Monthly question limit reached (${monthlyLimit}). Resets on ${rateLimitStatus.resetDate}.`;
        onToken(resetMsg);
        setIsAsking(false);
        return null;
      }

      // ═══ D-22 — Shared abort controller for BOTH streaming passes ═══
      // One controller per askStreaming call. LOCALE_CHANGED subscriber
      // aborts it, which cancels any in-flight chatStream and flips the
      // `aborted` guards below to prevent buildAndSave on discarded output.
      const abortController = new AbortController();
      const unsubLocale = eventBus.subscribe('LOCALE_CHANGED', () => {
        abortController.abort(new DOMException('Locale changed', 'AbortError'));
      });

      try {
        // ═══ Phase 47 D-18 — Pre-LLM filter gate (pipeline inversion) ═══
        // Run the three-label classifier BEFORE chatStream so malicious
        // prompts spend ZERO answer-LLM tokens and never persist a Question.
        // Replaces the prior post-LLM-flag pattern (filterQuestion ran AFTER
        // buildAndSave, then patchQuestion round-tripped the flag). The
        // three-branch dispatch below decides whether the answer LLM runs.
        //
        // D-19: abortController.signal is threaded as the third arg so a
        // LOCALE_CHANGED event fired mid-classification cancels the embedding
        // call cleanly via the evaluator's AbortError path.
        //
        // D-12 graceful degradation: when filterQuestion throws a non-abort
        // error (embedding provider outage, missing API key, parse failure),
        // the pre-gate defaults to on-topic so the answer LLM still runs.
        // Bracketing (Plan 03) keeps safety intact during outages.
        let filterResult: FilterResult;
        try {
          filterResult = await filterQuestion(content, sessionContext, abortController.signal);
        } catch (err: unknown) {
          if (abortController.signal.aborted) {
            toast(i18n.t('ask.localeChangedDiscarded'));
            setIsAsking(false);
            return null;
          }
          console.warn('[Trellis] filter pre-gate failed, defaulting to on-topic:', err instanceof Error ? err.message : err);
          filterResult = { label: 'on-topic' };
        }

        // D-01 malicious branch — zero LLM tokens, no Question persisted.
        // Constructs a SessionMessage shape with kind: 'malicious-block' so
        // ChatMessage can render the inline rejection surface (no override
        // button per D-02). The streamed content is the i18n string that the
        // AskScreen placeholder will display while the (instant) flow returns.
        if (filterResult.label === 'malicious') {
          const blockedBody = i18n.t('chatMessage.maliciousBlocked.body');
          // Documented SessionMessage shape — useQuestions does not own the
          // session-message-append surface (AskScreen builds the persisted
          // SessionMessage from the streamed placeholder content). Keeping
          // the constructor here documents the kind discriminator at the
          // exact site that produces it and gives downstream wiring a
          // type-locked reference.
          const _maliciousBlock: SessionMessage = {
            id: '__pending__',
            type: 'ai',
            content: blockedBody,
            kind: 'malicious-block',
          };
          void _maliciousBlock; // suppress unused-var lint (documentation shape)
          onToken(blockedBody);
          setIsAsking(false);
          return null;
        }

        const store = questionService.getAll();
        const candidatePack = buildCandidateContextPack(content, store);

        // ═══ Phase 35 — System prompt MUST be byte-stable across turns ═══
        // The per-turn formatCandidateContextPack(candidatePack) interpolation lives in
        // a tail assistant message below, NOT in this string. Keeping this string stable
        // lets the provider's KV-cache prefix cover [system, ...history] across turns.
        // See app/CLAUDE.md "Ask-chat system prompt — byte-stable across turns" and
        // tests/state/useQuestions-system-prompt-stability.test.mjs.
        // Strict-alternation note: the tail position is `user(ack) → assistant(ctx) → user(query)`
        // so chat templates requiring user→assistant alternation (Qwen via LM Studio) accept turn 1.
        const systemPrompt = [
          'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
          'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
          WEB_SEARCH_TOOL_PROMPT,
        ]
          .filter(Boolean)
          .join('\n');

        // ═══ Phase 35 gap closure (UAT-1) — Strict-alternation user-ack ═══
        // Constant byte-stable user message inserted BETWEEN ...historyMessages and the
        // tail assistant context message so chat templates that strictly require user→
        // assistant alternation (Qwen via LM Studio's OpenAI-compatible proxy was the
        // prompting incident; smaller Llama variants likely also affected) accept the
        // turn-1 shape. KV-cache benefit preserved because (a) the ack is a constant,
        // (b) it lives AFTER history (still byte-stable across turns), (c) Pass 1 and
        // Pass 2 reference the same closure constant. See app/CLAUDE.md "Ask-chat
        // system prompt — byte-stable across turns" and the source-reading test.
        const USER_ACK_BEFORE_GRAPH_CONTEXT = 'Here is the knowledge graph context for this turn:';

        // Tail-position assistant message carries the per-turn candidate context pack.
        // Keep this OUT of the system prompt — system must be byte-stable across turns
        // so the provider's KV-cache prefix covers [system, ...history]. (Phase 35)
        // Reused identically by Pass 1 AND Pass 2 (single closure variable referenced
        // twice) so Pass 1's warm prefix carries over to Pass 2 unbroken. The empty-pack
        // case still emits this message — formatCandidateContextPack returns the
        // byte-stable string 'No close graph candidates found.' (D-07 planner choice:
        // keep one structural shape across turns).
        const assistantContextMessage = `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}`;

        // Convert SessionMessage[] to ChatMessage[] for the LLM (append-only for KV-cache)
        const historyMessages: { role: 'user' | 'assistant'; content: string }[] =
          (sessionHistory ?? []).map((m) => ({
            role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          }));

        // --- Pass 1: Stream LLM response ---
        // Strip [TOOL:web_search]{...} from display during streaming so
        // the raw tool-call syntax never leaks into the chat bubble.
        let accumulated = '';
        const stream = chatStream(
          [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT },
            { role: 'assistant', content: assistantContextMessage },
            { role: 'user', content },
          ],
          llmConfig,
          { serviceName: 'ask', signal: abortController.signal },
        );

        for await (const token of stream) {
          if (abortController.signal.aborted) break;
          accumulated += token;
          // Show the user a cleaned version — hide partial/complete tool markers
          const display = accumulated.replace(TOOL_PATTERN, '').replace(/\[TOOL:web_search\]\s*\{[^}]*$/, '').trimEnd();
          onToken(display);
        }

        if (abortController.signal.aborted) {
          toast(i18n.t('ask.localeChangedDiscarded'));
          setIsAsking(false);
          return null; // do NOT call buildAndSave with partial Pass-1 output
        }

        // --- Check for tool invocation OR forced web search ---
        const toolMatch = accumulated.match(TOOL_PATTERN);
        const needsSearch = webSearchEnabled || toolMatch;

        if (needsSearch) {
          // Determine search query
          let searchQuery = content; // default: use the user's question
          if (toolMatch) {
            try {
              const parsed = JSON.parse(toolMatch[1]);
              if (parsed.query) searchQuery = parsed.query;
            } catch { /* use default */ }
          }

          // Show searching indicator below Pass 1 text (cleaned of tool markers)
          const cleanPass1 = accumulated.replace(TOOL_PATTERN, '').trimEnd();
          const searchingText = cleanPass1
            ? `${cleanPass1}\n\n🔍 Searching the web...`
            : '🔍 Searching the web...';
          onToken(searchingText);

          const searchResult = await webSearch(searchQuery);

          if (searchResult.success && searchResult.data) {
            // Format search results for injection
            const searchContext = searchResult.data.results
              .slice(0, 5)
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nURL: ${r.url}`)
              .join('\n\n');

            // --- Pass 2: Re-prompt with search results (replaces Pass 1) ---
            // Reuses the SAME abortController + signal as Pass 1. A single
            // LOCALE_CHANGED event aborts the whole flow regardless of which
            // pass is currently in flight.
            accumulated = '';
            const stream2 = chatStream(
              [
                { role: 'system', content: systemPrompt },
                ...historyMessages,
                { role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT },
                { role: 'assistant', content: assistantContextMessage },
                { role: 'user', content },
                {
                  role: 'assistant',
                  content: 'I searched the web for relevant information. Let me provide an answer based on the search results.',
                },
                {
                  role: 'user',
                  content: `Web search results for "${searchQuery}":\n\n${searchContext}\n\nUsing these search results, provide a comprehensive answer to my original question. Include numbered citations [1][2] etc. referencing the sources, and list them at the end under "Sources:" with format [N] [Title](URL).`,
                },
              ],
              llmConfig,
              { serviceName: 'ask', signal: abortController.signal },
            );

            for await (const token of stream2) {
              if (abortController.signal.aborted) break;
              accumulated += token;
              onToken(accumulated);
            }

            if (abortController.signal.aborted) {
              toast(i18n.t('ask.localeChangedDiscarded'));
              setIsAsking(false);
              return null; // do NOT persist Pass-2 partial
            }
          }
          // If search failed, keep the original response (minus the tool marker)
          else if (toolMatch) {
            accumulated = accumulated.replace(TOOL_PATTERN, '').trim();
            onToken(accumulated);
          }
        }

        // Final guard before persistence — covers any abort that fired between
        // the last loop-level check and this line (e.g. during webSearch).
        if (abortController.signal.aborted) {
          toast(i18n.t('ask.localeChangedDiscarded'));
          setIsAsking(false);
          return null;
        }

        // Persist and get structured question
        const rawQuestion = questionService.buildAndSave(content, accumulated, store);
        incrementAskCount();

        // ═══ Phase 47 D-01 — Branch on pre-gate filterResult.label ═══
        // The pre-gate above already decided whether this question is on-topic
        // or off-topic; the malicious branch returned early before chatStream.
        // Here we only choose between:
        //   - off-topic → patchQuestion(flagged:true) + emit QUESTION_ASKED +
        //                 SKIP classifyAndAnchorIncremental (flagged questions
        //                 NEVER enter the mind map per D-01)
        //   - on-topic  → fire-and-forget classifyAndAnchorIncremental
        //                 (existing pattern verbatim)
        if (filterResult.label === 'off-topic') {
          questionService.patchQuestion(rawQuestion.id, { flagged: true });
          rawQuestion.flagged = true;
          // Re-broadcast with the correct flagged status so other useQuestions
          // instances (e.g. HomeScreen) replace their copy before feed
          // re-generation runs. buildAndSave already fired QUESTION_ASKED
          // without flagged set, so any hook that received that event will
          // still have the unflagged version.
          eventBus.emit({ type: 'QUESTION_ASKED', payload: rawQuestion });
        } else {
          // on-topic — fire classification (existing pattern at the prior
          // post-LLM site, verbatim except `rawQuestion` replaces `question`).
          void classifyAndAnchorIncremental(rawQuestion, questionService.getAll(), llmConfig, abortController.signal).catch((err: unknown) => {
            console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
          });
        }

        setQuestions((prev) => [rawQuestion, ...prev.filter((q) => q.id !== rawQuestion.id)]);
        setIsAsking(false);
        return rawQuestion;
      } catch (e) {
        // A LOCALE_CHANGED abort can surface here as an AbortError from fetch.
        // Treat it as a clean cancel, not an error toast.
        if (abortController.signal.aborted) {
          toast(i18n.t('ask.localeChangedDiscarded'));
          setIsAsking(false);
          return null;
        }
        const msg = e instanceof Error ? e.message : String(e);
        onToken(msg);
        setError({ code: 'NETWORK_ERROR', message: msg, retryable: true });
        setIsAsking(false);
        return null;
      } finally {
        unsubLocale();
      }
    },
    [],
  );

  const getByDate = useCallback(
    (date: string): Question[] => questions.filter((q) => q.date === date),
    [questions],
  );

  const getRecent = useCallback((n: number): Question[] => questions.slice(0, n), [questions]);

  const getById = useCallback(
    (id: string): Question | undefined => questions.find((q) => q.id === id),
    [questions],
  );

  return { questions, isAsking, isLoading, error, ask, askStreaming, getByDate, getRecent, getById };
}

export function useTodayQuestions() {
  const { getByDate } = useQuestions();
  return getByDate(today());
}
