import { createRequire } from 'node:module';
import type { ErrorObject, ValidateFunction } from 'ajv';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const addFormats = require('ajv-formats').default;
const schemaNames = ['topic', 'post', 'concept', 'claim', 'suggested-question', 'user-question', 'ai-answer', 'recommendation', 'user-concept-state', 'frozen-pool'] as const;
type SchemaName = typeof schemaNames[number];
type ValidationError = { path: string; message: string };
type Bundle = Record<string, any>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const name of schemaNames) ajv.addSchema(require(`../../schemas/${name}.schema.json`));

const validators = new Map<SchemaName, ValidateFunction>(schemaNames.map((name) => [name, ajv.getSchema(`${name}.schema.json`)!]));
const formatAjvErrors = (errors: ErrorObject[] | null | undefined): ValidationError[] => (errors ?? []).map((error) => ({
  path: `${error.instancePath || '/'}${error.keyword === 'required' ? `/${String(error.params.missingProperty)}` : ''}`,
  message: error.message ?? error.keyword,
}));

export function validateDomainRecord(name: Exclude<SchemaName, 'frozen-pool'>, value: unknown) {
  const validate = validators.get(name)!;
  const valid = validate(value);
  return { valid, errors: valid ? [] : formatAjvErrors(validate.errors) };
}

const add = (errors: ValidationError[], path: string, message: string) => errors.push({ path, message });
const indexById = (records: any[]) => new Map(records.map((record) => [record.id, record]));

export function assertFrozenPoolReferences(bundle: Bundle): ValidationError[] {
  const errors: ValidationError[] = [];
  const topics = indexById(bundle.topics);
  const posts = indexById(bundle.posts);
  const concepts = indexById(bundle.concepts);
  const claims = indexById(bundle.claims);
  const suggestions = indexById(bundle.suggestedQuestions);

  for (const [collectionName, collection] of Object.entries({ topics: bundle.topics, posts: bundle.posts, concepts: bundle.concepts, claims: bundle.claims, suggestedQuestions: bundle.suggestedQuestions })) {
    if (new Set((collection as any[]).map((record) => record.id)).size !== (collection as any[]).length) add(errors, `/${collectionName}`, 'duplicate id');
  }
  bundle.topics.forEach((topic: any, i: number) => topic.coreConceptIds.forEach((id: string) => {
    if (!concepts.has(id) || concepts.get(id).topicId !== topic.id) add(errors, `/topics/${i}/coreConceptIds`, `unowned concept ${id}`);
  }));
  bundle.concepts.forEach((concept: any, i: number) => {
    if (!topics.has(concept.topicId)) add(errors, `/concepts/${i}/topicId`, `dangling topic ${concept.topicId}`);
    for (const field of ['parentConceptIds', 'prerequisiteConceptIds']) for (const id of concept[field] ?? []) if (!concepts.has(id)) add(errors, `/concepts/${i}/${field}`, `dangling concept ${id}`);
  });
  bundle.claims.forEach((claim: any, i: number) => {
    if (!topics.has(claim.topicId)) add(errors, `/claims/${i}/topicId`, `dangling topic ${claim.topicId}`);
    claim.conceptIds.forEach((id: string) => { if (!concepts.has(id) || concepts.get(id).topicId !== claim.topicId) add(errors, `/claims/${i}/conceptIds`, `unowned concept ${id}`); });
  });
  bundle.posts.forEach((post: any, i: number) => {
    if (!topics.has(post.topicId)) add(errors, `/posts/${i}/topicId`, `dangling topic ${post.topicId}`);
    if (post.status !== 'frozen') add(errors, `/posts/${i}/status`, 'frozen bundle requires frozen status');
    for (const [field, index] of [['conceptIds', concepts], ['claimIds', claims], ['suggestedQuestionIds', suggestions]] as const) {
      post[field].forEach((id: string) => { const target = index.get(id); if (!target || target.topicId !== post.topicId) add(errors, `/posts/${i}/${field}`, `dangling or cross-topic target ${id}`); });
    }
  });
  bundle.suggestedQuestions.forEach((question: any, i: number) => {
    const post = posts.get(question.postId);
    if (!post || post.topicId !== question.topicId) add(errors, `/suggestedQuestions/${i}/postId`, `dangling or cross-topic post ${question.postId}`);
    question.targetConceptIds.forEach((id: string) => { if (!concepts.has(id) || concepts.get(id).topicId !== question.topicId) add(errors, `/suggestedQuestions/${i}/targetConceptIds`, `unowned concept ${id}`); });
    for (const id of question.targetClaimIds ?? []) if (!claims.has(id) || claims.get(id).topicId !== question.topicId) add(errors, `/suggestedQuestions/${i}/targetClaimIds`, `unowned claim ${id}`);
  });
  const order = bundle.manifest.feedOrderPostIds;
  if (new Set(order).size !== order.length) add(errors, '/manifest/feedOrderPostIds', 'duplicate post id');
  if (order.length !== posts.size || order.some((id: string) => !posts.has(id))) add(errors, '/manifest/feedOrderPostIds', 'must contain every post exactly once');
  for (const [key, collection] of Object.entries({ topics: bundle.topics, posts: bundle.posts, concepts: bundle.concepts, claims: bundle.claims, suggestedQuestions: bundle.suggestedQuestions, sourceAssets: bundle.sourceAssets })) {
    if (bundle.manifest.counts[key] !== (collection as any[]).length) add(errors, `/manifest/counts/${key}`, 'count mismatch');
  }
  if (bundle.manifest.approvedCount !== bundle.posts.length) add(errors, '/manifest/approvedCount', 'must equal frozen post count');
  const assetPostIds = bundle.sourceAssets.map((asset: any) => asset.postId);
  if (new Set(assetPostIds).size !== assetPostIds.length) add(errors, '/sourceAssets', 'duplicate postId');
  bundle.sourceAssets.forEach((asset: any, i: number) => { const post = posts.get(asset.postId); if (!post) add(errors, `/sourceAssets/${i}/postId`, `dangling post ${asset.postId}`); else if (asset.sourceUrl !== post.sourceUrl) add(errors, `/sourceAssets/${i}/sourceUrl`, 'must match post sourceUrl'); });
  if (assetPostIds.length !== posts.size || [...posts.keys()].some((id) => !assetPostIds.includes(id))) add(errors, '/sourceAssets', 'requires exactly one asset per post');
  return errors;
}

export function validateFrozenPoolBundle(value: unknown, expectedArtifactHashes?: Record<string, string>) {
  const validate = validators.get('frozen-pool')!;
  if (!validate(value)) return { valid: false, errors: formatAjvErrors(validate.errors) };
  const errors = assertFrozenPoolReferences(value as Bundle);
  if (expectedArtifactHashes) for (const [filename, expected] of Object.entries(expectedArtifactHashes)) {
    if ((value as Bundle).manifest.artifactHashes[filename] !== expected) add(errors, `/manifest/artifactHashes/${filename}`, 'hash mismatch');
  }
  return { valid: errors.length === 0, errors };
}
