# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**
- TypeScript 5.9 - Application logic, type definitions, services
- TSX/JSX - React component syntax in `.tsx` files

**Secondary:**
- JavaScript - Build configuration (vite.config.ts, eslint.config.js)

## Runtime

**Environment:**
- Node.js (development/build time)
- React 19.2.0 runtime (browser/native WebView)
- Capacitor 8.1.0 runtime (native iOS/Android)

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 - UI framework
- React Router DOM 7.13.1 - Client-side routing (`/onboarding`, `/home`, `/ask`, `/calendar`, `/review`, `/podcast`, `/settings`)

**Styling:**
- Tailwind CSS 4.2.1 - Utility-first CSS framework
- @tailwindcss/vite 4.2.1 - Vite integration for Tailwind
- CSS Variables - Custom theme system (--primary-40, --surface, --surface-variant, etc.)

**Component Libraries:**
- lucide-react 0.575.0 - Icon library
- framer-motion 12.38.0 - Animation framework
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub Flavored Markdown support
- mind-elixir 5.9.3 - Mind mapping/knowledge graph visualization

**Build & Development:**
- Vite 7.3.1 - Build tool and dev server
- @vitejs/plugin-react 5.1.1 - React Fast Refresh for Vite

**Mobile Framework:**
- Capacitor 8.1.0 - Cross-platform mobile (iOS/Android) runtime
  - @capacitor/core 8.1.0
  - @capacitor/app 8.0.1 - App lifecycle
  - @capacitor/android 8.1.0 - Android native integration
  - @capacitor/haptics 8.0.1 - Haptic feedback
  - @capacitor/local-notifications 8.0.2 - Native notifications
  - @capacitor/cli 8.1.0 - Command-line tools

**Database (Native):**
- @capacitor-community/sqlite 8.0.1 - SQLite on iOS/Android, falls back to localStorage on web

**Audio:**
- capacitor-voice-recorder 7.0.6 - Voice recording for speech-to-text

## Key Dependencies

**Critical:**
- react 19.2.0 - Core UI rendering
- react-dom 19.2.0 - React DOM bindings
- @capacitor/core 8.1.0 - Native platform abstraction
- @capacitor-community/sqlite 8.0.1 - Persistent database (native)

**Infrastructure:**
- react-router-dom 7.13.1 - Routing and navigation
- tailwindcss 4.2.1 - CSS framework with Vite integration
- vite 7.3.1 - Development server and build bundler

**UI & Animation:**
- lucide-react 0.575.0 - Icon library (575+ icons)
- framer-motion 12.38.0 - Complex animations and transitions
- mind-elixir 5.9.3 - Knowledge graph visualization

**Text & Markdown:**
- react-markdown 10.1.0 - Render markdown as React components
- remark-gfm 4.0.1 - GitHub Flavored Markdown extensions (tables, strikethrough, etc.)

## Configuration

**Environment:**
- Runtime configuration from localStorage (`echolearn_settings` key)
- Settings include: LLM provider/model/API keys, TTS config, embedding config, notification preferences
- Fallback to hardcoded defaults in `src/services/mock/settings.mock.ts`

**Build:**
- `vite.config.ts` - Vite configuration with React and Tailwind plugins
- Manual code-splitting in Vite rollup config:
  - `vendor-react` chunk: react, react-dom, react-router-dom
  - `vendor-ui` chunk: lucide-react
  - `vendor-motion` chunk: framer-motion
  - `vendor-markdown` chunk: react-markdown, remark-gfm
  - `vendor-mindmap` chunk: mind-elixir

**TypeScript:**
- `tsconfig.json` - Root configuration pointing to tsconfig.app.json and tsconfig.node.json
- `tsconfig.app.json` - Application TypeScript settings:
  - Target: ES2022
  - Strict mode enabled
  - JSX: react-jsx
  - Module: ESNext
  - No emit (relies on Vite for transpilation)

**Linting & Formatting:**
- `eslint.config.js` - Flat config (ESLint v9+):
  - Extends: js.configs.recommended, tseslint.recommended, react-hooks, react-refresh
  - Rule: `react-hooks/set-state-in-effect: off` (async data loading pattern)
  - Variable pattern: `^_` prefixed variables/params allowed (unused)
  - Ignored directories: dist, android/**, ios/**

## Platform Requirements

**Development:**
- Node.js (version unspecified in .nvmrc, check local installation)
- npm 6+ for package installation

**Production - Web:**
- Modern browser with ES2022 support (Chrome, Firefox, Safari, Edge)
- localStorage support (~10 MB quota on most browsers, ~5 MB on iOS Safari)
- IndexedDB support for larger binary data (audio, images)
- Fetch API with SSE streaming support (for LLM streaming)

**Production - Native:**
- iOS 13+ (Capacitor requirement)
- Android 8+ (Capacitor requirement)
- SQLite support via Capacitor Community plugin
- Native notifications via @capacitor/local-notifications
- Microphone permission for voice input
- Camera/gallery permission (for image generation)

**Special Requirements:**
- Internet connection for LLM APIs (Claude, OpenAI, Gemini)
- API keys configured in settings for external services
- Speech-to-Text requires OpenAI Whisper API access (shares OpenAI credentials with TTS)
- Text-to-Speech requires OpenAI TTS API access

---

*Stack analysis: 2026-03-31*
