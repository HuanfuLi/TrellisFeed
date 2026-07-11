import type { AIAnswer, UserQuestion } from '../domain/content.types.ts';
import { dbExecute, dbQuery, type Row } from './db.service.ts';

interface QaDatabase {
  execute(sql: string, values?: (string | number | null)[]): Promise<void>;
  query<T extends Row>(sql: string, values?: (string | number | null)[]): Promise<T[]>;
}

interface CanonicalRow extends Row {
  id: string;
  data: string;
}

export interface PostQaTurn {
  question: UserQuestion;
  answer: AIAnswer;
}

function parseQuestion(row: CanonicalRow): UserQuestion | null {
  try {
    const value = JSON.parse(row.data) as UserQuestion;
    return value?.id === row.id && typeof value.userId === 'string' && typeof value.postId === 'string'
      && typeof value.createdAt === 'string' && typeof value.text === 'string' ? value : null;
  } catch {
    return null;
  }
}

function parseAnswer(row: CanonicalRow): AIAnswer | null {
  try {
    const value = JSON.parse(row.data) as AIAnswer;
    return value?.id === row.id && typeof value.userQuestionId === 'string' && typeof value.postId === 'string'
      && typeof value.createdAt === 'string' && typeof value.answerText === 'string' ? value : null;
  } catch {
    return null;
  }
}

export class PostQaRepository {
  private readonly database: QaDatabase;
  private hydrated = false;

  constructor(database: QaDatabase = { execute: dbExecute, query: dbQuery }) {
    this.database = database;
  }

  async hydratePostQa(): Promise<void> {
    // Exercise both canonical stores before participant rendering. Records stay
    // in the DB; threads are queried afresh so UI memory is never authoritative.
    await Promise.all([
      this.database.query<CanonicalRow>('SELECT * FROM user_questions'),
      this.database.query<CanonicalRow>('SELECT * FROM ai_answers'),
    ]);
    this.hydrated = true;
  }

  async persistCompletedAnswer(question: UserQuestion, answer: AIAnswer): Promise<void> {
    if (question.aiAnswerId !== answer.id || answer.userQuestionId !== question.id || answer.postId !== question.postId) {
      throw new Error('Canonical Q&A linkage is invalid');
    }
    await this.database.execute(
      'INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
      [question.id, question.userId, question.postId, question.createdAt, JSON.stringify(question)],
    );
    await this.database.execute(
      'INSERT OR REPLACE INTO ai_answers (id, user_question_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
      [answer.id, answer.userQuestionId, answer.postId, answer.createdAt, JSON.stringify(answer)],
    );
  }

  async loadSamePostThread(userId: string, postId: string): Promise<PostQaTurn[]> {
    if (!this.hydrated) await this.hydratePostQa();
    const [questionRows, answerRows] = await Promise.all([
      this.database.query<CanonicalRow>('SELECT * FROM user_questions WHERE user_id = ?', [userId]),
      this.database.query<CanonicalRow>('SELECT * FROM ai_answers WHERE post_id = ?', [postId]),
    ]);
    const answers = new Map<string, AIAnswer>();
    for (const row of answerRows) {
      const answer = parseAnswer(row);
      if (answer && answer.postId === postId) answers.set(answer.id, answer);
    }

    const turns: PostQaTurn[] = [];
    for (const row of questionRows) {
      const question = parseQuestion(row);
      if (!question || question.userId !== userId || question.postId !== postId || !question.aiAnswerId) continue;
      const answer = answers.get(question.aiAnswerId);
      if (!answer || answer.userQuestionId !== question.id || answer.postId !== question.postId) continue;
      turns.push({ question, answer });
    }
    return turns.sort((left, right) => left.question.createdAt.localeCompare(right.question.createdAt)
      || left.question.id.localeCompare(right.question.id));
  }
}

export const postQaRepository = new PostQaRepository();

export const hydratePostQa = (): Promise<void> => postQaRepository.hydratePostQa();
export const loadSamePostThread = (userId: string, postId: string): Promise<PostQaTurn[]> =>
  postQaRepository.loadSamePostThread(userId, postId);
export const persistCompletedAnswer = (question: UserQuestion, answer: AIAnswer): Promise<void> =>
  postQaRepository.persistCompletedAnswer(question, answer);
