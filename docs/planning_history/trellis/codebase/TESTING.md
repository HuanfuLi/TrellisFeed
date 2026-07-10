# Testing

## Testing Overview
The project uses the [Node.js Test Runner](https://nodejs.org/api/test.html) for all test files, which are written in `.mjs` format to support ES modules and TypeScript imports.

## Test Structure
- `app/tests/`: Main directory for project tests.
    - `canonical-knowledge.test.mjs`: Tests for knowledge ingestion and mapping logic.
    - `concept-feed.test.mjs`: Tests for the daily review feed generation.

## Test Types
- **Unit Tests**: Focus on testing individual services and functions in isolation.
- **Integration Tests**: Verify the interaction between multiple services (e.g., knowledge service and DB backend).

## Tools & Libraries
- **Assertion Library**: [node:assert/strict](https://nodejs.org/api/assert.html).
- **Test Runner**: Built-in [node:test](https://nodejs.org/api/test.html) module.

## Running Tests
To run all tests, execute the following command from the `app/` directory:
```bash
npm test
```
This script runs the Node.js test runner against all `.test.mjs` files in the `tests/` directory.

## Testing Practices
- Use mocks for complex external dependencies (e.g., SQLite, AI providers).
- Ensure high test coverage for core business logic in the `services/` directory.
- Maintain independent test cases to prevent state leakage between runs.
