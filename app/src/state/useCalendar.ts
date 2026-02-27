import { useState, useCallback } from 'react';
import type { DaySchedule, TodoStatus, ServiceError } from '../types';
import { mockCalendarService } from '../services/mock/calendar.mock';

interface UseCalendarReturn {
  schedule: DaySchedule | null;
  isLoading: boolean;
  error: ServiceError | null;
  loadDay: (date: string) => Promise<void>;
  addTodo: (blockId: string, content: string) => Promise<void>;
  toggleTodo: (todoId: string, currentStatus: TodoStatus) => Promise<void>;
  postponeTodo: (todoId: string) => Promise<void>;
  cancelPostpone: (todoId: string) => Promise<void>;
}

export function useCalendar(): UseCalendarReturn {
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);

  const loadDay = useCallback(async (date: string) => {
    setIsLoading(true);
    const result = await mockCalendarService.getDaySchedule(date);
    if (result.success && result.data) {
      setSchedule({ ...result.data });
    } else {
      setError(result.error ?? null);
    }
    setIsLoading(false);
  }, []);

  const addTodo = useCallback(async (blockId: string, content: string) => {
    const result = await mockCalendarService.addTodo(blockId, content);
    if (result.success && result.data && schedule) {
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.id === blockId ? { ...b, todos: [...b.todos, result.data!] } : b
          ),
        };
      });
    }
  }, [schedule]);

  const toggleTodo = useCallback(async (todoId: string, currentStatus: TodoStatus) => {
    const newStatus: TodoStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const result = await mockCalendarService.updateTodoStatus(todoId, newStatus);
    if (result.success && result.data) {
      const updated = result.data;
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => ({
            ...b,
            todos: b.todos.map((td) => td.id === todoId ? updated : td),
          })),
        };
      });
    }
  }, []);

  const postponeTodo = useCallback(async (todoId: string) => {
    const result = await mockCalendarService.postponeTodo(todoId);
    if (result.success) {
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => ({
            ...b,
            todos: b.todos.map((td) => td.id === todoId ? { ...td, status: 'postponed' as TodoStatus } : td),
          })),
        };
      });
    }
  }, []);

  const cancelPostpone = useCallback(async (todoId: string) => {
    const result = await mockCalendarService.cancelPostpone(todoId);
    if (result.success) {
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => ({
            ...b,
            todos: b.todos.map((td) => td.id === todoId ? { ...td, status: 'pending' as TodoStatus } : td),
          })),
        };
      });
    }
  }, []);

  return { schedule, isLoading, error, loadDay, addTodo, toggleTodo, postponeTodo, cancelPostpone };
}
