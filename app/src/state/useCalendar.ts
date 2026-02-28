import { useState, useCallback } from 'react';
import type { DaySchedule, TimeBlock, TodoStatus, ServiceError } from '../types';
import { mockCalendarService } from '../services/mock/calendar.mock';

interface UseCalendarReturn {
  schedule: DaySchedule | null;
  isLoading: boolean;
  error: ServiceError | null;
  loadDay: (date: string) => Promise<void>;
  addBlock: (date: string) => Promise<TimeBlock | null>;
  updateBlock: (blockId: string, updates: Partial<Pick<TimeBlock, 'startTime' | 'endTime' | 'label'>>) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  togglePinBlock: (blockId: string) => Promise<void>;
  addTodo: (blockId: string, content: string) => Promise<void>;
  deleteTodo: (todoId: string) => Promise<void>;
  toggleTodo: (todoId: string, currentStatus: TodoStatus) => Promise<void>;
  postponeTodo: (todoId: string) => Promise<void>;
  cancelPostpone: (todoId: string) => Promise<void>;
  togglePinTodo: (todoId: string) => Promise<void>;
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

  const addBlock = useCallback(async (date: string): Promise<TimeBlock | null> => {
    const result = await mockCalendarService.createBlock(date, '', '', 'New Block');
    if (result.success && result.data) {
      const newBlock = result.data;
      setSchedule((prev) => {
        if (!prev) return prev;
        return { ...prev, blocks: [...prev.blocks, newBlock] };
      });
      return newBlock;
    }
    return null;
  }, []);

  const updateBlock = useCallback(async (
    blockId: string,
    updates: Partial<Pick<TimeBlock, 'startTime' | 'endTime' | 'label'>>,
  ) => {
    const result = await mockCalendarService.updateBlock(blockId, updates);
    if (result.success && result.data) {
      const updated = result.data;
      setSchedule((prev) => {
        if (!prev) return prev;
        return { ...prev, blocks: prev.blocks.map((b) => b.id === blockId ? { ...updated } : b) };
      });
    }
  }, []);

  const deleteBlock = useCallback(async (blockId: string) => {
    const result = await mockCalendarService.deleteBlock(blockId);
    if (result.success) {
      setSchedule((prev) => {
        if (!prev) return prev;
        return { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) };
      });
    }
  }, []);

  const togglePinBlock = useCallback(async (blockId: string) => {
    const result = await mockCalendarService.togglePinBlock(blockId);
    if (result.success && result.data) {
      const updated = result.data;
      setSchedule((prev) => {
        if (!prev) return prev;
        return { ...prev, blocks: prev.blocks.map((b) => b.id === blockId ? { ...updated } : b) };
      });
    }
  }, []);

  const addTodo = useCallback(async (blockId: string, content: string) => {
    const result = await mockCalendarService.addTodo(blockId, content);
    if (result.success) {
      // The mock pushes the new todo into the shared block reference in-place.
      // Spreading b.todos (which already contains it) triggers re-render without duplicating.
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.id === blockId ? { ...b, todos: [...b.todos] } : b
          ),
        };
      });
    }
  }, []);

  const deleteTodo = useCallback(async (todoId: string) => {
    const result = await mockCalendarService.deleteTodo(todoId);
    if (result.success) {
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => ({
            ...b,
            todos: b.todos.filter((td) => td.id !== todoId),
          })),
        };
      });
    }
  }, []);

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

  const togglePinTodo = useCallback(async (todoId: string) => {
    const result = await mockCalendarService.togglePinTodo(todoId);
    if (result.success && result.data) {
      const { todo, block: updatedBlock } = result.data;
      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => {
            if (b.id === todo.blockId) {
              return {
                ...b,
                pinned: updatedBlock.pinned,
                todos: b.todos.map((td) => td.id === todo.id ? { ...todo } : td),
              };
            }
            return b;
          }),
        };
      });
    }
  }, []);

  return {
    schedule, isLoading, error,
    loadDay, addBlock, updateBlock, deleteBlock, togglePinBlock,
    addTodo, deleteTodo, toggleTodo, postponeTodo, cancelPostpone, togglePinTodo,
  };
}
