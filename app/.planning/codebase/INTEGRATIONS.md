# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**Language Models (LLM):**
- Claude (Anthropic) - Chat completions via `https://api.anthropic.com/v1/messages`
  - SDK/Client: Custom fetch-based client in `src/providers/llm/index.ts`
  - Auth: API key (env var or localStorage: `settings.llm.apiKey`)
  - Supports: Streaming via SSE, non-streaming completions, configurable max tokens
  - Used for: Chat sessions, knowledge extraction, podcast generation, LLM auto-suggestions

- OpenAI - Chat completions, embeddings, TTS, and STT
  - SDK/Client: Custom fetch-based client in `src/providers/llm/index.ts` (completions), `src/providers/stt/index.ts` (Whisper), `src/providers/tts/index.ts` (TTS)
  - Auth: API key (env var or localStorage: `settings.llm.apiKey`, `settings.tts.apiKey`)
  - Models: Configurable (default `gpt-4o` for completions, `tts-1` for TTS, `whisper-1` for STT)
  - Supports: Streaming completions, embeddings with dimensions, TTS voice/speed selection, Whisper transcription
  - Used for: Chat completions, embeddings for knowledge search, text-to-speech for podcasts, speech-to-text for voice input

- Google Gemini - Chat completions and embeddings
  - SDK/Client: Custom fetch-based client in `src/providers/llm/index.ts` (completions), `src/providers/embedding/index.ts` (embeddings)
  - Auth: API key (env var or localStorage: `settings.llm.apiKey`, `settings.embedding.apiKey`, `settings.imageGeneration.geminiApiKey`)
  - Base URL: `https://generativelanguage.googleapis.com/v1beta`
  - Supports: Streaming via SSE, system instruction, configurable max output tokens
  - Used for: Chat completions, embeddings for semantic search, image generation

