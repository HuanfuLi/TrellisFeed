# Conventions

## Coding Standards
- **Language**: [TypeScript](https://www.typescriptlang.org/) is used for all source files.
- **Component Pattern**: [React](https://react.dev/) functional components with hooks.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for UI styling.
- **Asynchronous Patterns**: Extensive use of `async/await` for service and provider interactions.
- **Native Support**: Careful handling of native bridge calls via Capacitor.

## Naming Conventions
- **Files**: PascalCase for React components (e.g., `Button.tsx`, `HomeScreen.tsx`), camelCase for services, providers, and utilities (e.g., `db.service.ts`, `haptics.ts`).
- **Directories**: lowercase for general folders (e.g., `services`, `lib`).
- **Variables & Functions**: camelCase (e.g., `handleUpdate`, `userData`).
- **Types & Interfaces**: PascalCase (e.g., `Question`, `ReviewResult`).

## Error Handling
- Use `try...catch` blocks for all external and native interactions.
- Graceful fallbacks for missing native features (e.g., using `localStorage` if SQLite is unavailable).
- Toast notifications for user-facing error messages.

## Best Practices
- Keep components focused and small.
- Encapsulate business logic in dedicated services.
- Use TypeScript for strong typing of data structures and API responses.
- Minimize direct DOM manipulation in favor of React state management.
