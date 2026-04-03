# Changelog: March 25, 2026

## Question Quality Evaluation (`phase-06`)

### Hybrid Filtering Layer
- **Pattern + LLM Detection:** Implemented `question-filter.service.ts` with a 7-category `PATTERN_LIBRARY` covering greetings, small talk, meta-questions, sarcasm, jokes, trivial acknowledgments, and test messages.
- **Synchronous Filtering:** Common off-topic patterns are now flagged synchronously (<1ms latency), reducing LLM API overhead and latency for 90%+ of meta-questions.
- **Session Context Awareness:** Follow-up questions are now evaluated with prior Q&A context, ensuring that legitimate elaborations are not incorrectly flagged as off-topic.

### Interactive User Override UI
- **Off-Topic Badge:** Added a non-intrusive "Off-topic" badge to AI responses that renders only when a question is flagged.
- **Inline Save Prompt:** Clicking the badge expands an inline prompt ("This looks off-topic. Save anyway?") that allows users to override the flag without navigating away from the chat.
- **Immediate Feedback:** Integrated toast notifications for successful overrides, providing immediate confirmation that the question has been saved to the knowledge base.

### Knowledge Graph Integrity
- **Filtered Ingestion:** Updated `canonical-knowledge.service.ts` to respect the `flagged` status, preventing off-topic questions from polluting the knowledge graph.
- **Clean Review Queue:** Ensured that flagged questions are automatically excluded from review sessions, flashcards, and podcast generation.
- **Persistent Flagging:** The `flagged` state is persisted to the local store, maintaining the filtering status across application restarts.
