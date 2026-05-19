import type { DailyPost, Question } from '../types/index.ts';
import { getAnchorIdForPost } from '../services/daily-read.service.ts';

type ConceptTargetQuestion = Pick<Question, 'id' | 'parentId' | 'isAnchorNode' | 'title' | 'content'>;

function normalizeConceptLabel(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function conceptLabels(question: ConceptTargetQuestion | undefined): Set<string> {
  const labels = new Set<string>();
  const title = normalizeConceptLabel(question?.title);
  const content = normalizeConceptLabel(question?.content);
  if (title) labels.add(title);
  if (content) labels.add(content);
  return labels;
}

export function postMatchesConcept(
  post: Pick<DailyPost, 'sourceQuestionIds' | 'sourceQuestionTitles' | 'sourceType'>,
  conceptId: string,
  questionsById: ReadonlyMap<string, ConceptTargetQuestion>,
): boolean {
  const anchorId = getAnchorIdForPost(post, questionsById);
  if (anchorId === conceptId) return true;
  if (post.sourceQuestionIds.includes(conceptId)) return true;

  const targetLabels = conceptLabels(questionsById.get(conceptId));
  if (targetLabels.size === 0) return false;

  return (post.sourceQuestionTitles ?? []).some((title) =>
    targetLabels.has(normalizeConceptLabel(title)),
  );
}

export function findPostForConcept<T extends Pick<DailyPost, 'sourceQuestionIds' | 'sourceQuestionTitles' | 'sourceType'>>(
  posts: readonly T[],
  conceptId: string,
  questionsById: ReadonlyMap<string, ConceptTargetQuestion>,
): T | null {
  return posts.find((post) => postMatchesConcept(post, conceptId, questionsById)) ?? null;
}
