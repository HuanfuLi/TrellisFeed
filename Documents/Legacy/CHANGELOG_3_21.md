# Changelog 3/21

## Enhancements

### Home feed redesigned around discovery
- Replaced the old review-driven Home info flow with a low-pressure concept feed so Home feels like a curiosity surface instead of a test surface.
- Separated Home learning content from the dedicated Review workflow so spaced-repetition ratings and recall pressure stay inside Review.
- Added a richer concept-post model and feed generation pipeline that mixes recent questions, resurfaced knowledge, and related concepts from the user's graph.
- Updated Home cards to use a more social, swipe-friendly presentation with hook-first content instead of flashcard-like active recall prompts.

### AI-authored daily post feed
- Upgraded the concept feed from heuristic summaries to AI-authored daily posts generated from a broader daily knowledge bundle.
- Added feed teaser cards plus full post pages so users can browse quickly and then open into a deeper article-style reading experience.
- Expanded post content to support more substantial, essay-like explanations rather than visibly truncated summaries.
- Added narrative variation so generated posts can use examples, contrasts, mini stories, memory aids, and lighter voice where appropriate.
- Kept Podcast and Calendar as supporting loops instead of making them the primary Home experience.

### Post-based learning and contextual Q&A
- Added dedicated post detail pages for reading the full content behind each Home card.
- Added low-effort quick ask prompts on post pages so users can ask follow-up questions with less friction.
- Added inline post Q&A under the post page so the follow-up flow feels like a contextual comment thread rather than a separate blank chat.
- Preserved post-origin conversations in Ask history so users can return later and continue them with the original post context.
- Extended session metadata so Ask history can distinguish standard chats from post-origin threads.

### Data, generation, and validation improvements
- Added daily knowledge-context building so feed generation can consider recent questions, related older knowledge, and graph relationships together.
- Added local caching and deterministic fallback behavior so Home remains usable when AI generation is unavailable.
- Added validation for cached daily post data before rendering it in the UI.
- Added targeted tests around concept-feed generation, fallback behavior, daily knowledge context, and post-origin context construction.

## Fixes

### Home feed stability
- Fixed a Home navigation crash caused by concept cards trying to read badge properties from an unexpected or malformed `sourceType`.
- Hardened concept-card rendering with a safe fallback badge so invalid post metadata no longer breaks the Home screen.
- Added cache-shape validation so stale or malformed stored post objects are discarded instead of causing runtime errors.

### Mobile layout and post-page usability
- Reduced the size of the secondary post page and aligned its outer width more closely with the Home screen layout for mobile devices.
- Tightened post-page spacing and presentation so the full-post reading flow is better suited to a phone-first experience.

## Verification
- Verified targeted tests pass with `npm test`.
- Verified the app still builds successfully with `npm run build`.
