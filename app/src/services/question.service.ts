import type { Question, ServiceResult, AskResult } from '../types/index.ts';
import { today } from '../lib/date.ts';
import { eventBus } from '../lib/event-bus.ts';
import { toast } from '../lib/toast.ts';
import { mockSettingsService } from './mock/settings.mock.ts';
import { chatCompletion } from '../providers/llm/index.ts';
import { embedText, cosine } from '../providers/embedding/index.ts';
import { dbExecute, dbQuery } from './db.service.ts';
import {
  buildCanonicalQuestionPatch,
  buildCandidateContextPack,
  decideIngestionOutcome,
  formatCandidateContextPack,
} from './canonical-knowledge.service.ts';
import { evaluateQuestion as filterQuestion, type QuestionFilterContext } from './question-filter.service.ts';

const STORAGE_KEY = 'echolearn_questions';

// ─── SQLite write-through helpers ────────────────────────────────────────────
// DDL lives in db.service.ts (_runMigrations / init). These helpers only do DML.

/** Write a single question to SQLite (fire-and-forget; localStorage is primary). */
function persistToSQLite(question: Question) {
  void dbExecute('INSERT OR REPLACE INTO questions (id, data) VALUES (?, ?)', [
    question.id,
    JSON.stringify(question),
  ]);
}

/** Delete a question from SQLite. */
function deleteFromSQLite(id: string) {
  void dbExecute('DELETE FROM questions WHERE id = ?', [id]);
}

let hydrated = false;

/**
 * On startup, if SQLite has questions not yet in localStorage, import them.
 * This enables cross-session persistence on native when localStorage is cleared.
 */
export async function hydrateFromSQLite(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM questions');
    if (rows.length === 0) return;

    const existing = loadStore();
    const existingIds = new Set(existing.map((q) => q.id));
    const toAdd: Question[] = [];
    for (const row of rows) {
      if (!existingIds.has(row.id)) {
        try { toAdd.push(JSON.parse(row.data) as Question); } catch { /* skip corrupt rows */ }
      }
    }
    if (toAdd.length > 0) {
      saveStore([...toAdd, ...existing]);
    }
  } catch {
    // SQLite not available (web without capacitor) — silently skip
  }
}

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
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast('Storage full — your question may not be saved. Clear old data in Settings.', 'error');
    }
  }
}

