// src/lib/i18n-leaf.ts (Phase 37 — TECHDEBT-01)
//
// Injectable indirection over the i18next singleton. This module has ZERO
// transitive dependencies on src/locales/*.json, so consumers (services,
// lib helpers, providers) can be imported under `node --test` on Node 25
// without triggering ERR_IMPORT_ATTRIBUTE_MISSING on the static JSON imports
// in src/locales/index.ts.
//
// PRODUCTION: src/main.tsx calls bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)
// once after the locales/index module is imported, so all consumers go through
// the real i18next instance. Behavior is byte-stable vs. the pre-Phase-37 direct
// i18next reads.
//
// TESTS: identity defaults (`t(key) => key`, `getCurrentLocale() => 'en'`)
// require zero setup. Tests that need real translations call bindI18nLeaf
// themselves with a stub i18next instance. NEVER import the locales/index
// module in test code — that re-introduces the JSON-import chain Phase 37
// unwinds.
//
// CONSUMERS: do NOT call t() or getCurrentLocale() at module top level. Bind
// happens after locale init in main.tsx; top-level calls would resolve against
// identity defaults at module-load time, not the bound instance.
//
// See CLAUDE.md "Best practices learned in Phase 32.1" rule 8 (document load-bearing
// constraints in three places: project CLAUDE.md, auto-memory, and the load-bearing
// code site).

type TFn = (key: string, opts?: Record<string, unknown>) => string;
type LocaleGetter = () => string;

let _t: TFn = (key) => key;
let _getLocale: LocaleGetter = () => 'en';

/**
 * Bind the leaf shim to a live i18next-like instance.
 *
 * Call once at app boot from main.tsx AFTER the locales/index module has
 * evaluated. Idempotent (later calls overwrite earlier bindings — useful
 * for test reset patterns).
 */
export function bindI18nLeaf(tFn: TFn, getLocale: LocaleGetter): void {
  _t = tFn;
  _getLocale = getLocale;
}

/**
 * Translate a key. In production, delegates to i18next.t. In tests with no
 * binding, returns the key unchanged (identity default — assertions check
 * call shape, not translated text).
 */
export function t(key: string, opts?: Record<string, unknown>): string {
  return _t(key, opts);
}

/**
 * Read the current locale code (e.g., 'en', 'zh', 'es', 'ja'). In production,
 * reads `i18next.language` live at each call. In tests with no binding,
 * returns 'en'.
 */
export function getCurrentLocale(): string {
  return _getLocale();
}
