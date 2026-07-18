function requireIdArray(record, key, fail, optional = false) {
  const value = record[key];
  if (optional && value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || id.length === 0)) {
    fail(`${record.id ?? 'record'} has invalid ${key}`);
  }
  return value;
}

function uniqueMap(records, label, fail, key = 'id') {
  const map = new Map();
  for (const record of records) {
    const id = record?.[key];
    if (typeof id !== 'string' || id.length === 0 || map.has(id)) fail(`${label} has duplicate or invalid ${key}`);
    map.set(id, record);
  }
  return map;
}

export function validatePackageReferences(manifest, collections, fail = (message) => { throw new Error(message); }) {
  const topics = uniqueMap(collections.topics, 'topics', fail);
  const posts = uniqueMap(collections.posts, 'posts', fail);
  const concepts = uniqueMap(collections.concepts, 'concepts', fail);
  const claims = uniqueMap(collections.claims, 'claims', fail);
  const suggestions = uniqueMap(collections.suggestedQuestions, 'suggestedQuestions', fail);
  const assets = uniqueMap(collections.sourceAssets, 'sourceAssets', fail, 'postId');

  for (const topic of collections.topics) {
    if (topic.contentPoolVersion !== manifest.contentPoolVersion
      || requireIdArray(topic, 'coreConceptIds', fail).some((id) => concepts.get(id)?.topicId !== topic.id)) {
      fail(`${topic.id} has invalid topic references`);
    }
  }
  for (const concept of collections.concepts) {
    const related = [
      ...requireIdArray(concept, 'parentConceptIds', fail, true),
      ...requireIdArray(concept, 'prerequisiteConceptIds', fail, true),
    ];
    if (!topics.has(concept.topicId) || related.some((id) => !concepts.has(id))) {
      fail(`${concept.id} has invalid concept references`);
    }
  }
  for (const claim of collections.claims) {
    if (!topics.has(claim.topicId)
      || requireIdArray(claim, 'conceptIds', fail).some((id) => concepts.get(id)?.topicId !== claim.topicId)) {
      fail(`${claim.id} has invalid claim references`);
    }
  }
  for (const post of collections.posts) {
    if (!topics.has(post.topicId) || post.status !== 'frozen'
      || requireIdArray(post, 'conceptIds', fail).some((id) => concepts.get(id)?.topicId !== post.topicId)
      || requireIdArray(post, 'claimIds', fail).some((id) => claims.get(id)?.topicId !== post.topicId)
      || requireIdArray(post, 'suggestedQuestionIds', fail).some((id) => suggestions.get(id)?.postId !== post.id)) {
      fail(`${post.id} has invalid post references`);
    }
  }
  for (const suggestion of collections.suggestedQuestions) {
    if (posts.get(suggestion.postId)?.topicId !== suggestion.topicId
      || requireIdArray(suggestion, 'targetConceptIds', fail).some((id) => concepts.get(id)?.topicId !== suggestion.topicId)
      || requireIdArray(suggestion, 'targetClaimIds', fail, true).some((id) => claims.get(id)?.topicId !== suggestion.topicId)) {
      fail(`${suggestion.id} has invalid suggestion references`);
    }
  }

  const order = manifest.feedOrderPostIds;
  if (!Array.isArray(order) || order.length !== posts.size || new Set(order).size !== posts.size
    || order.some((id) => !posts.has(id))
    || order.some((id, index) => collections.posts[index]?.id !== id)) {
    fail('feed order does not match unique posts');
  }
  if (assets.size !== posts.size || collections.sourceAssets.length !== posts.size
    || collections.sourceAssets.some((asset) => posts.get(asset.postId)?.sourceUrl !== asset.sourceUrl)) {
    fail('source assets must map one-to-one to posts with matching URLs');
  }
}
