/** Fixed, server-resolved study condition for a participant installation. */
export type StudyCondition = 'control' | 'experimental';

/**
 * Immutable identity bound by a researcher while installing the participant app.
 * `userId` is the neutral numeric study-account identifier shown to the participant.
 */
export interface ResearchIdentity {
  userId: string;
  condition: StudyCondition;
  topicId: string;
  boundAt: string;
}

/** The complete allowlist of behavioral interactions collected for the study. */
export type InteractionEventType =
  | 'app_open'
  | 'feed_impression'
  | 'post_open'
  | 'post_close'
  | 'source_click'
  | 'video_play'
  | 'video_progress'
  | 'question_suggestion_click'
  | 'question_submit'
  | 'ai_answer_view'
  | 'save_post'
  | 'not_interested'
  | 'recommendation_reason_view'
  | 'notification_received'
  | 'notification_open'
  | 'session_end';

/**
 * Privacy-bounded interaction record. Related identifiers and duration are the
 * only optional contextual fields; do not add free-form event data here.
 */
export interface UserInteractionEvent {
  id: string;
  userId: string;
  condition: StudyCondition;
  topicId: string;
  timestamp: string;
  eventType: InteractionEventType;
  postId?: string;
  questionId?: string;
  recommendationId?: string;
  durationMs?: number;
}

/**
 * Revisioned question/answer data, stored independently from behavioral events
 * so question text is not duplicated in a generic analytics event.
 */
export interface QuestionAnswerRecord {
  id: string;
  revision: number;
  userId: string;
  condition: StudyCondition;
  topicId: string;
  postId: string;
  questionId: string;
  questionText: string;
  questionSource: 'typed' | 'suggested_question';
  submittedAt: string;
  answerText?: string;
  answerViewedAt?: string;
}
