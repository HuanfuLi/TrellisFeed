/**
 * Participant-runtime projection for an immutable frozen content pool.
 *
 * Keep this inventory distinct from fixedFilenames/bundleFileHashes: the latter
 * covers every immutable operator/audit file, while these are the exact files
 * consumed by the app at runtime.
 */
export const RUNTIME_ARTIFACT_FILENAMES = [
  'topics.json',
  'posts.json',
  'concepts.json',
  'claims.json',
  'suggested_questions.json',
  'source_assets.json',
  'sources.json',
  'global_edges.json',
  'ranking_features.json',
] as const;

export type RuntimeArtifactFilename = typeof RUNTIME_ARTIFACT_FILENAMES[number];
