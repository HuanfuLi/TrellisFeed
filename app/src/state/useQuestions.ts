import { useState, useEffect, useCallback } from 'react';
import type { Question, ServiceError } from '../types';
import { questionService } from '../services/question.service';
import { mockSettingsService } from '../services/mock/settings.mock';
import { chatStream } from '../providers/llm';
import { today } from '../lib/date';

interface UseQuestionsReturn {
  questions: Question[];
  isAsking: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  ask: (content: string) => Promise<Question | null>;
  askStreaming: (content: string, onToken: (accumulated: string) => void) => Promise<Question | null>;
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
  }, []);

  const ask = useCallback(async (content: string): Promise<Question | null> => {
    setIsAsking(true);
    setError(null);
    const result = await questionService.ask(content);
    if (result.success && result.data) {
      setQuestions((prev) => [result.data!.question, ...prev]);
      setIsAsking(false);
      return result.data.question;
    } else {
      setError(result.error ?? null);
      setIsAsking(false);
      return null;
    }
  }, []);

  const askStreaming = useCallback(
    async (content: string, onToken: (accumulated: string) => void): Promise<Question | null> => {
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
        const recentContext = store.slice(0, 3);
        const contextLines = recentContext
          .map((q) => `Q: ${q.content}\nA: ${q.summary}`)
          .join('\n');

        const systemPrompt = [
          'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
          'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
          recentContext.length > 0 ? `Recent questions for context:\n${contextLines}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        let accumulated = '';
        const stream = chatStream(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
          ],
          llmConfig,
        );

        for await (const token of stream) {
          accumulated += token;
          onToken(accumulated);
        }

        // Persist and get structured question
        const question = questionService.buildAndSave(content, accumulated, store);
        setQuestions((prev) => [question, ...prev]);
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
