import type { DaySchedule, TimeBlock, TodoItem, TodoStatus, ServiceResult } from '../../types';
import { today, addDays } from '../../lib/date';
import { eventBus } from '../../lib/event-bus';

let blockIdCounter = 200;
let todoIdCounter = 300;

function newBlockId(): string { return `blk-${++blockIdCounter}`; }
function newTodoId(): string { return `td-${++todoIdCounter}`; }

const t = today();

const seedBlocks: TimeBlock[] = [
  {
    id: 'blk-1',
    date: t,
    startTime: '09:00',
    endTime: '10:30',
    label: 'Morning Study Session',
    sortOrder: 0,
    todos: [
      { id: 'td-1', blockId: 'blk-1', content: 'Review quantum physics notes', status: 'completed', createdAt: Date.now() - 7200000, completedAt: Date.now() - 3600000 },
      { id: 'td-2', blockId: 'blk-1', content: 'Read chapter 5 of Deep Learning book', status: 'pending', createdAt: Date.now() - 7200000 },
      { id: 'td-3', blockId: 'blk-1', content: 'Summarize dialectical materialism', status: 'pending', createdAt: Date.now() - 7200000 },
    ],
  },
  {
    id: 'blk-2',
    date: t,
    startTime: '13:00',
    endTime: '14:30',
    label: 'Afternoon Practice',
    sortOrder: 1,
    todos: [
      { id: 'td-4', blockId: 'blk-2', content: 'Practice flashcards — physics set', status: 'pending', createdAt: Date.now() - 3600000 },
      { id: 'td-5', blockId: 'blk-2', content: 'Write notes on backpropagation', status: 'pending', createdAt: Date.now() - 3600000 },
    ],
  },
  {
    id: 'blk-3',
    date: t,
    startTime: '20:00',
    endTime: '21:00',
    label: 'Evening Review',
    sortOrder: 2,
    todos: [
      { id: 'td-6', blockId: 'blk-3', content: 'Listen to daily podcast', status: 'pending', createdAt: Date.now() - 1800000 },
      { id: 'td-7', blockId: 'blk-3', content: 'Plan tomorrow\'s learning goals', status: 'pending', createdAt: Date.now() - 1800000 },
    ],
  },
];

const scheduleStore: Map<string, TimeBlock[]> = new Map([
  [t, seedBlocks],
]);

function getBlocksForDate(date: string): TimeBlock[] {
  if (!scheduleStore.has(date)) {
    scheduleStore.set(date, []);
  }
  return scheduleStore.get(date)!;
}

function findTodoAndBlock(todoId: string): { block: TimeBlock; todo: TodoItem } | null {
  for (const blocks of scheduleStore.values()) {
    for (const block of blocks) {
      const todo = block.todos.find((td) => td.id === todoId);
      if (todo) return { block, todo };
    }
  }
  return null;
}

function findBlock(blockId: string): TimeBlock | null {
  for (const blocks of scheduleStore.values()) {
    const block = blocks.find((b) => b.id === blockId);
    if (block) return block;
  }
  return null;
}

