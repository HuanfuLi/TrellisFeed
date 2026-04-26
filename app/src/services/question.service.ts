import type { Question, ServiceResult, AskResult, SessionMessage } from '../types/index.ts';
import { today } from '../lib/date.ts';
import { eventBus } from '../lib/event-bus.ts';
import { toast } from '../lib/toast.ts';
import i18n from '../locales/index.ts';
import { settingsService } from './settings.service.ts';
import { chatCompletion } from '../providers/llm/index.ts';
import { embedText, cosine } from '../providers/embedding/index.ts';
import { dbExecute, dbQuery } from './db.service.ts';
import {
  buildCanonicalQuestionPatch,
  classifyAndAnchorIncremental,
  decideIngestionOutcome,
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
 * On startup, if localStorage is EMPTY, restore the full question store from SQLite.
 *
 * ── Load-bearing invariant (do not regress) ─────────────────────────────────
 * localStorage is the PRIMARY source of truth. SQLite is a cold backup that
 * survives localStorage eviction (Safari 7-day purge, manual clear, WebView
 * reinstall).
 *
 * The previous "merge any missing rows" implementation resurrected deleted
 * nodes on cold restart: `deleteFromSQLite` is fire-and-forget, so if the
 * app is backgrounded/killed in the ~10-100ms between `saveStore(filtered)`
 * and the SQLite DELETE flushing, SQLite keeps the row. On the next launch,
 * the old logic saw "row in SQLite but not localStorage" and restored it —
 * flipping user deletes back. This was the "I did nothing and deleted nodes
 * came back" symptom (2026-04-21 report).
 *
 * The restore-if-empty rule is safe in both directions:
 *   - Fresh install / cleared storage → localStorage empty → full SQLite restore
 *   - Active session with some deletes → localStorage has rows → trust it,
 *     never merge from SQLite
 *
 * If a future feature needs finer-grained reconciliation (e.g. multi-device
 * sync), route it through a migration path that tracks tombstones explicitly
 * instead of inferring deletes from presence.
 */
export async function hydrateFromSQLite(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const existing = loadStore({ includeFlagged: true });
    // localStorage is primary — if it has ANY rows, trust it. Never merge from
    // SQLite on a populated store, or deletes get silently resurrected.
    if (existing.length > 0) return;

    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM questions');
    if (rows.length === 0) return;

    const toAdd: Question[] = [];
    for (const row of rows) {
      try { toAdd.push(JSON.parse(row.data) as Question); } catch { /* skip corrupt rows */ }
    }
    if (toAdd.length > 0) {
      saveStore(toAdd);
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

function loadStore(opts?: { includeFlagged?: boolean }): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const questions = JSON.parse(raw) as Question[];
    return opts?.includeFlagged ? questions : questions.filter((q) => !q.flagged);
  } catch {
    return [];
  }
}

function saveStore(questions: Question[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast(i18n.t('common.toast.storageFullQuestion'), 'error');
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
  async ask(content: string, sessionContext?: QuestionFilterContext, sessionHistory?: SessionMessage[], signal?: AbortSignal): Promise<ServiceResult<AskResult>> {
    const settings = settingsService.getSync();
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

    const store = loadStore({ includeFlagged: true });

    // Pre-compute query embedding before the LLM call so context candidates can be
    // re-ranked by cosine similarity instead of keyword overlap alone.
    const embCfgEarly = settingsService.getSync().embedding;
    let queryEmbedding: number[] | undefined;
    if (embCfgEarly.isConfigured) {
      try {
        queryEmbedding = await embedText(content, embCfgEarly);
      } catch (err) {
        console.warn('[Trellis] pre-call embedding failed — context ranking will use keywords only:', err instanceof Error ? err.message : err);
      }
    }

    const systemPrompt = [
      'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
      'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
      'Respond ONLY with JSON:',
      '{"answer":"...","summary":"one sentence","keywords":["kw1","kw2","kw3"],"storyHook":"An intriguing hook (<=15 words) to spark curiosity about this topic.","shortSummary":"A concise <=80 word summary of the core concept explained in the answer."}',
    ]
      .filter(Boolean)
      .join('\n');

    // Convert SessionMessage[] to ChatMessage[] for the LLM (append-only for KV-cache)
    const historyMessages: { role: 'user' | 'assistant'; content: string }[] =
      (sessionHistory ?? []).map((m) => ({
        role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content },
        ],
        llmConfig,
        { serviceName: 'ask' },
      );

      let answer: string;
      let summary: string;
      let keywords: string[];
      let storyHook: string | undefined;
      let shortSummary: string | undefined;

      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
          answer?: string;
          summary?: string;
          keywords?: string[];
          storyHook?: string;
          shortSummary?: string;
        };
        answer = parsed.answer ?? raw;
        summary = parsed.summary ?? extractSummary(answer);
        keywords = Array.isArray(parsed.keywords) ? parsed.keywords : extractKeywords(answer);
        storyHook = typeof parsed.storyHook === 'string' && parsed.storyHook ? parsed.storyHook : undefined;
        shortSummary = typeof parsed.shortSummary === 'string' && parsed.shortSummary ? parsed.shortSummary : undefined;
      } catch {
        answer = raw;
        summary = extractSummary(raw);
        keywords = extractKeywords(raw);
      }

      const question = this.buildAndSave(content, answer, store, { summary, keywords, storyHook, shortSummary, preComputedEmbedding: queryEmbedding });

      // Evaluate question for off-topic/meta status
      const flagged = await filterQuestion(question, sessionContext);

      // Persist the flagged status back to store and SQLite
      const freshStore = loadStore({ includeFlagged: true });
      const idx = freshStore.findIndex((q) => q.id === question.id);
      if (idx !== -1) {
        freshStore[idx] = flagged;
        saveStore(freshStore);
        persistToSQLite(flagged);
      }

      // ── Second classification call (Phase 14) ──────────────────────────────
      // Fire ONLY when Q&A enters the mindmap (not flagged).
      if (flagged.flagged !== true) {
        // Fire-and-forget: classification + anchor attachment runs asynchronously.
        // The Q&A is already saved; labels will be patched on once the call completes.
        void classifyAndAnchorIncremental(flagged, loadStore({ includeFlagged: true }), llmConfig, signal).catch((err: unknown) => {
          console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
        });
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
      shortSummary?: string;
      /** Pre-computed embedding for the query content (from ask() pre-call). When present,
       *  stored directly on the question — no async fire-and-forget needed for the initial save. */
      preComputedEmbedding?: number[];
    },
  ): Question {
    const store = existingQuestions ?? loadStore({ includeFlagged: true });
    const summary = meta?.summary ?? extractSummary(answer);
    const keywords = meta?.keywords ?? extractKeywords(answer);
    const decision = decideIngestionOutcome(content, store);

    if (decision.outcome === 'merge' && decision.targetNodeId) {
      const target = store.find((candidate) => candidate.id === decision.targetNodeId);
      if (target) {
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
        // Read-modify-write against fresh localStorage — never the caller's pre-LLM snapshot,
        // which may have been mutated (deletes, prunes, patches) during the streaming window.
        // Writing a stale snapshot would resurrect deleted rows and revert concurrent changes.
        const fresh = loadStore({ includeFlagged: true });
        const freshIdx = fresh.findIndex((candidate) => candidate.id === target.id);
        if (freshIdx !== -1) {
          fresh[freshIdx] = mergedQuestion;
          saveStore(fresh);
        }
        persistToSQLite(mergedQuestion);
        eventBus.emit({ type: 'QUESTION_ASKED', payload: mergedQuestion });

        const embCfg = settingsService.getSync().embedding;
        if (embCfg.isConfigured) {
          void embedText(`${mergedQuestion.content} ${mergedQuestion.answer}`, embCfg)
            .then((vector) => {
              // Guard: question may have been deleted while embedding was in flight
              const current = questionService.getAll({ includeFlagged: true }).find((q) => q.id === mergedQuestion.id);
              if (!current) return;

              questionService.patchQuestion(mergedQuestion.id, { embeddingVector: vector });
              // Update relatedQuestionIds with cosine-ranked candidates now that we have a vector.
              const allQ = questionService.getAll({ includeFlagged: true });
              const cosineIds = allQ
                .filter((q) => q.id !== mergedQuestion.id && q.embeddingVector && q.embeddingVector.length > 0)
                .map((q) => ({ id: q.id, score: cosine(vector, q.embeddingVector!) }))
                .filter((x) => x.score > 0.5)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((x) => x.id);
              if (cosineIds.length > 0) {
                const freshQ = questionService.getAll({ includeFlagged: true }).find((q) => q.id === mergedQuestion.id);
                if (!freshQ) return;
                const merged = Array.from(new Set([...(freshQ.relatedQuestionIds ?? []), ...cosineIds]));
                questionService.patchQuestion(mergedQuestion.id, { relatedQuestionIds: merged });
              }
            })
            .catch((err: unknown) => {
            console.warn('[Trellis] embedding failed for merged question %s — semantic features will fall back to keywords:', mergedQuestion.id, err instanceof Error ? err.message : err);
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
      ...(meta?.shortSummary ? { shortSummary: meta.shortSummary } : {}),
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
      nodeSummary: summary,
      ...(decision.outcome === 'refine' && decision.targetNodeId ? { parentId: decision.targetNodeId } : {}),
      // Store the content-only embedding now if available; a richer content+answer vector
      // will be persisted once the full text embedding completes below.
      ...(preVec ? { embeddingVector: preVec } : {}),
    };

    // Read-modify-write against fresh localStorage — never the caller's pre-LLM snapshot,
    // which may have been mutated (deletes, prunes, patches) during the streaming window.
    // Writing a stale snapshot would resurrect deleted rows and revert concurrent changes.
    saveStore([question, ...loadStore({ includeFlagged: true })]);
    persistToSQLite(question);
    eventBus.emit({ type: 'QUESTION_ASKED', payload: question });

    // Fire-and-forget: embed content+answer for a richer vector (replaces the content-only
    // pre-computed vector). Skipped entirely if embedding is not configured.
    const embeddingConfig = settingsService.getSync().embedding;
    if (embeddingConfig.isConfigured) {
      void embedText(`${content} ${answer}`, embeddingConfig)
        .then((vector) => {
          // Guard: question may have been deleted while embedding was in flight
          const current = questionService.getAll({ includeFlagged: true }).find((q) => q.id === question.id);
          if (!current) return;

          questionService.patchQuestion(question.id, { embeddingVector: vector });
          // Re-rank relatedQuestionIds with the richer content+answer vector.
          const allQ = questionService.getAll({ includeFlagged: true });
          const cosineIds = allQ
            .filter((q) => q.id !== question.id && q.embeddingVector && q.embeddingVector.length > 0)
            .map((q) => ({ id: q.id, score: cosine(vector, q.embeddingVector!) }))
            .filter((x) => x.score > 0.5)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((x) => x.id);
          if (cosineIds.length > 0) {
            const freshQ = questionService.getAll({ includeFlagged: true }).find((q) => q.id === question.id);
            if (!freshQ) return;
            const merged = Array.from(new Set([...(freshQ.relatedQuestionIds ?? []), ...cosineIds]));
            questionService.patchQuestion(question.id, { relatedQuestionIds: merged });
          }
        })
        .catch((err: unknown) => {
          console.warn('[Trellis] embedding failed for question %s — semantic features will fall back to keywords:', question.id, err instanceof Error ? err.message : err);
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

  /** Return questions due for review on or before the given date (SM-2 schedule). */
  async getDueForReview(date?: string): Promise<ServiceResult<Question[]>> {
    const d = date ?? today();
    return {
      success: true,
      data: loadStore().filter(
        (q) => q.reviewSchedule && q.reviewSchedule.nextReviewDate <= d,
      ),
    };
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
    saveStore(loadStore({ includeFlagged: true }).filter((q) => q.id !== id));
    deleteFromSQLite(id);
    eventBus.emit({ type: 'QUESTION_DELETED', payload: { id } });
    eventBus.emit({ type: 'GRAPH_UPDATED' });
    return { success: true };
  },

  getAll(opts?: { includeFlagged?: boolean }): Question[] {
    return loadStore(opts);
  },

  /**
   * Return pruned (archived) anchor nodes only.
   * Per D-16, pruning flips flagged=true on anchor Q&As; filtering requires BOTH
   * flagged AND isAnchorNode because regular Q&As flagged for off-topic reasons
   * should not appear in the pruned section.
   */
  getPrunedQuestions(): Question[] {
    return loadStore({ includeFlagged: true }).filter(
      (q) => q.flagged === true && q.prunedFromTrellis === true,
    );
  },

  updateReviewSchedule(questionId: string, schedule: Question['reviewSchedule']): void {
    const store = loadStore({ includeFlagged: true });
    const idx = store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], reviewSchedule: schedule };
      saveStore(store);
      persistToSQLite(store[idx]);
    }
  },

  updateRelatedIds(questionId: string, relatedQuestionIds: string[]): void {
    const store = loadStore({ includeFlagged: true });
    const idx = store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], relatedQuestionIds };
      saveStore(store);
      persistToSQLite(store[idx]);
    }
  },

  /** Merge arbitrary fields onto an existing question (used by graph service for parentId, etc.). */
  patchQuestion(questionId: string, patch: Partial<Question>): void {
    const store = loadStore({ includeFlagged: true });
    const idx = store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], ...patch };
      saveStore(store);
      persistToSQLite(store[idx]);
    }
  },
};
