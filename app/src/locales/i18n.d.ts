import 'i18next';
import en from './en.json';

/**
 * Module augmentation: types for t() keys are auto-derived from en.json's shape
 * via `typeof en`. Top-level namespaces present (non-exhaustive — see en.json
 * for the full list):
 *   - common, home, planner, ask, review, graph, settings, podcast
 *   - posts (incl. nested posts.detail.deepDive — Phase 43-01)
 *   - engagement (engagement.menu.*, engagement.toast.* — Phase 43-01)
 *   - saved (saved.title, saved.tabs.*, saved.empty.* — Phase 43-01;
 *     extended in Phase 50-02 with saved.tabs.collections +
 *     saved.empty.collectionsTitle/Body)
 *   - library (library.search.*, library.filters.{date,concept,source}.*,
 *     library.collections.* incl. notFound + ICU plural postCount_{one,other} +
 *     toast.*, library.savePicker.* — Phase 50-02 new top-level namespace;
 *     NOT the same as the nested review.library.* flashcard namespace)
 *   - onboarding, chatInput, chatMessage, conceptCard, flashcard, infoFlow, ...
 *
 * Adding a new key to en.json automatically propagates into the typed t() surface
 * — no manual addition needed here. Mismatched non-EN bundle keys are caught by
 * tests/locales/bundle-parity.test.mjs (CLAUDE.md i18n Workflow gate).
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
