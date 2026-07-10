// QuestionTrace shell: graph detail routes are removed. PostDetail may still
// resolve and display the post's anchor label, but concept chips/pills must not
// navigate to /anchor/:id.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_DETAIL_PATH = resolve(__dirname, '../../src/screens/PostDetailScreen.tsx');
const source = readFileSync(POST_DETAIL_PATH, 'utf-8');

describe('PostDetailScreen concept label in QuestionTrace shell', () => {
  it('does not navigate to removed graph detail routes', () => {
    assert.doesNotMatch(source, /\/anchor\/|\/cluster\/|\/graph/);
  });

  it('keeps a static resolved anchor label for post context', () => {
    assert.match(source, /resolvedAnchorName/);
    assert.match(source, /\{resolvedAnchorName\}/);
  });
});