export const mockCalendarService = {
  async getDaySchedule(date: string): Promise<ServiceResult<DaySchedule>> {
    const blocks = getBlocksForDate(date);
    const todayBlocks = getBlocksForDate(today());
    const reviewItemCount = todayBlocks.length > 0 ? 5 : 0;
    return { success: true, data: { date, blocks: [...blocks], reviewItemCount } };
  },

  async createBlock(date: string, startTime: string, endTime: string, label: string): Promise<ServiceResult<TimeBlock>> {
    const blocks = getBlocksForDate(date);
    const block: TimeBlock = {
      id: newBlockId(),
      date,
      startTime,
      endTime,
      label,
      todos: [],
      sortOrder: blocks.length,
    };
    blocks.push(block);
    eventBus.emit({ type: 'BLOCK_CREATED', payload: block });
    return { success: true, data: block };
  },

  async updateBlock(blockId: string, updates: Partial<Pick<TimeBlock, 'startTime' | 'endTime' | 'label'>>): Promise<ServiceResult<TimeBlock>> {
    const block = findBlock(blockId);
    if (!block) return { success: false, error: { code: 'NOT_FOUND', message: 'Block not found', retryable: false } };
    Object.assign(block, updates);
    eventBus.emit({ type: 'BLOCK_UPDATED', payload: block });
    return { success: true, data: block };
  },

  async deleteBlock(blockId: string): Promise<ServiceResult<void>> {
    for (const [date, blocks] of scheduleStore.entries()) {
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        blocks.splice(idx, 1);
        scheduleStore.set(date, blocks);
        return { success: true };
      }
    }
    return { success: false, error: { code: 'NOT_FOUND', message: 'Block not found', retryable: false } };
  },

  async addTodo(blockId: string, content: string): Promise<ServiceResult<TodoItem>> {
    const block = findBlock(blockId);
    if (!block) return { success: false, error: { code: 'NOT_FOUND', message: 'Block not found', retryable: false } };

    const todo: TodoItem = {
      id: newTodoId(),
      blockId,
      content,
      status: 'pending',
      createdAt: Date.now(),
    };
    block.todos.push(todo);
    eventBus.emit({ type: 'TODO_CREATED', payload: todo });
    return { success: true, data: todo };
  },

  async updateTodoStatus(todoId: string, status: TodoStatus): Promise<ServiceResult<TodoItem>> {
    const found = findTodoAndBlock(todoId);
    if (!found) return { success: false, error: { code: 'NOT_FOUND', message: 'Todo not found', retryable: false } };

    found.todo.status = status;
    if (status === 'completed') found.todo.completedAt = Date.now();
    eventBus.emit({ type: 'TODO_STATUS_CHANGED', payload: found.todo });
    return { success: true, data: found.todo };
  },

  async postponeTodo(todoId: string): Promise<ServiceResult<TodoItem>> {
    const found = findTodoAndBlock(todoId);
    if (!found) return { success: false, error: { code: 'NOT_FOUND', message: 'Todo not found', retryable: false } };

    const { block, todo } = found;
    if (todo.status !== 'pending') return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Only pending todos can be postponed', retryable: false } };

    todo.status = 'postponed';

    // Always carry over to the next day (not just next same-day block)
    const targetBlock = await this._getOrCreateNextDayBlock(block.date);

    const newTodo: TodoItem = {
      id: newTodoId(),
      blockId: targetBlock.id,
      content: todo.content,
      status: 'pending',
      createdAt: Date.now(),
      postponedFrom: block.id,
    };
    targetBlock.todos.push(newTodo);
    eventBus.emit({ type: 'TODO_STATUS_CHANGED', payload: todo });
    eventBus.emit({ type: 'TODO_CREATED', payload: newTodo });
    return { success: true, data: newTodo };
  },

  async cancelPostpone(todoId: string): Promise<ServiceResult<void>> {
    const found = findTodoAndBlock(todoId);
    if (!found) return { success: false, error: { code: 'NOT_FOUND', message: 'Todo not found', retryable: false } };

    const { block, todo } = found;
    if (todo.status !== 'postponed') return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Todo is not postponed', retryable: false } };

    // Find and remove the copy from the next day
    const nextDate = addDays(block.date, 1);
    const nextDayBlocks = scheduleStore.get(nextDate) ?? [];
    for (const nextBlock of nextDayBlocks) {
      const copyIdx = nextBlock.todos.findIndex(
        (td) => td.postponedFrom === block.id && td.content === todo.content,
      );
      if (copyIdx !== -1) {
        nextBlock.todos.splice(copyIdx, 1);
        break;
      }
    }

    // Restore original
    todo.status = 'pending';
    eventBus.emit({ type: 'TODO_STATUS_CHANGED', payload: todo });
    return { success: true };
  },

  async _getOrCreateNextDayBlock(date: string): Promise<TimeBlock> {
    const nextDate = addDays(date, 1);
    const blocks = getBlocksForDate(nextDate);
    if (blocks.length > 0) return blocks[0];
    const block: TimeBlock = {
      id: newBlockId(),
      date: nextDate,
      startTime: '09:00',
      endTime: '10:00',
      label: 'Carried Over',
      todos: [],
      sortOrder: 0,
    };
    blocks.push(block);
    return block;
  },

  async deleteTodo(todoId: string): Promise<ServiceResult<void>> {
    for (const blocks of scheduleStore.values()) {
      for (const block of blocks) {
        const idx = block.todos.findIndex((td) => td.id === todoId);
        if (idx !== -1) {
          block.todos.splice(idx, 1);
          return { success: true };
        }
      }
    }
    return { success: false, error: { code: 'NOT_FOUND', message: 'Todo not found', retryable: false } };
  },
};
