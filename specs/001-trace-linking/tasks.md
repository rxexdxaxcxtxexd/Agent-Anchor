# Tasks: Trace Linking/Chaining

**Input**: Design documents from `/specs/001-trace-linking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution principle II (Test-First Development)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Contracts**: `packages/contracts/contracts/`
- **Contract Tests**: `packages/contracts/test/`
- **SDK Source**: `packages/sdk/src/`
- **SDK Tests**: `packages/sdk/test/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the interface and extend types needed by all user stories

- [X] T001 [P] Create ITraceLinking interface in packages/contracts/contracts/interfaces/ITraceLinking.sol
- [X] T002 [P] Add trace linking types to packages/sdk/src/types.ts (TraceLineage, TraceTreeNode, GetTreeOptions, extended AnchorOptions)
- [X] T003 [P] Add linking error types to packages/contracts/contracts/AgentAnchor.sol (ParentTraceNotFound, SelfReferenceNotAllowed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contract storage and mappings that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add `childTraces` mapping to packages/contracts/contracts/AgentAnchor.sol
- [X] T005 Add `childTraces` mapping to packages/contracts/contracts/AgentAnchorV2.sol
- [X] T006 Add `TraceLinked` event to packages/contracts/contracts/AgentAnchor.sol
- [X] T007 Add `TraceLinked` event to packages/contracts/contracts/AgentAnchorV2.sol
- [X] T008 Extend Anchor struct with `parentTraceHash` field in packages/contracts/contracts/AgentAnchorV2.sol
- [X] T009 Update SDK Anchor interface to include `parentTraceHash` in packages/sdk/src/types.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Link Child Trace to Parent (Priority: P1) 🎯 MVP

**Goal**: Enable anchoring traces with parent references, with on-chain validation

**Independent Test**: Anchor a child trace with parent reference, verify link stored correctly

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Contract test: anchor with valid parent in packages/contracts/test/TraceLinking.test.ts
- [X] T011 [P] [US1] Contract test: anchor root trace (zero parent) in packages/contracts/test/TraceLinking.test.ts
- [X] T012 [P] [US1] Contract test: reject non-existent parent in packages/contracts/test/TraceLinking.test.ts
- [X] T013 [P] [US1] Contract test: reject self-reference in packages/contracts/test/TraceLinking.test.ts
- [X] T014 [P] [US1] Contract test: emit TraceLinked event in packages/contracts/test/TraceLinking.test.ts
- [X] T015 [P] [US1] SDK test: anchorTrace with parentTraceHash option in packages/sdk/test/linking.test.ts

### Implementation for User Story 1

- [X] T016 [US1] Implement parent validation in anchorTrace() in packages/contracts/contracts/AgentAnchor.sol
- [X] T017 [US1] Update anchorTrace() to store parentTraceHash and push to childTraces in packages/contracts/contracts/AgentAnchor.sol
- [X] T018 [US1] Emit TraceLinked event when parent is non-zero in packages/contracts/contracts/AgentAnchor.sol
- [X] T019 [US1] Implement same linking logic in packages/contracts/contracts/AgentAnchorV2.sol
- [X] T020 [US1] Update SDK client anchorTrace() to accept parentTraceHash option in packages/sdk/src/client.ts
- [X] T021 [US1] Update SDK clientV2 anchorTrace() to accept parentTraceHash option in packages/sdk/src/clientV2.ts
- [X] T022 [US1] Update SDK constants with new ABI entries in packages/sdk/src/constants.ts

**Checkpoint**: User Story 1 complete - traces can now be linked to parents

---

## Phase 4: User Story 2 - Query Child Traces (Priority: P2)

**Goal**: Enable querying all direct children of a parent trace with pagination

**Independent Test**: Create multiple child traces, query children, verify complete list returned

### Tests for User Story 2

- [X] T023 [P] [US2] Contract test: getChildTraces returns all children in packages/contracts/test/TraceLinking.test.ts
- [X] T024 [P] [US2] Contract test: getChildTraces returns empty for no children in packages/contracts/test/TraceLinking.test.ts
- [X] T025 [P] [US2] Contract test: getChildTracesPaginated with offset/limit in packages/contracts/test/TraceLinking.test.ts
- [X] T026 [P] [US2] Contract test: getChildTraceCount returns correct count in packages/contracts/test/TraceLinking.test.ts
- [X] T027 [P] [US2] SDK test: getChildTraces method in packages/sdk/test/linking.test.ts
- [X] T028 [P] [US2] SDK test: getChildTracesPaginated method in packages/sdk/test/linking.test.ts

### Implementation for User Story 2

- [X] T029 [US2] Implement getChildTraces() in packages/contracts/contracts/AgentAnchor.sol
- [X] T030 [US2] Implement getChildTracesPaginated() in packages/contracts/contracts/AgentAnchor.sol
- [X] T031 [US2] Implement getChildTraceCount() in packages/contracts/contracts/AgentAnchor.sol
- [X] T032 [US2] Implement same query functions in packages/contracts/contracts/AgentAnchorV2.sol
- [X] T033 [US2] Implement getParentTrace() view function in packages/contracts/contracts/AgentAnchor.sol
- [X] T034 [US2] Implement getParentTrace() in packages/contracts/contracts/AgentAnchorV2.sol
- [X] T035 [US2] Implement isRootTrace() helper in packages/contracts/contracts/AgentAnchor.sol
- [X] T036 [US2] Implement isRootTrace() in packages/contracts/contracts/AgentAnchorV2.sol
- [X] T037 [US2] Add SDK getChildTraces() method in packages/sdk/src/client.ts
- [X] T038 [US2] Add SDK getChildTracesPaginated() method in packages/sdk/src/client.ts
- [X] T039 [US2] Add SDK getParentTrace() method in packages/sdk/src/client.ts
- [X] T040 [US2] Add same methods to packages/sdk/src/clientV2.ts

**Checkpoint**: User Story 2 complete - child queries now work

---

## Phase 5: User Story 3 - Query Full Trace Lineage (Priority: P3)

**Goal**: Enable retrieving complete ancestry from any trace up to root (SDK-side)

**Independent Test**: Create 3-level hierarchy, query lineage from deepest, verify complete path

### Tests for User Story 3

- [X] T041 [P] [US3] SDK test: getTraceLineage returns ordered ancestors in packages/sdk/test/linking.test.ts
- [X] T042 [P] [US3] SDK test: getTraceLineage for root returns single entry in packages/sdk/test/linking.test.ts
- [X] T043 [P] [US3] SDK test: getTraceLineage respects maxDepth limit in packages/sdk/test/linking.test.ts
- [X] T044 [P] [US3] SDK test: getTraceLineage throws on excessive depth in packages/sdk/test/linking.test.ts

### Implementation for User Story 3

- [X] T045 [US3] Create linking helper module in packages/sdk/src/linking.ts
- [X] T046 [US3] Implement getTraceLineage() with iterative traversal in packages/sdk/src/linking.ts
- [X] T047 [US3] Add maxDepth parameter validation (default 100) in packages/sdk/src/linking.ts
- [X] T048 [US3] Integrate getTraceLineage() into AgentAnchorClient in packages/sdk/src/client.ts
- [X] T049 [US3] Integrate getTraceLineage() into AgentAnchorClientV2 in packages/sdk/src/clientV2.ts

**Checkpoint**: User Story 3 complete - lineage queries now work

---

## Phase 6: User Story 4 - Query Trace Tree (Priority: P4)

**Goal**: Enable retrieving full descendant tree from a root trace (SDK-side)

**Independent Test**: Create branching trace tree, query from root, verify all descendants included

### Tests for User Story 4

- [X] T050 [P] [US4] SDK test: getTraceTree returns all descendants in packages/sdk/test/linking.test.ts
- [X] T051 [P] [US4] SDK test: getTraceTree handles multiple branches in packages/sdk/test/linking.test.ts
- [X] T052 [P] [US4] SDK test: getTraceTree respects maxDepth option in packages/sdk/test/linking.test.ts
- [X] T053 [P] [US4] SDK test: getTraceTree respects maxNodes option in packages/sdk/test/linking.test.ts
- [X] T054 [P] [US4] SDK test: getTraceTree with includeAnchors option in packages/sdk/test/linking.test.ts

### Implementation for User Story 4

- [X] T055 [US4] Implement getTraceTree() with BFS traversal in packages/sdk/src/linking.ts
- [X] T056 [US4] Add maxDepth and maxNodes validation in packages/sdk/src/linking.ts
- [X] T057 [US4] Add includeAnchors option to fetch full anchor data in packages/sdk/src/linking.ts
- [X] T058 [US4] Integrate getTraceTree() into AgentAnchorClient in packages/sdk/src/client.ts
- [X] T059 [US4] Integrate getTraceTree() into AgentAnchorClientV2 in packages/sdk/src/clientV2.ts

**Checkpoint**: User Story 4 complete - tree queries now work

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, gas validation, and final integration

- [X] T060 [P] Update SDK exports in packages/sdk/src/index.ts to include linking types and methods
- [X] T061 [P] Add CLI commands for trace linking in packages/sdk/bin/cli.ts (children, lineage, tree)
- [X] T062 [P] Gas benchmark test: verify <30% overhead in packages/contracts/test/TraceLinking.test.ts
- [X] T063 [P] Update packages/sdk/README.md with trace linking documentation
- [X] T064 Run all existing tests to verify backward compatibility
- [X] T065 Validate quickstart.md examples work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup) ──────────────────────────────────────┐
                                                       │
