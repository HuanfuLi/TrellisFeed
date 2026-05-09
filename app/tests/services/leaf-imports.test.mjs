// tests/services/leaf-imports.test.mjs (Phase 37 — TECHDEBT-01 invariant)
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const ALL_TS = walk(SRC);

// Files allowed to import locales/* or i18next directly:
//   - src/locales/index.ts (the i18next init site itself)
//   - src/locales/i18n.d.ts (type augmentation)
//   - src/lib/i18n-leaf.ts (the shim does NOT import either of these — verified
//     by negative assertion below; this entry exists so the shim is excluded
//     from ambient .d.ts imports of 'i18next' if any future change adds one)
//   - React components / screens / state hooks (D-08 — out of scope for Phase 37)
const ALLOWED_LOCALES_IMPORTERS = new Set([
  resolve(SRC, 'locales/index.ts'),
  resolve(SRC, 'locales/i18n.d.ts'),
  resolve(SRC, 'main.tsx'),
]);

const TARGET_DIRS = ['services', 'lib', 'providers'];

test('no service/lib/provider file imports from "../locales" (Phase 37 invariant)', () => {
  const offenders = [];
  for (const file of ALL_TS) {
    const rel = relative(SRC, file);
    const isInScope = TARGET_DIRS.some((d) => rel.startsWith(d + '/'));
    if (!isInScope) continue;
    const source = readFileSync(file, 'utf8');
    if (/from\s+['"]\.\.?\/(\.\.\/)?locales/.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These files still import from locales/* — must use ../lib/i18n-leaf instead:\n${offenders.join('\n')}`,
  );
});

test('no service/lib/provider file (except the leaf) imports i18next directly (Phase 37 invariant)', () => {
  const offenders = [];
  const LEAF = resolve(SRC, 'lib/i18n-leaf.ts');
  for (const file of ALL_TS) {
    if (file === LEAF) continue;
    const rel = relative(SRC, file);
    const isInScope = TARGET_DIRS.some((d) => rel.startsWith(d + '/'));
    if (!isInScope) continue;
    const source = readFileSync(file, 'utf8');
    if (/from\s+['"]i18next['"]/.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These files still import 'i18next' directly — must use ../lib/i18n-leaf:\n${offenders.join('\n')}`,
  );
});

test('i18n-leaf.ts itself does NOT import from locales or i18next', () => {
  const source = readFileSync(resolve(SRC, 'lib/i18n-leaf.ts'), 'utf8');
  assert.ok(
    !/from\s+['"]\.\.?\/(\.\.\/)?locales/.test(source),
    'i18n-leaf.ts must not import from ../locales (would re-introduce JSON chain)',
  );
  assert.ok(
    !/from\s+['"]i18next['"]/.test(source),
    'i18n-leaf.ts must not import "i18next" (would defeat the leaf-module purpose)',
  );
});

test('i18n-leaf.ts exports t, getCurrentLocale, bindI18nLeaf', async () => {
  const mod = await import('../../src/lib/i18n-leaf.ts');
  assert.equal(typeof mod.t, 'function');
  assert.equal(typeof mod.getCurrentLocale, 'function');
  assert.equal(typeof mod.bindI18nLeaf, 'function');
});
