# Integrations

## AI Providers
- **Anthropic (Claude)**: Chat completions and streaming via `claude-3-5-sonnet-20241022` or similar models.
- **Google Gemini**: Chat completions and streaming via `gemini-2.0-flash` or similar models.
- **OpenAI**: Chat completions and streaming (OpenAI API).
- **Local AI**: Support for local providers like [LM Studio](https://lmstudio.ai/) or custom local servers using the OpenAI-compatible endpoint format.

## Native & Device
- **SQLite (@capacitor-community/sqlite)**: Local storage for questions, edge weights, and review schedules on native platforms.
- **CapacitorHttp (@capacitor/core)**: Used to perform HTTP requests natively, bypassing CORS restrictions on mobile.
- **Capacitor Haptics (@capacitor/haptics)**: Provides haptic feedback for UI interactions.
- **Capacitor App (@capacitor/app)**: Provides app lifecycle events (isActive, backButton).

## Web & Browser
- **`localStorage`**: Fallback storage mechanism for web/browser environments (mimics SQLite interface).
- **Browser Fetch API**: Used for streaming and standard HTTP calls in web-friendly scenarios.