// Derive a short display title from the user's raw question text.
// Strips leading question words and trailing "?", then title-cases + truncates.
export function deriveTitleFromQuestion(content: string): string {
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

/**
 * Find questions related to the current topic.
 * When an embedding is provided (e.g. the target question's existing vector),
 * keyword-matching candidates are re-ranked by cosine similarity so the most
 * semantically aligned questions appear first. Falls back to keyword order when
 * no embedding is available (new question not yet embedded).
 */
function findRelated(keywords: string[], store: Question[], embedding?: number[]): string[] {
  const kws = new Set(keywords);
  const candidates = store.filter((q) => q.keywords.some((k) => kws.has(k)));

  if (embedding && embedding.length > 0) {
    const withVectors = candidates.filter((q) => q.embeddingVector && q.embeddingVector.length > 0);
    if (withVectors.length > 0) {
      return withVectors
        .map((q) => ({ q, score: cosine(embedding, q.embeddingVector!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ q }) => q.id);
    }
  }

  return candidates.slice(0, 3).map((q) => q.id);
}

export const questionService = {
  async ask(content: string, sessionContext?: QuestionFilterContext): Promise<ServiceResult<AskResult>> {
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

    // Pre-compute query embedding before the LLM call so context candidates can be
    // re-ranked by cosine similarity instead of keyword overlap alone.
    const embCfgEarly = mockSettingsService.getSync().embedding;
    let queryEmbedding: number[] | undefined;
    if (embCfgEarly.isConfigured) {
      try {
        queryEmbedding = await embedText(content, embCfgEarly);
      } catch (err) {
        console.warn('[EchoLearn] pre-call embedding failed — context ranking will use keywords only:', err instanceof Error ? err.message : err);
      }
    }

    const recentContext = store.slice(0, 3);
    const contextLines = recentContext
      .map((q) => `Q: ${q.content}\nA: ${q.summary}`)
      .join('\n');
    const candidatePack = buildCandidateContextPack(content, store, 5, queryEmbedding);

    const systemPrompt = [
      'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
      'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
      recentContext.length > 0 ? `Recent questions for context:\n${contextLines}` : '',
      `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}`,
      'Respond ONLY with JSON:',
      '{"answer":"...","summary":"one sentence","keywords":["kw1","kw2","kw3"],"storyHook":"An intriguing hook (≤15 words) to spark curiosity about this topic.","knowledgeDecision":{"outcome":"merge|refine|new","targetNodeId":"optional existing node id","rootLabel":"broad academic domain, 1-3 words, e.g. Cognitive Science / Computer Science / Physics","branchLabel":"sub-discipline or topic area, 2-4 words, e.g. Memory and Learning / Sorting Algorithms","clusterLabel":"the specific concept being asked about, 1-4 words, e.g. Spaced Repetition / Quicksort / Entropy","placementReason":"why this belongs there"}}',
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
      let storyHook: string | undefined;
      let knowledgeDecision: {
        outcome?: 'merge' | 'refine' | 'new';
        targetNodeId?: string;
        rootLabel?: string;
        branchLabel?: string;
        clusterLabel?: string;
        placementReason?: string;
      } | undefined;

      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
          answer?: string;
          summary?: string;
          keywords?: string[];
          storyHook?: string;
          knowledgeDecision?: {
            outcome?: 'merge' | 'refine' | 'new';
            targetNodeId?: string;
            rootLabel?: string;
            branchLabel?: string;
            clusterLabel?: string;
            placementReason?: string;
          };
        };
        answer = parsed.answer ?? raw;
        summary = parsed.summary ?? extractSummary(answer);
        keywords = Array.isArray(parsed.keywords) ? parsed.keywords : extractKeywords(answer);
        storyHook = typeof parsed.storyHook === 'string' && parsed.storyHook ? parsed.storyHook : undefined;
        knowledgeDecision = parsed.knowledgeDecision;
      } catch {
        answer = raw;
        summary = extractSummary(raw);
        keywords = extractKeywords(raw);
      }

      const question = this.buildAndSave(content, answer, store, { summary, keywords, storyHook, knowledgeDecision, preComputedEmbedding: queryEmbedding });

      // Evaluate question for off-topic/meta status
      const flagged = await filterQuestion(question, sessionContext);

      // Persist the flagged status back to store and SQLite
      const freshStore = loadStore();
      const idx = freshStore.findIndex((q) => q.id === question.id);
      if (idx !== -1) {
        freshStore[idx] = flagged;
        saveStore(freshStore);
        persistToSQLite(flagged);
      }

      const relatedQuestions = freshStore.filter((q) =>
        flagged.relatedQuestionIds.includes(q.id),
      );

      return {
        success: true,
        data: { question: flagged, relatedQuestions, newConnections: flagged.relatedQuestionIds.length },
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
    meta?: {
      summary?: string;
      keywords?: string[];
      storyHook?: string;
      knowledgeDecision?: {
        outcome?: 'merge' | 'refine' | 'new';
        targetNodeId?: string;
        rootLabel?: string;
        branchLabel?: string;
        clusterLabel?: string;
        placementReason?: string;
      };
      /** Pre-computed embedding for the query content (from ask() pre-call). When present,
       *  stored directly on the question — no async fire-and-forget needed for the initial save. */
      preComputedEmbedding?: number[];
    },
  ): Question {
    const store = existingQuestions ?? loadStore();
    const summary = meta?.summary ?? extractSummary(answer);
    const keywords = meta?.keywords ?? extractKeywords(answer);
    const decision = decideIngestionOutcome(content, store, meta?.knowledgeDecision);

    if (decision.outcome === 'merge' && decision.targetNodeId) {
      const target = store.find((candidate) => candidate.id === decision.targetNodeId);
      if (target) {
        const idx = store.findIndex((candidate) => candidate.id === target.id);
        // Use the target's existing embedding (if available) to rank initial related IDs by cosine.
        const mergedRelated = findRelated(keywords, store.filter((q) => q.id !== target.id), target.embeddingVector);
        const mergedQuestion: Question = {
          ...target,
          answer: target.answer.length >= answer.length ? target.answer : answer,
          summary: target.summary.length >= summary.length ? target.summary : summary,
          storyHook: target.storyHook || meta?.storyHook,
          keywords: Array.from(new Set([...target.keywords, ...keywords])).slice(0, 8),
          relatedQuestionIds: Array.from(new Set([...target.relatedQuestionIds, ...mergedRelated])).filter((id) => id !== target.id),
          ...buildCanonicalQuestionPatch(content, target, decision),
        };
        store[idx] = mergedQuestion;
        saveStore(store);
        persistToSQLite(mergedQuestion);
        eventBus.emit({ type: 'QUESTION_ASKED', payload: mergedQuestion });

        const embCfg = mockSettingsService.getSync().embedding;
        if (embCfg.isConfigured) {
          void embedText(`${mergedQuestion.content} ${mergedQuestion.answer}`, embCfg)
            .then((vector) => {
              questionService.patchQuestion(mergedQuestion.id, { embeddingVector: vector });
              // Update relatedQuestionIds with cosine-ranked candidates now that we have a vector.
              const allQ = questionService.getAll();
              const cosineIds = allQ
                .filter((q) => q.id !== mergedQuestion.id && q.embeddingVector && q.embeddingVector.length > 0)
                .map((q) => ({ id: q.id, score: cosine(vector, q.embeddingVector!) }))
                .filter((x) => x.score > 0.5)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((x) => x.id);
              if (cosineIds.length > 0) {
                const current = questionService.getAll().find((q) => q.id === mergedQuestion.id);
                const merged = Array.from(new Set([...(current?.relatedQuestionIds ?? []), ...cosineIds]));
                questionService.patchQuestion(mergedQuestion.id, { relatedQuestionIds: merged });
              }
            })
            .catch((err: unknown) => {
            console.warn('[EchoLearn] embedding failed for merged question %s — semantic features will fall back to keywords:', mergedQuestion.id, err instanceof Error ? err.message : err);
          });
        }

        return mergedQuestion;
      }
    }

    // Use pre-computed embedding (from ask() pre-call) for immediate cosine re-ranking;
    // fall back to keyword-only when no vector is available yet.
    const preVec = meta?.preComputedEmbedding;
    const relatedQuestionIds = findRelated(keywords, store, preVec);

    const question: Question = {
      id: newId(),
      timestamp: Date.now(),
      date: today(),
      content,
      answer,
      summary,
      title: deriveTitleFromQuestion(content),
      ...(meta?.storyHook ? { storyHook: meta.storyHook } : {}),
      keywords,
      relatedQuestionIds,
      categoryIds: ['cat-general'],
      reviewSchedule: {
        nextReviewDate: today(),
        reviewCount: 0,
        easeFactor: 2.5,
      },
      createdAt: Date.now(),
      aliases: [],
      sourcePrompts: [content],
      sourceQuestionIds: [],
      rootLabel: decision.rootLabel,
      branchLabel: decision.branchLabel,
      clusterLabel: decision.clusterLabel,
      nodeSummary: summary,
      placementReason: decision.placementReason,
      ...(decision.outcome === 'refine' && decision.targetNodeId ? { parentId: decision.targetNodeId } : {}),
      // Store the content-only embedding now if available; a richer content+answer vector
      // will be persisted once the full text embedding completes below.
      ...(preVec ? { embeddingVector: preVec } : {}),
    };

    saveStore([question, ...store]);
    persistToSQLite(question);
    eventBus.emit({ type: 'QUESTION_ASKED', payload: question });

    // Fire-and-forget: embed content+answer for a richer vector (replaces the content-only
    // pre-computed vector). Skipped entirely if embedding is not configured.
    const embeddingConfig = mockSettingsService.getSync().embedding;
    if (embeddingConfig.isConfigured) {
      void embedText(`${content} ${answer}`, embeddingConfig)
        .then((vector) => {
          questionService.patchQuestion(question.id, { embeddingVector: vector });
          // Re-rank relatedQuestionIds with the richer content+answer vector.
          const allQ = questionService.getAll();
          const cosineIds = allQ
            .filter((q) => q.id !== question.id && q.embeddingVector && q.embeddingVector.length > 0)
            .map((q) => ({ id: q.id, score: cosine(vector, q.embeddingVector!) }))
            .filter((x) => x.score > 0.5)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((x) => x.id);
          if (cosineIds.length > 0) {
            const current = questionService.getAll().find((q) => q.id === question.id);
            const merged = Array.from(new Set([...(current?.relatedQuestionIds ?? []), ...cosineIds]));
            questionService.patchQuestion(question.id, { relatedQuestionIds: merged });
          }
        })
        .catch((err: unknown) => {
          console.warn('[EchoLearn] embedding failed for question %s — semantic features will fall back to keywords:', question.id, err instanceof Error ? err.message : err);
        });
    }

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
    deleteFromSQLite(id);
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
      persistToSQLite(store[idx]);
    }
  },

  updateRelatedIds(questionId: string, relatedQuestionIds: string[]): void {
    const store = loadStore();
    const idx = store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], relatedQuestionIds };
      saveStore(store);
      persistToSQLite(store[idx]);
    }
  },

  /** Merge arbitrary fields onto an existing question (used by graph service for parentId, etc.). */
  patchQuestion(questionId: string, patch: Partial<Question>): void {
    const store = loadStore();
    const idx = store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], ...patch };
      saveStore(store);
      persistToSQLite(store[idx]);
    }
  },
};
