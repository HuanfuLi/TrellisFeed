# Changelog: April 05, 2026

## Web Search Integration & Ask Screen (`phase-19`)

### Ask Screen Web Search
- **Tavily API Integration:** Added Tavily web search capabilities via `web-search.service.ts` allowing the application to pull real-time external data. Configured API Key fields in the Developer Settings safely persisting via `settings.mock.ts`.
- **Globe Search Toggle:** Implemented an intuitive "Globe" toggle within `ChatInput` to explicitly switch on web search for live context Q&As. 
- **Inline Citations & Sources:** Rewrote `askStreaming` to execute a two-pass tool-use pattern. Rendered responses now support inline web citations linking directly to a newly styled, collapsible "Sources" accordion beneath AI chat outputs.

### Feed & News
- **News Cards & Daily Fetch:** Engineered `news.service.ts` to perform background API fetching of top daily headlines and LLM-powered synthesization. 
- **Newspaper Presentation:** Introduced a stylized "Newspaper-style" card right into `InfoFlow` with deep-linking available on `PostDetailScreen`.

## Feed Redesign, Short Videos & Text-Art (`phase-18`)

### InfoFlow Architecture Engine & Styles
- **Presentation Styles Engine:** Extended core types introducing `PresentationStyle` (`image`, `text-art`, `short-video`, `text-only`). Implemented a weighted mathematical mix logic to reliably randomize the feed presentation ratios.
- **Card De-cluttering:** Substantially cleaned card faces by removing redundant badge rows, keyword tags, and refining the preview rendering widths. 
- **Background Fallbacks & Tracking:** Setup silent fallbacks ensuring that if image generation fails or is explicitly disabled via the new "Image Generation Toggle" configuration, posts adapt structurally.

### Text-Art & Short Video Media
- **Text-Art Notebooks:** Introduced deterministic color parsing generated dynamically out of a post's `id` hash natively styling large single-sentence hooks overlaid on notebook-style backgrounds.
- **Short-Video Portraits:** Leveraged YouTube Shorts natively rendering full-bleed portrait thumbnails directly inside feed flows accompanied by AI-based takeaway notes. Filtered horizontal aspect ratios aggressively.

## Polishing & Math Renders
- **LaTeX & KaTeX Support:** Merged comprehensive LaTeX mathematical equation support natively within core `Markdown` instances. Additionally included `rehype-sanitize` for sanitized safe DOMs avoiding escaping errors.
- **Graph Screen Overhaul:** Implemented a right-only tree model layout, recentered panning defaults, and deployed an "Expand All / Collapse All" button for deep Mindmap explorations.
- **Cache Hits & Data Validation:** Resolved feed regeneration bugs and enforced strict node limits ensuring deduplicated metadata references across the web app.
