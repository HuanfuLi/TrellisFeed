# Concerns

## Technical Debt
- **Hybrid Database Strategy**: Maintaining both SQLite and `localStorage` backends could lead to subtle data drift or inconsistencies if not synchronized carefully.
- **Service Mocking**: While mocking is extensive, it may mask real-world data issues or performance bottlenecks.

## Fragile Areas
- **CapacitorHttp Streaming**: Streaming AI completions through `CapacitorHttp` is not supported on Android; fallback to native `fetch` requires careful handling of WebView capabilities.
- **Theme Transitions**: Coordinating theme changes between the OS, React state, and CSS variables across different environments (web vs. native) can be error-prone.

## Known Limitations
- **SQLite Encoding**: Non-text data must be explicitly serialized before storage in the current `db.service.ts` implementation.
- **Web Quota**: `localStorage` fallbacks are subject to browser storage limits, which could impact user data persistence for large concept graphs.

## Security Considerations
- **API Keys**: Storing AI provider API keys in `Settings` requires secure local storage to prevent unauthorized access.
- **Cross-Origin Requests**: Bypassing CORS with `CapacitorHttp` is necessary for mobile but requires careful monitoring of target URL validity.

## Performance
- **Graph Rendering**: Rendering large concept graphs with `Mind Elixir` may experience performance degradation on lower-end mobile devices.
- **Concurrent API Calls**: Managing multiple simultaneous LLM, STT, and TTS requests requires robust orchestration to prevent UI blocking.
