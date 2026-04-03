# EchoLearn Roadmap (v2.0 Path)

- [x] [Milestone 1.0: Learning Loop Foundation](.planning/milestones/v1.0-ROADMAP.md) - Shipped 2026-03-25.
- [x] [Milestone 1.1: Engagement & Discovery Iteration](.planning/ROADMAP.md) - Shipped 2026-04-02. This milestone encapsulated Phases 7 through 16, resulting in the delivery of image-forward feeds, intelligent planner auto-suggestions, cluster-aware anchor graphs, portal navigation, and LLM token pipeline optimizations.

## Milestone 2: Dynamic Learning Orchestration & Diagnostic Dialogue
*Note: Phase numbering continues from Milestone 1.1's conclusion at Phase 16.*

- [ ] **Phase 17: The Orchestration Engine (Architecture)**
  - [ ] Define `OrchestrationStrategy` and `LearningOrchestrator` interfaces.
  - [ ] Implement `TrajectoryObserver` to aggregate data from Review, Question, and Feed services over time.
  - [ ] Create a decoupled plug-and-play structure inside `src/services/orchestrator/`.
- [ ] **Phase 18: Diagnostic Dialogue & Content Portals**
  - [ ] Replace the fixed static Check-In interfaces with a broader Socratic conversational UI.
  - [ ] Refactor Planner presentation to serve up rich "Portals" that act as unified gateways into specific subjects.
  - [ ] Support redirect logic for orchestrated Recommendations bridging (Post/Question/Review).
- [ ] **Phase 19: Multi-Device Sync & Trajectory Persistence**
  - [ ] Establish initial architecture for synchronizing the knowledge repository.
  - [ ] Implement robust metadata mapping for trajectory and orchestrator state synchronization across mobile/web channels.
  - [ ] Wrap final Milestone 2 polish and verification layers.
