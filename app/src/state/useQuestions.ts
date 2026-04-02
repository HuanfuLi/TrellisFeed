import { useState, useEffect, useCallback } from 'react';
import type { Question, ServiceError, SessionMessage } from '../types';
import { questionService } from '../services/question.service';
import { mockSettingsService } from '../services/mock/settings.mock';
import { chatStream } from '../providers/llm';
import { today } from '../lib/date';
import { buildCandidateContextPack, classifyAndAnchor, formatCandidateContextPack } from '../services/canonical-knowledge.service';
import { evaluateQuestion as filterQuestion, type QuestionFilterContext } from '../services/question-filter.service';
import { eventBus } from '../lib/event-bus';

interface UseQuestionsReturn {
  questions: Question[];
  isAsking: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  ask: (content: string) => Promise<Question | null>;
  askStreaming: (content: string, onToken: (accumulated: string) => void, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[]) => Promise<Question | null>;
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
    const unsub = eventBus.subscribe('QUESTION_ASKED', (event) => {
      setQuestions((prev) => [event.payload, ...prev.filter((q) => q.id !== event.payload.id)]);
    });
    return unsub;
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
    async (content: string, onToken: (accumulated: string) => void, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[]): Promise<Question | null> => {
      setIsAsking(true);
      setError(null);

      const settings = mockSettingsService.getSync();
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

      try {
        const store = questionService.getAll();
        const candidatePack = buildCandidateContextPack(content, store);

        const systemPrompt = [
          'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
          'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
          `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}`,
        ]
          .filter(Boolean)
          .join('\n');

        // Convert SessionMessage[] to ChatMessage[] for the LLM (append-only for KV-cache)
        const historyMessages: { role: 'user' | 'assistant'; content: string }[] =
          (sessionHistory ?? []).map((m) => ({
            role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          }));

        let accumulated = '';
        const stream = chatStream(
          [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content },
          ],
          llmConfig,
        );

        for await (const token of stream) {
          accumulated += token;
          onToken(accumulated);
        }

        // Persist and get structured question
        const rawQuestion = questionService.buildAndSave(content, accumulated, store);

        // Evaluate for off-topic/meta status (with session context for follow-up handling)
        const question = await filterQuestion(rawQuestion, sessionContext);

        // Persist the flagged status back to store if it changed
        if (question.flagged !== rawQuestion.flagged) {
          questionService.patchQuestion(question.id, { flagged: question.flagged });
          // Re-broadcast with the correct flagged status so other useQuestions instances
          // (e.g. HomeScreen) replace their copy before feed re-generation runs.
          // buildAndSave already fired QUESTION_ASKED without flagged set, so any
          // hook that received that event will still have the unflagged version.
          eventBus.emit({ type: 'QUESTION_ASKED', payload: question });
        }

        // ── Second classification call (Phase 14) ──────────────────────────────
        // Fire ONLY when Q&A enters the mindmap (not flagged).
        if (question.flagged !== true) {
          void classifyAndAnchor(question, questionService.getAll(), llmConfig).catch((err: unknown) => {
            console.warn('[EchoLearn] classifyAndAnchor failed:', err instanceof Error ? err.message : err);
          });
        }

        setQuestions((prev) => [question, ...prev.filter((q) => q.id !== question.id)]);
        setIsAsking(false);
        return question;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        onToken(msg);
        setError({ code: 'NETWORK_ERROR', message: msg, retryable: true });
        setIsAsking(false);
        return null;
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
