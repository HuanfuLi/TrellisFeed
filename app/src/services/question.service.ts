import type { Question, ServiceResult, AskResult } from '../types';
import { today, addDays } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import { mockSettingsService } from './mock/settings.mock';
import { chatCompletion } from '../providers/llm';

const STORAGE_KEY = 'echolearn_questions';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  'not', 'with', 'as', 'by', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'this',
  'that', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
]);

let idCounter = Date.now();
function newId(): string {
  return `q-${++idCounter}`;
}

function loadStore(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Question[];
  } catch {
    return [];
  }
}

function saveStore(questions: Question[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch {
    // ignore storage errors
  }
}

// Derive a short display title from the user's raw question text.
// Strips leading question words and trailing "?", then title-cases + truncates.
function deriveTitleFromQuestion(content: string): string {
  const clean = content
    .replace(/\?+$/, '')
    .trim()
    .replace(
      /^(what(?:'s|\s+is|\s+are|\s+was|\s+were|\s+does|\s+do|\s+can|\s+should|\s+would)?|how(?:\s+is|\s+are|\s+does|\s+do|\s+can|\s+should|\s+would)?|why(?:\s+is|\s+are|\s+does|\s+do)?|when(?:\s+is|\s+are|\s+does|\s+do)?|where(?:\s+is|\s+are)?|who(?:\s+is|\s+are)?|which(?:\s+is|\s+are)?|explain|describe|define|tell\s+me(?:\s+about|\s+how|\s+what|\s+why)?|give\s+me|help\s+me\s+understand)\s+/i,
      '',
    )
    .trim();
  const result = clean || content;
  const titled = result.charAt(0).toUpperCase() + result.slice(1);
  return titled.length > 52 ? titled.slice(0, 49) + '…' : titled;
}

function extractSummary(answer: string): string {
  const dot = answer.indexOf('.');
  if (dot > 0 && dot < 120) return answer.slice(0, dot + 1);
  return answer.slice(0, 100) + (answer.length > 100 ? '...' : '');
}

function extractKeywords(text: string): string[] {
  const freq: Record<string, number> = {};
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .forEach((word) => {
      if (word.length > 3 && !STOP_WORDS.has(word)) {
        freq[word] = (freq[word] ?? 0) + 1;
      }
    });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function findRelated(keywords: string[], store: Question[]): string[] {
  const kws = new Set(keywords);
  return store
    .filter((q) => q.keywords.some((k) => kws.has(k)))
    .slice(0, 3)
    .map((q) => q.id);
}

export const questionService = {
  async ask(content: string): Promise<ServiceResult<AskResult>> {
    const settings = mockSettingsService.getSync();
    const llmConfig = settings.llm;

    if (!llmConfig.isConfigured) {
      return {
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Add your API key in Settings to get AI responses.',
          retryable: false,
        },
      };
    }

    const store = loadStore();
    const recentContext = store.slice(0, 3);
    const contextLines = recentContext
      .map((q) => `Q: ${q.content}\nA: ${q.summary}`)
      .join('\n');

    const systemPrompt = [
      'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
      'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
      recentContext.length > 0 ? `Recent questions for context:\n${contextLines}` : '',
      'Respond ONLY with JSON: {"answer":"...","summary":"one sentence","keywords":["kw1","kw2","kw3"]}',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        llmConfig,
      );

      let answer: string;
      let summary: string;
      let keywords: string[];

      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
          answer?: string;
          summary?: string;
          keywords?: string[];
        };
        answer = parsed.answer ?? raw;
        summary = parsed.summary ?? extractSummary(answer);
        keywords = Array.isArray(parsed.keywords) ? parsed.keywords : extractKeywords(answer);
      } catch {
        answer = raw;
        summary = extractSummary(raw);
        keywords = extractKeywords(raw);
      }

      const question = this.buildAndSave(content, answer, store, { summary, keywords });
      const relatedQuestions = store.filter((q) =>
        question.relatedQuestionIds.includes(q.id),
      );

      return {
        success: true,
        data: { question, relatedQuestions, newConnections: question.relatedQuestionIds.length },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: {
          code:
            msg.includes('401') || msg.toLowerCase().includes('invalid')
              ? 'API_KEY_INVALID'
              : 'NETWORK_ERROR',
          message: msg,
          retryable: true,
        },
      };
    }
  },

  buildAndSave(
    content: string,
    answer: string,
    existingQuestions?: Question[],
    meta?: { summary?: string; keywords?: string[] },
  ): Question {
    const store = existingQuestions ?? loadStore();
    const summary = meta?.summary ?? extractSummary(answer);
    const keywords = meta?.keywords ?? extractKeywords(answer);
    const relatedQuestionIds = findRelated(keywords, store);

    const question: Question = {
      id: newId(),
      timestamp: Date.now(),
      date: today(),
      content,
      answer,
      summary,
      title: deriveTitleFromQuestion(content),
      keywords,
      relatedQuestionIds,
      categoryIds: ['cat-general'],
      reviewSchedule: {
        nextReviewDate: addDays(today(), 1),
        reviewCount: 0,
        easeFactor: 2.5,
      },
      createdAt: Date.now(),
    };

    saveStore([question, ...store]);
    eventBus.emit({ type: 'QUESTION_ASKED', payload: question });
    return question;
  },

  async getById(id: string): Promise<ServiceResult<Question>> {
    const q = loadStore().find((q) => q.id === id);
    if (!q) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found', retryable: false },
      };
    }
    return { success: true, data: q };
  },

  async getByDate(date: string): Promise<ServiceResult<Question[]>> {
    return { success: true, data: loadStore().filter((q) => q.date === date) };
  },

  async getRecent(limit: number): Promise<ServiceResult<Question[]>> {
    return { success: true, data: loadStore().slice(0, limit) };
  },

  async search(query: string): Promise<ServiceResult<Question[]>> {
    const q = query.toLowerCase();
    return {
      success: true,
      data: loadStore().filter(
        (item) =>
          item.content.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
      ),
    };
  },

  async delete(id: string): Promise<ServiceResult<void>> {
    saveStore(loadStore().filter((q) => q.id !== id));
    eventBus.emit({ type: 'QUESTION_DELETED', payload: { id } });
    return { success: true };
  },

  getAll(): Question[] {
    return loadStore();
  },

  updateReviewSchedule(questionId: string, schedule: Question['reviewSchedule']): void {
    const store = loadStore();
    const idx = store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], reviewSchedule: schedule };
      saveStore(store);
    }
  },
};
