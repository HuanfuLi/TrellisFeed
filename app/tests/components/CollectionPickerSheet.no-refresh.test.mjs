// Phase 50 gap closure 50-10 (G1+G3). Enforces the durable rule from
// feedback_no_refresh_assumption.md: any component reading from a service
// that may mutate while the component is on-screen MUST subscribe to the
// service's *_CHANGED event and re-read state. This test guards the
// pattern at the source level. Source-reading only — no DOM render.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const SRC_REL = 'src/components/CollectionPickerSheet.tsx';

function readSrc() {
  return readFileSync(path.join(appRoot, SRC_REL), 'utf8');
}

test('NR-01: source contains exactly one COLLECTIONS_CHANGED subscription', () => {
  const src = readSrc();
  const matches = src.match(/eventBus\.subscribe\(['"]COLLECTIONS_CHANGED['"]/g) || [];
  assert.strictEqual(
    matches.length,
    1,
    `Expected exactly 1 COLLECTIONS_CHANGED subscription, found ${matches.length}`,
  );
});

test('NR-02: COLLECTIONS_CHANGED handler re-reads collections via setCollections(collectionService.getCollections())', () => {
  const src = readSrc();
  assert.match(
    src,
    /setCollections\(collectionService\.getCollections\(\)\)/,
    'Handler must re-read collections list from service on COLLECTIONS_CHANGED',
  );
});

test('NR-03: COLLECTIONS_CHANGED handler re-syncs originalMemberIds via setOriginalMemberIds', () => {
  const src = readSrc();
  assert.match(
    src,
    /setOriginalMemberIds\(new Set\(collectionService\.getPostCollections\(postId\)\.map\(c => c\.id\)\)\)/,
    'Handler must re-snapshot membership baseline on COLLECTIONS_CHANGED',
  );
});

test('NR-04: COLLECTIONS_CHANGED useEffect returns unsub function for cleanup', () => {
  const src = readSrc();
  // The effect must return the unsub function so the subscription is cleaned
  // up on unmount or postId change.
  assert.match(
    src,
    /return unsub/,
    'COLLECTIONS_CHANGED useEffect must return the unsub function for cleanup',
  );
});

test('NR-05: source does NOT contain the old static useMemo(() => collectionService.getCollections() initializer', () => {
  const src = readSrc();
  assert.doesNotMatch(
    src,
    /useMemo\(\(\) => collectionService\.getCollections\(\)/,
    'G1 regression: must not use useMemo for collections list — use useState + event subscription',
  );
});

test('NR-06: source comment cites feedback_no_refresh_assumption.md', () => {
  const src = readSrc();
  assert.match(
    src,
    /feedback_no_refresh_assumption\.md/,
    'Source must cite the durable no-refresh rule file so the load-bearing reason is discoverable',
  );
});

test('NR-07: G3 default — actualSavedAtOpen exists and originalSaved no longer calls engagementService.isSaved directly', () => {
  const src = readSrc();
  assert.match(
    src,
    /actualSavedAtOpen/,
    'Must have actualSavedAtOpen capturing the real isSaved baseline',
  );
  // originalSaved must be the new shape (postId ? true : false), not the old isSaved call
  assert.match(
    src,
    /const\s+originalSaved\s*=\s*postId\s*\?\s*true\s*:\s*false/,
    'originalSaved must be "postId ? true : false" (G3 default-checked on open)',
  );
  // Must NOT have originalSaved = ... engagementService.isSaved
  assert.doesNotMatch(
    src,
    /const\s+originalSaved\s*=\s*.*engagementService\.isSaved/,
    'originalSaved must not read isSaved directly — that is actualSavedAtOpen now',
  );
});

test('NR-08: G3 commit — handleDone diff uses actualSavedAtOpen, not originalSaved', () => {
  const src = readSrc();
  assert.match(
    src,
    /draftSavedChecked !== actualSavedAtOpen/,
    'handleDone must diff against actualSavedAtOpen (the real baseline)',
  );
  assert.doesNotMatch(
    src,
    /draftSavedChecked !== originalSaved/,
    'handleDone must NOT diff against originalSaved (which is always true for pre-check)',
  );
});

test('NR-09: postId-reseed useEffect deps are [postId] only — no Set state in deps causes infinite loop', () => {
  const src = readSrc();
  // Locate the reseed effect by its body — it calls setOriginalMemberIds AND setDraftMemberIds.
  // The dep array must be exactly [postId]. Including originalMemberIds (a Set) in deps
  // re-fires the effect every render because every new Set() is a fresh reference, causing
  // "Maximum update depth exceeded" and breaking device deployment.
  const effectMatch = src.match(
    /useEffect\(\(\) => \{[\s\S]*?setOriginalMemberIds\([\s\S]*?\}, \[([^\]]*)\]\);/,
  );
  assert.ok(effectMatch, 'Could not locate the postId-reseed useEffect — has it been renamed?');
  const deps = effectMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.deepStrictEqual(
    deps,
    ['postId'],
    `Reseed effect deps must be exactly [postId]. Found [${deps.join(', ')}]. ` +
      'Including originalMemberIds or draftMemberIds in deps creates an infinite loop ' +
      'because each new Set() is a fresh reference.',
  );
});