Phase 2 (Foundational) ───────────────────────────────┤
                                                       │
    ┌──────────────────────────────────────────────────┘
    │
    ├── Phase 3 (US1: Link Child to Parent) ──────────┐
    │                                                  │
    ├── Phase 4 (US2: Query Children) ◄───────────────┤ (US2 depends on US1)
    │                                                  │
    ├── Phase 5 (US3: Query Lineage) ◄────────────────┤ (US3 depends on US1)
    │                                                  │
    └── Phase 6 (US4: Query Tree) ◄───────────────────┘ (US4 depends on US2)
                                                       │
Phase 7 (Polish) ◄─────────────────────────────────────┘
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Link) | Phase 2 (Foundational) | Phase 2 complete |
| US2 (Children) | US1 (needs linked traces to query) | US1 complete |
| US3 (Lineage) | US1 (needs linked traces) | US1 complete |
| US4 (Tree) | US2 (uses getChildTraces) | US2 complete |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Contract changes before SDK changes
3. V1 contract before V2 contract (same pattern)
4. Core methods before helper methods

### Parallel Opportunities

**Phase 1 (all parallel)**:
```text
T001, T002, T003 - different files
```

**Phase 3 Tests (all parallel)**:
```text
T010, T011, T012, T013, T014, T015 - test files, no dependencies
```

