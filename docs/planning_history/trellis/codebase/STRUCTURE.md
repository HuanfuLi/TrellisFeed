# Structure

## Directory Layout
The project follows a standard React and Capacitor structure:
- `app/`: Main application directory.
    - `src/`: Source code.
        - `components/`: Reusable UI components.
            - `ui/`: Core design system components (buttons, badges, etc.).
            - `screens/`: Screen-specific components.
        - `screens/`: Application page components (routed via React Router).
        - `services/`: Business logic, storage, and API services.
            - `mock/`: Mock data for development and testing.
        - `providers/`: External service abstractions (LLM, Embedding, STT, TTS).
        - `state/`: Global React state and custom hooks.
        - `lib/`: Shared utilities (haptics, theme, toast, etc.).
        - `types/`: Common TypeScript types and interfaces.
        - `assets/`: Static resources like images and fonts.
    - `public/`: Publicly accessible static assets.
    - `tests/`: Project tests.
    - `android/`: Capacitor-generated Android project files.
- `openspec/`: OpenSpec-related documentation and artifacts.
- `.gemini/`: Gemini CLI configuration and skills.
- `.planning/`: Project memory and GSD workflow files.

## Key Files
- `app/src/main.tsx`: Application entry point.
- `app/src/App.tsx`: Routing configuration and root layout.
- `app/package.json`: Project dependencies and scripts.
- `app/capacitor.config.ts`: Capacitor configuration.
- `app/vite.config.ts`: Vite build configuration.
- `app/src/services/db.service.ts`: Local storage abstraction layer.
- `app/src/state/AppProvider.tsx`: Global context provider.
