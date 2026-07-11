import assert from 'node:assert/strict';
import test from 'node:test';

const { PostQaService } = await import('../../src/services/post-qa.service.ts');

async function run(studyCondition) {
  const envelope = [];
  const rows = [];
  const service = new PostQaService({
    repository: {
      async loadSamePostThread() {
        return [{
          question: { id: 'prior-q', userId: 'user-1', condition: studyCondition, topicId: 'topic-1', postId: 'post-1', text: 'Prior?', source: 'typed', createdAt: '2026-07-10T00:00:00.000Z', extractedConceptIds: [], aiAnswerId: 'prior-a' },
          answer: { id: 'prior-a', userQuestionId: 'prior-q', postId: 'post-1', answerText: 'Prior answer.', citedPostIds: ['post-1'], conceptIds: [], createdAt: '2026-07-10T00:00:01.000Z', modelName: 'fake-main' },
        }];
      },
      async persistCompletedAnswer(question, answer) { rows.push({ question, answer }); },
    },
    evaluateQuestion: async () => ({ label: 'on-topic' }),
    feed: {
      getPostById: () => ({ id: 'post-1', topicId: 'topic-1', sourceUrl: 'https://example.test', displayTitle: 'Post', hook: 'Hook', shortSummary: 'Summary', conceptIds: ['c1'], claimIds: ['cl1'], status: 'frozen' }),
      getConcepts: () => [{ id: 'c1', topicId: 'topic-1', label: 'Concept', description: 'Description', aliases: [] }],
      getClaims: () => [{ id: 'cl1', topicId: 'topic-1', text: 'Claim', conceptIds: ['c1'] }],
      getOriginalContent: () => ({ postId: 'post-1', kind: 'article', sourceUrl: 'https://example.test', body: 'Approved evidence.', sha256: 'b'.repeat(64) }),
      getManifest: () => ({ contentPoolVersion: 'v1' }),
    },
    getConfig: () => ({ provider: 'claude', model: 'same-model', apiKey: 'ignored', isConfigured: true }),
    stream: async function* (messages, config, options) {
      envelope.push({ messages, config: { provider: config.provider, model: config.model }, options: { maxTokens: options.maxTokens, serviceName: options.serviceName } });
      yield 'Same fake answer.';
    },
    observe: async () => {},
    now: () => '2026-07-11T00:00:00.000Z',
    createId: (prefix) => `${prefix}-stable`,
  });
  const result = await service.askPostQuestion({
    userId: 'user-1', studyCondition, topicId: 'topic-1', postId: 'post-1', text: 'How is the claim supported?',
    source: 'suggested_question', suggestedQuestionId: 'suggestion-1',
  });
  return { envelope, result, rows };
}

test('control and experimental conditions have identical Ask behavior envelopes', async () => {
  const control = await run('control');
  const experimental = await run('experimental');
  assert.deepEqual(control.envelope, experimental.envelope);
  assert.deepEqual(control.result.data.selectedBlockIds, experimental.result.data.selectedBlockIds);
  assert.equal(control.result.data.answer.answerText, experimental.result.data.answer.answerText);

  const normalize = ({ question, answer }) => ({ question: { ...question, condition: '<recorded>' }, answer });
  assert.deepEqual(control.rows.map(normalize), experimental.rows.map(normalize));
  assert.equal(control.rows[0].question.condition, 'control');
  assert.equal(experimental.rows[0].question.condition, 'experimental');
});
