import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateFrozenPoolBundle } from '../schema/validate.ts';

const RUNTIME_FILES = ['topics.json', 'posts.json', 'concepts.json', 'claims.json', 'suggested_questions.json', 'source_assets.json'] as const;
const TOP_LEVEL = new Set([...RUNTIME_FILES, 'manifest.json', 'post_concept_edges.json', 'post_claim_edges.json', 'source_files', 'review_logs']);
const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export async function verifyFrozenPool(root: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) if (!TOP_LEVEL.has(entry.name)) errors.push(`unexpected artifact ${entry.name}`);
    for (const name of TOP_LEVEL) if (!entries.some((entry) => entry.name === name)) errors.push(`missing artifact ${name}`);
    for (const entry of entries) if ((await lstat(join(root, entry.name))).isSymbolicLink()) errors.push(`symbolic link forbidden: ${entry.name}`);
    if (errors.length) return { valid: false, errors };
    const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
    const texts = Object.fromEntries(await Promise.all(RUNTIME_FILES.map(async (filename) => [filename, await readFile(join(root, filename), 'utf8')])));
    for (const filename of RUNTIME_FILES) if (sha256(texts[filename]) !== manifest.artifactHashes?.[filename]) errors.push(`checksum/hash mismatch for ${filename}`);
    const bundle = {
      manifest, topics: JSON.parse(texts['topics.json']), posts: JSON.parse(texts['posts.json']), concepts: JSON.parse(texts['concepts.json']),
      claims: JSON.parse(texts['claims.json']), suggestedQuestions: JSON.parse(texts['suggested_questions.json']), sourceAssets: JSON.parse(texts['source_assets.json']),
    };
    const validation = validateFrozenPoolBundle(bundle, manifest.artifactHashes);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${error.path} ${error.message}`));
    const sourceNames = (await readdir(join(root, 'source_files'))).sort();
    const expectedNames = bundle.sourceAssets.map((asset: any) => `${asset.postId}.txt`).sort();
    if (JSON.stringify(sourceNames) !== JSON.stringify(expectedNames)) errors.push('source file ownership mismatch');
    for (const asset of bundle.sourceAssets) {
      const text = await readFile(join(root, 'source_files', `${asset.postId}.txt`), 'utf8');
      if (sha256(text) !== asset.sha256 || text !== (asset.body ?? asset.digest)) errors.push(`source asset checksum mismatch for ${asset.postId}`);
    }
    const conceptEdges = JSON.parse(await readFile(join(root, 'post_concept_edges.json'), 'utf8'));
    const claimEdges = JSON.parse(await readFile(join(root, 'post_claim_edges.json'), 'utf8'));
    const expectedConceptEdges = bundle.posts.flatMap((post: any) => post.conceptIds.map((conceptId: string) => ({ postId: post.id, conceptId })));
    const expectedClaimEdges = bundle.posts.flatMap((post: any) => post.claimIds.map((claimId: string) => ({ postId: post.id, claimId })));
    if (JSON.stringify(conceptEdges) !== JSON.stringify(expectedConceptEdges)) errors.push('post-concept edges do not match posts');
    if (JSON.stringify(claimEdges) !== JSON.stringify(expectedClaimEdges)) errors.push('post-claim edges do not match posts');
    if ((await readdir(join(root, 'review_logs'))).some((name) => name !== 'approval-audit.json')) errors.push('unexpected review log artifact');
    const actualFiles: string[] = [];
    async function walk(relativeRoot = ''): Promise<void> {
      for (const entry of await readdir(join(root, relativeRoot), { withFileTypes: true })) {
        const rel = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(rel); else if (rel !== 'manifest.json') actualFiles.push(rel);
      }
    }
    await walk(); actualFiles.sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.fixedFilenames)) errors.push('manifest fixed filenames do not match artifact');
    if (JSON.stringify(Object.keys(manifest.bundleFileHashes ?? {}).sort()) !== JSON.stringify(actualFiles)) errors.push('manifest bundle hashes do not cover every immutable file');
    for (const filename of actualFiles) if (sha256(await readFile(join(root, ...filename.split('/')))) !== manifest.bundleFileHashes?.[filename]) errors.push(`bundle checksum mismatch for ${filename}`);
  } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  return { valid: errors.length === 0, errors };
}