- Local/Self-Hosted Models - OpenAI-compatible API format
  - SDK/Client: Custom fetch-based client (same as OpenAI) with optional base URL override
  - Providers: LM Studio (http://localhost:1234), Ollama, other OpenAI-compatible services
  - Auth: Optional API key (may be empty for local)
  - Used for: Chat completions when offline or using local models

**Text-to-Speech (TTS):**
- OpenAI TTS API
  - Endpoint: `https://api.openai.com/v1/audio/speech`
  - SDK/Client: `synthesize()` in `src/providers/tts/index.ts`
  - Auth: Bearer token (OpenAI API key from `settings.tts.apiKey`)
  - Model: tts-1 (hardcoded)
  - Voice options: Configurable (e.g., 'alloy')
  - Used for: Generating audio blobs for daily podcasts
  - Returns: Audio blob as object URL via `URL.createObjectURL()`

**Speech-to-Text (STT):**
- OpenAI Whisper API
  - Endpoint: `https://api.openai.com/v1/audio/transcriptions`
  - SDK/Client: `transcribeAudio()` in `src/providers/stt/index.ts`
  - Auth: Bearer token (OpenAI API key, shares `settings.tts.apiKey` credentials)
  - Model: whisper-1 (hardcoded)
  - Supported formats: m4a, ogg, wav, mp3, webm (auto-detected and normalized)
  - Used for: Voice input on Ask screen via long-press gesture
  - Returns: Transcribed text as JSON

**Image Generation:**
- NanoBanana (Primary provider)
  - SDK/Client: Provider interface in `src/providers/`
  - Auth: API key from `settings.imageGeneration.nanoBananaApiKey`
  - Used for: Generating images for concept posts
  - Fallback: Gemini if NanoBanana fails

- Google Gemini (Fallback provider)
  - Model: `gemini-3.1-flash-image-preview` (configurable)
  - SDK/Client: Provider interface in `src/providers/`
  - Auth: API key from `settings.imageGeneration.geminiApiKey`
  - Used for: Image generation when NanoBanana fails
  - Service: `src/services/imageGeneration.service.ts`

## Data Storage

**Databases:**
- SQLite (via Capacitor Community SQLite)
  - Connection: Native iOS/Android platform via Capacitor
  - Tables:
    - `questions` - Knowledge base (id, data JSON)
    - `edge_weights` - Graph relationships (edge_key, weight)
    - `planner_chunks` - Learning action cards (id, data JSON)
    - `planner_threads` - Planner organization (id, data JSON)
    - `planner_checkins` - Check-in history (id, data JSON)
  - Fallback: localStorage on web browser (5-10 MB quota)
  - Service: `src/services/db.service.ts`

**File Storage:**
- localStorage (browser API)
  - Storage keys:
    - `echolearn_settings` - User settings and API key configuration
    - `echolearn_sessions` - Chat session history
    - `echolearn_active_session` - Currently active chat session ID
    - `echolearn_flashcards` - Flashcard library
    - `echolearn_podcasts` - Podcast metadata (not audio)
    - `img-cache-meta` - Image cache metadata
  - Quota: ~5 MB on iOS Safari, ~10 MB on most browsers
  - Used for: Settings, sessions, flashcards, podcast metadata

- IndexedDB (browser API)
  - Databases:
    - `echolearn_audio` (store: `blobs`) - Audio blob data for podcasts
    - `echolearn_images` (store: `images`) - Generated image base64 data
  - Quota: Hundreds of MB to several GB depending on browser
  - Used for: Large binary data (audio and images) that exceed localStorage limits

**Caching:**
- In-Memory Maps - Audio blob URL cache
  - `audioBlobUrls` Map in `src/services/podcast.service.ts`
  - Stores object URLs for current session playback
- Image Cache - IndexedDB + LRU eviction
  - Metadata in localStorage (TTL, size, provider)
  - Binary data in IndexedDB
  - Max size: Configurable via `settings.imageGeneration.maxCacheSizeMb` (default 50 MB)
  - TTL: Configurable via `settings.imageGeneration.cacheTtlDays` (default 30 days)
  - Service: `src/services/imageGeneration.service.ts`

## Authentication & Identity

**Auth Provider:**
- None - Custom/Anonymous
  - Implementation: Settings-based API key management (no user auth system)
  - Users configure their own API keys for LLM, embedding, TTS, image generation, Gemini
  - No server-side authentication or user accounts
  - All data stored locally (localStorage/IndexedDB/SQLite)

## Monitoring & Observability

**Error Tracking:**
- None configured - Application-level error handling only
- Errors logged to browser console via `console.error()`

**Logs:**
- Browser Console - Development/debugging only
  - Debug tags: `[VoiceAsk]`, `[STT]`, `[NativeScheduler]`, etc.
- No persistent logging service
- No analytics or telemetry

## CI/CD & Deployment

**Hosting:**
- Web: Static site (Vite SPA output in `dist/` directory)
  - Base path: `./` (relative URLs for offline capability)
  - Deployable to any static hosting (GitHub Pages, Vercel, Netlify, etc.)

- Native: Capacitor builds (iOS/Android)
  - iOS: Xcode project in `ios/` directory
  - Android: Android Studio project in `android/` directory
  - Managed via Capacitor CLI (`@capacitor/cli` 8.1.0)

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other automated pipeline configured
- Manual build via: `npm run build`
- Manual lint via: `npm run lint`

## Environment Configuration

**Required env vars (Runtime - from localStorage settings):**
- `settings.llm.apiKey` - LLM API key (Claude, OpenAI, Gemini, or local)
- `settings.llm.provider` - LLM provider ('claude', 'openai', 'gemini', 'local', 'lmstudio')
- `settings.llm.model` - LLM model name (e.g., 'gpt-4o', 'claude-3-5-sonnet-20241022')
- `settings.embedding.apiKey` - Embedding API key (OpenAI or Gemini)
- `settings.embedding.provider` - Embedding provider ('openai', 'google', 'local')
- `settings.embedding.model` - Embedding model name
- `settings.tts.apiKey` - OpenAI TTS + Whisper API key
- `settings.imageGeneration.nanoBananaApiKey` - NanoBanana image generation key
- `settings.imageGeneration.geminiApiKey` - Google Gemini API key
- `settings.podcast.autoGenerate` - Boolean (enable daily podcast auto-generation)
- `settings.review.notificationsEnabled` - Boolean (enable review reminders)

**Secrets location:**
- localStorage only (no server backend)
- API keys stored in browser's localStorage under `echolearn_settings`
- No .env file used (Vite doesn't read environment variables at runtime)

## Webhooks & Callbacks

**Incoming:**
- None configured - No server component to receive webhooks

**Outgoing:**
- None - One-way calls to external APIs (OpenAI, Google, NanoBanana)
- No callback/webhook responses expected from services

## Event System

**Internal Pub/Sub:**
- EventBus singleton - `src/lib/event-bus.ts`
  - Custom pub/sub for cross-component communication
  - Event types: `SESSION_UPDATED`, `SESSION_CREATED`, `FLASHCARD_ADDED`, etc.
  - Used for: Syncing state across screens without prop drilling

## Platform-Specific Integrations

**iOS/Android Native:**
- Capacitor Haptics - Tactile feedback
  - Service: `src/lib/haptics.ts`
  - Used for: Click feedback on interactions

- Capacitor Local Notifications - Native OS notifications
  - Service: `src/services/scheduler.native.ts`
  - Notifications:
    - Podcast generation reminder (scheduled at sleepTime − advanceMinutes)
    - Review reminder (scheduled at reminderTime)
  - Permissions: Requested at first use

- Capacitor Voice Recorder - Native audio recording
  - Service: `src/lib/voice-recorder.ts`
  - Used for: Long-press on Ask button to record voice input
  - Formats: Platform-dependent (iOS: m4a, Android: aac/m4a)
  - Permissions: Microphone access required

- ZeroTier Network Integration (Stub)
  - Settings stub: `settings.zerotier.networkId`, `settings.zerotier.virtualIp`
  - Status: Appears to be a placeholder for future P2P networking

---

*Integration audit: 2026-03-31*