**Phase 4 Tests (all parallel)**:
```text
T023, T024, T025, T026, T027, T028 - test files
```

**Phase 5 Tests (all parallel)**:
```text
T041, T042, T043, T044 - SDK test files
```

**Phase 6 Tests (all parallel)**:
```text
T050, T051, T052, T053, T054 - SDK test files
```

**Phase 7 (mostly parallel)**:
```text
T060, T061, T062, T063 - different files
```

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch all tests for US1 together (they should all FAIL initially):
T010: Contract test for anchor with valid parent
T011: Contract test for root trace (zero parent)
T012: Contract test for rejecting non-existent parent
T013: Contract test for rejecting self-reference
T014: Contract test for TraceLinked event emission
T015: SDK test for anchorTrace with parentTraceHash

# After tests are written, implement sequentially:
T016 → T017 → T018 (V1 contract)
T019 (V2 contract - same pattern)
T020 → T021 → T022 (SDK)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009)
3. Complete Phase 3: User Story 1 (T010-T022)
4. **STOP and VALIDATE**: Test linking traces works
5. Deploy/demo MVP

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 → Can link traces (22 tasks)
2. **+US2**: Add child queries → Can query children (18 more tasks)
3. **+US3**: Add lineage queries → Can query ancestry (9 more tasks)
4. **+US4**: Add tree queries → Full hierarchy support (10 more tasks)
5. **Polish**: Documentation and final validation (6 tasks)

### Task Count Summary

| Phase | Tasks | Cumulative |
|-------|-------|------------|
| Setup | 3 | 3 |
| Foundational | 6 | 9 |
| US1 (MVP) | 13 | 22 |
| US2 | 18 | 40 |
| US3 | 9 | 49 |
| US4 | 10 | 59 |
| Polish | 6 | **65** |

---

## Notes

- [P] tasks = different files, no dependencies within that phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after completion
- Constitution requires tests before implementation (TDD)
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
