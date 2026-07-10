import { useState, useEffect, useCallback } from 'react';
import type { Question, ServiceError } from '../types';
import { questionService } from '../services/question.service';
import { eventBus } from '../lib/event-bus';

interface UseQuestionsReturn {
  questions: Question[];
  isAsking: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  ask: (content: string) => Promise<Question | null>;
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
    void load();

    const unsubAsked = eventBus.subscribe('QUESTION_ASKED', (event) => {
      setQuestions((prev) => [event.payload, ...prev.filter((q) => q.id !== event.payload.id)]);
    });
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
    }
    setError(result.error ?? null);
    setIsAsking(false);
    return null;
  }, []);

  const getByDate = useCallback(
    (date: string): Question[] => questions.filter((q) => q.date === date),
    [questions],
  );

  const getRecent = useCallback((n: number): Question[] => questions.slice(0, n), [questions]);

  const getById = useCallback(
    (id: string): Question | undefined => questions.find((q) => q.id === id),
    [questions],
  );

  return { questions, isAsking, isLoading, error, ask, getByDate, getRecent, getById };
}
