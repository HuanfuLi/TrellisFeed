import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { validatePackageReferences } from './content-pool-package-validation.mjs';

export const RUNTIME_CONTENT_POOL_FILES = Object.freeze([
  'manifest.json',
  'topics.json',
  'posts.json',
  'concepts.json',
  'claims.json',
  'suggested_questions.json',
  'source_assets.json',
  'sources.json',
  'global_edges.json',
  'ranking_features.json',
]);

const HASHED_RUNTIME_FILES = RUNTIME_CONTENT_POOL_FILES.slice(1);
const COLLECTION_NAMES = {
  'topics.json': 'topics',
  'posts.json': 'posts',
  'concepts.json': 'concepts',
  'claims.json': 'claims',
  'suggested_questions.json': 'suggestedQuestions',
  'source_assets.json': 'sourceAssets',
  'sources.json': 'sources',
  'global_edges.json': 'globalEdges',
  'ranking_features.json': 'rankingFeatures',
};

export function contentPoolPackageFail(message) {
  throw new Error(`CONTENT_POOL_PACKAGE_FAILED: ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function walk(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) contentPoolPackageFail(`${relative(root, path)} is a symbolic link`);
    return stat.isDirectory() ? walk(path) : [path];
  });
}

function relativeFiles(root) {
  return walk(root).map((path) => relative(root, path).replaceAll('\\', '/')).sort();
}

function equalLists(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasExactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && equalLists(Object.keys(value).sort(), [...expected].sort());
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function requireSafeInventoryFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 300
    || filename.includes('\\') || isAbsolute(filename)) {
    contentPoolPackageFail('manifest has an unsafe fixed filename');
  }
  const segments = filename.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    contentPoolPackageFail('manifest has an unsafe fixed filename');
  }
}

function readJson(root, filename) {
  try {
    return JSON.parse(readFileSync(join(root, filename), 'utf8'));
  } catch {
    contentPoolPackageFail(`${filename} is missing or invalid JSON`);
  }
}

export function resolveSelectedPoolRoot({ appRoot, poolRoot, dataRoot = resolve(appRoot, '../data') }) {
  if (typeof poolRoot !== 'string' || poolRoot.length === 0 || isAbsolute(poolRoot)) {
    contentPoolPackageFail('poolRoot must be a repository-relative path');
  }
  let canonicalDataRoot;
  let canonicalPoolRoot;
  try {
    canonicalDataRoot = realpathSync(dataRoot);
    canonicalPoolRoot = realpathSync(resolve(appRoot, poolRoot));
  } catch {
    contentPoolPackageFail('selected poolRoot does not exist');
  }
  if (canonicalPoolRoot === canonicalDataRoot || !isInside(canonicalDataRoot, canonicalPoolRoot)) {
    contentPoolPackageFail('selected poolRoot must stay inside repository data/');
  }
  if (!lstatSync(canonicalPoolRoot).isDirectory()) contentPoolPackageFail('selected poolRoot is not a directory');
  return canonicalPoolRoot;
}

function requireDisjointRoots(poolRoot, generatedRoot, publicRoot) {
  const source = resolve(poolRoot);
  const generated = resolve(generatedRoot);
  const publicAssets = resolve(publicRoot);
  if (generated === publicAssets
    || isInside(source, generated) || isInside(generated, source)
    || isInside(source, publicAssets) || isInside(publicAssets, source)) {
    contentPoolPackageFail('source and output roots must be distinct and disjoint');
  }
}

function validateManifestInventory(poolRoot, manifest) {
  if (typeof manifest.contentPoolVersion !== 'string' || manifest.contentPoolVersion.length === 0
    || manifest.contentPoolVersion.length > 64) {
    contentPoolPackageFail('manifest has an invalid contentPoolVersion');
  }
  if (!Array.isArray(manifest.fixedFilenames) || manifest.fixedFilenames.length === 0
    || new Set(manifest.fixedFilenames).size !== manifest.fixedFilenames.length
    || manifest.fixedFilenames.includes('manifest.json')) {
    contentPoolPackageFail('manifest has no fixed artifact inventory');
  }
  manifest.fixedFilenames.forEach(requireSafeInventoryFilename);
  if (!hasExactKeys(manifest.bundleFileHashes, manifest.fixedFilenames)) {
    contentPoolPackageFail('bundleFileHashes does not match the fixed artifact inventory');
  }
  if (!hasExactKeys(manifest.artifactHashes, HASHED_RUNTIME_FILES)) {
    contentPoolPackageFail('artifactHashes must contain exactly the nine runtime artifacts');
  }
  if (HASHED_RUNTIME_FILES.some((filename) => !manifest.fixedFilenames.includes(filename))) {
    contentPoolPackageFail('fixed artifact inventory omits a runtime artifact');
  }

  const expectedSourceFiles = ['manifest.json', ...manifest.fixedFilenames].sort();
  if (!equalLists(relativeFiles(poolRoot), expectedSourceFiles)) {
    contentPoolPackageFail('source directory has missing or extra files');
  }
  for (const filename of manifest.fixedFilenames) {
    const bytes = readFileSync(join(poolRoot, filename));
    if (sha256(bytes) !== manifest.bundleFileHashes[filename]) {
      contentPoolPackageFail(`${filename} failed immutable hash verification`);
    }
  }
}

function loadRuntimeCollections(poolRoot, manifest) {
  const collections = {};
  for (const filename of HASHED_RUNTIME_FILES) {
    const bytes = readFileSync(join(poolRoot, filename));
    if (sha256(bytes) !== manifest.artifactHashes[filename]) {
      contentPoolPackageFail(`${filename} failed runtime hash verification`);
    }
    try {
      collections[COLLECTION_NAMES[filename]] = JSON.parse(bytes.toString('utf8'));
    } catch {
      contentPoolPackageFail(`${filename} is invalid JSON`);
    }
  }

  for (const name of ['topics', 'posts', 'concepts', 'claims', 'suggestedQuestions', 'sourceAssets']) {
    const records = collections[name];
    if (!Array.isArray(records) || records.length !== manifest.counts?.[name]) {
      contentPoolPackageFail(`${name} count mismatch`);
    }
  }
  if (!Array.isArray(collections.sources) || !Array.isArray(collections.globalEdges)
    || !collections.rankingFeatures || typeof collections.rankingFeatures !== 'object'
    || !Array.isArray(collections.rankingFeatures.posts)) {
    contentPoolPackageFail('graph runtime artifacts have invalid collection shapes');
  }
  if (manifest.approvedCount !== collections.posts.length) contentPoolPackageFail('approved post count mismatch');
  validatePackageReferences(manifest, collections, contentPoolPackageFail);
  return collections;
}

function createIndexSource(poolRoot, manifest) {
  return `// Generated by scripts/package-content-pool.mjs. Do not edit.\n`
    + `// Immutable source version: ${manifest.contentPoolVersion}\n`
    + `export const PACKAGED_CONTENT_POOL_VERSION = ${JSON.stringify(manifest.contentPoolVersion)} as const;\n`
    + `export const packagedContentPoolFiles = {\n`
    + RUNTIME_CONTENT_POOL_FILES
      .map((filename) => `  '${filename}': ${JSON.stringify(readFileSync(join(poolRoot, filename), 'utf8'))},`)
      .join('\n')
    + `\n} as const;\n\n`
    + `export const packagedContentPoolReader = {\n`
    + `  expectedVersion: PACKAGED_CONTENT_POOL_VERSION,\n`
    + `  async readText(filename: keyof typeof packagedContentPoolFiles): Promise<string> {\n`
    + `    return packagedContentPoolFiles[filename];\n`
    + `  },\n`
    + `} as const;\n`;
}

function verifyOutput({ root, files, poolRoot, generatedRoot, indexSource }) {
  const actual = relativeFiles(root);
  if (!equalLists(actual, [...files].sort())) contentPoolPackageFail(`${root} is stale`);
  for (const filename of files) {
    const expected = filename === 'index.ts' && root === generatedRoot
      ? Buffer.from(indexSource)
      : readFileSync(join(poolRoot, filename));
    if (!readFileSync(join(root, filename)).equals(expected)) {
      contentPoolPackageFail(`${join(root, filename)} is stale`);
    }
  }
}

export function packageContentPool({ poolRoot, generatedRoot, publicRoot, checkOnly = false }) {
  if (![poolRoot, generatedRoot, publicRoot].every((value) => typeof value === 'string' && value.length > 0)) {
    contentPoolPackageFail('source and output roots are required');
  }
  requireDisjointRoots(poolRoot, generatedRoot, publicRoot);
  const manifest = readJson(poolRoot, 'manifest.json');
  validateManifestInventory(poolRoot, manifest);
  const collections = loadRuntimeCollections(poolRoot, manifest);
  const indexSource = createIndexSource(poolRoot, manifest);
  const generatedFiles = [...RUNTIME_CONTENT_POOL_FILES, 'index.ts'];

  if (checkOnly) {
    verifyOutput({ root: generatedRoot, files: generatedFiles, poolRoot, generatedRoot, indexSource });
    verifyOutput({ root: publicRoot, files: RUNTIME_CONTENT_POOL_FILES, poolRoot, generatedRoot, indexSource });
  } else {
    for (const root of [generatedRoot, publicRoot]) {
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root, { recursive: true });
    }
    for (const filename of RUNTIME_CONTENT_POOL_FILES) {
      const bytes = readFileSync(join(poolRoot, filename));
      writeFileSync(join(generatedRoot, filename), bytes);
      writeFileSync(join(publicRoot, filename), bytes);
    }
    writeFileSync(join(generatedRoot, 'index.ts'), indexSource);
  }

  return { contentPoolVersion: manifest.contentPoolVersion, postCount: collections.posts.length };
}
