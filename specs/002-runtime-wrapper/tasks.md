# Tasks: Agent Anchor Runtime Wrapper

**Input**: Design documents from `/specs/002-runtime-wrapper/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Test-first development per constitution. Tests included per acceptance scenarios.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US7)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md project structure:

```text
packages/sdk/src/runtime/     # Source files
packages/sdk/test/runtime/    # Test files
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and runtime module structure

- [x] T001 Create runtime module directory structure at packages/sdk/src/runtime/
- [x] T002 [P] Add @noble/secp256k1 and idb dependencies to packages/sdk/package.json
- [x] T003 [P] Create types.ts with all TypeScript interfaces from contracts/runtime-api.ts in packages/sdk/src/runtime/types.ts
- [x] T004 [P] Create test directory structure at packages/sdk/test/runtime/
- [x] T005 Update packages/sdk/src/index.ts to export runtime module

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Implement RuntimeConfig validation in packages/sdk/src/runtime/config.ts
- [x] T007 [P] Create storage interface abstraction in packages/sdk/src/runtime/storage/interface.ts
- [x] T008 [P] Implement IndexedDB storage backend in packages/sdk/src/runtime/storage/indexeddb.ts
- [x] T009 [P] Implement filesystem JSON storage backend in packages/sdk/src/runtime/storage/filesystem.ts
- [x] T010 Create storage factory with environment detection in packages/sdk/src/runtime/storage/index.ts
- [x] T011 [P] Implement chain configuration (RPC URLs, explorer URLs) in packages/sdk/src/runtime/chains.ts
- [x] T012 Create AgentAnchor SDK integration layer in packages/sdk/src/runtime/anchor.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Wrap Existing Agent (Priority: P1) 🎯 MVP

**Goal**: Developer wraps agent with one line, all method calls create trace entries automatically

**Independent Test**: Wrap any JS/TS object, verify method calls are intercepted and TraceEntry records created

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [P] [US1] Test: Proxy wraps object without modifying original in packages/sdk/test/runtime/wrapper.test.ts
- [x] T014 [P] [US1] Test: Sync method calls intercepted and traced in packages/sdk/test/runtime/interceptor.test.ts
- [x] T015 [P] [US1] Test: Async method calls intercepted and traced in packages/sdk/test/runtime/interceptor.test.ts
- [x] T016 [P] [US1] Test: TraceEntry captures method, args, result, timestamp, duration in packages/sdk/test/runtime/interceptor.test.ts
- [x] T017 [P] [US1] Test: Nested calls tracked with parentId in packages/sdk/test/runtime/interceptor.test.ts
- [x] T018 [P] [US1] Test: Errors captured with ErrorInfo in packages/sdk/test/runtime/interceptor.test.ts

### Implementation for User Story 1

- [x] T019 [US1] Implement ES6 Proxy handler with get trap in packages/sdk/src/runtime/wrapper.ts
- [x] T020 [US1] Implement method interception and TraceEntry creation in packages/sdk/src/runtime/interceptor.ts
- [x] T021 [US1] Handle async/await methods via Promise detection in packages/sdk/src/runtime/interceptor.ts
- [x] T022 [US1] Track nested calls with call stack for parentId in packages/sdk/src/runtime/interceptor.ts
- [x] T023 [US1] Capture errors and create ErrorInfo structure in packages/sdk/src/runtime/interceptor.ts
- [x] T024 [US1] Create AgentAnchorRuntime.wrap() entry point in packages/sdk/src/runtime/index.ts

**Checkpoint**: Wrapping works - methods intercepted, traces created locally (no signing/anchoring yet)

---

## Phase 4: User Story 3 - Local Signing (Priority: P1)

**Goal**: Every action signed locally with secp256k1, creating tamper-evident records within 10ms

**Independent Test**: Capture actions, modify local log, verify tampering detected via signature failure

**Dependency**: Requires US1 (interception) to generate TraceEntry records to sign

### Tests for User Story 3

- [x] T025 [P] [US3] Test: SignedRecord created within 10ms of action completion in packages/sdk/test/runtime/signer.test.ts
- [x] T026 [P] [US3] Test: Hash computed correctly via keccak256 in packages/sdk/test/runtime/signer.test.ts
- [x] T027 [P] [US3] Test: Signature valid and recoverable to signer address in packages/sdk/test/runtime/signer.test.ts
- [x] T028 [P] [US3] Test: previousHash chains records for integrity in packages/sdk/test/runtime/signer.test.ts
- [x] T029 [P] [US3] Test: Tampering detected when record modified in packages/sdk/test/runtime/signer.test.ts
- [x] T030 [P] [US3] Test: verifySignature() returns false for invalid signatures in packages/sdk/test/runtime/signer.test.ts
- [x] T031 [P] [US3] Test: verifyChainIntegrity() detects broken hash chain in packages/sdk/test/runtime/signer.test.ts

### Implementation for User Story 3

- [x] T032 [US3] Implement keccak256 hashing of TraceEntry in packages/sdk/src/runtime/signer.ts
- [x] T033 [US3] Implement secp256k1 signing via @noble/secp256k1 in packages/sdk/src/runtime/signer.ts
- [x] T034 [US3] Implement previousHash chain linking in packages/sdk/src/runtime/signer.ts
- [x] T035 [US3] Implement verifySignature() utility in packages/sdk/src/runtime/signer.ts
- [x] T036 [US3] Implement verifyChainIntegrity() utility in packages/sdk/src/runtime/signer.ts
- [x] T037 [US3] Integrate signer into interceptor flow in packages/sdk/src/runtime/interceptor.ts
- [x] T038 [US3] Add signed records to local cache in packages/sdk/src/runtime/cache.ts

**Checkpoint**: All actions have tamper-evident signed local records

---

## Phase 5: User Story 2 - Consistency Modes (Priority: P1)

**Goal**: Four consistency modes configurable: sync (default), async, cache, two-phase

**Independent Test**: Configure each mode, verify behavior on anchor success/failure/delay

**Dependency**: Requires US1 (interception) + US3 (signing) to have signed records to anchor

### Tests for User Story 2

- [x] T039 [P] [US2] Test: Sync mode halts execution on anchor failure in packages/sdk/test/runtime/consistency.test.ts
- [x] T040 [P] [US2] Test: Sync mode waits for confirmation before returning in packages/sdk/test/runtime/consistency.test.ts
- [x] T041 [P] [US2] Test: Async mode returns immediately, anchors in background in packages/sdk/test/runtime/consistency.test.ts
- [x] T042 [P] [US2] Test: Cache mode batches records and flushes on interval in packages/sdk/test/runtime/consistency.test.ts
- [x] T043 [P] [US2] Test: Two-phase mode signs locally, updates status async in packages/sdk/test/runtime/consistency.test.ts
- [x] T044 [P] [US2] Test: Default mode is sync when not specified in packages/sdk/test/runtime/consistency.test.ts

### Implementation for User Story 2

- [x] T045 [US2] Create ConsistencyStrategy interface in packages/sdk/src/runtime/consistency/interface.ts
- [x] T046 [US2] Implement SyncStrategy in packages/sdk/src/runtime/consistency/sync.ts
- [x] T047 [US2] Implement AsyncStrategy in packages/sdk/src/runtime/consistency/async.ts
- [x] T048 [US2] Implement CacheStrategy with flush interval in packages/sdk/src/runtime/consistency/cache.ts
- [x] T049 [US2] Implement TwoPhaseStrategy with status tracking in packages/sdk/src/runtime/consistency/two-phase.ts
- [x] T050 [US2] Create strategy factory based on config in packages/sdk/src/runtime/consistency/index.ts
- [x] T051 [US2] Integrate consistency strategy into wrapper flow in packages/sdk/src/runtime/wrapper.ts

**Checkpoint**: All four consistency modes work independently with correct behavior

---

## Phase 6: User Story 4 - Redact Sensitive Data (Priority: P2)

**Goal**: Built-in and custom redaction patterns scrub PII before signing/anchoring

**Independent Test**: Trace actions with SSN/CC/API keys, verify redacted in resulting trace

### Tests for User Story 4

- [x] T052 [P] [US4] Test: SSN pattern redacted with default rules in packages/sdk/test/runtime/redaction.test.ts
- [x] T053 [P] [US4] Test: Credit card pattern redacted in packages/sdk/test/runtime/redaction.test.ts
- [x] T054 [P] [US4] Test: API key patterns (sk_live_, AKIA) redacted in packages/sdk/test/runtime/redaction.test.ts
- [x] T055 [P] [US4] Test: Email addresses redacted in packages/sdk/test/runtime/redaction.test.ts
- [x] T056 [P] [US4] Test: Custom regex patterns applied in packages/sdk/test/runtime/redaction.test.ts
- [x] T057 [P] [US4] Test: Redaction applied before signing (never persists original) in packages/sdk/test/runtime/redaction.test.ts
- [x] T058 [P] [US4] Test: Redaction can be disabled via config in packages/sdk/test/runtime/redaction.test.ts

### Implementation for User Story 4

- [x] T059 [US4] Define BUILTIN_PATTERNS constant with SSN, CC, API key, email, phone patterns in packages/sdk/src/runtime/redaction.ts
- [x] T060 [US4] Implement redactValue() for deep object traversal in packages/sdk/src/runtime/redaction.ts
- [x] T061 [US4] Implement pattern matching and replacement logic in packages/sdk/src/runtime/redaction.ts
- [x] T062 [US4] Support custom RedactionRule[] from config in packages/sdk/src/runtime/redaction.ts
- [x] T063 [US4] Integrate redaction into interceptor before signing in packages/sdk/src/runtime/wrapper.ts

**Checkpoint**: Sensitive data automatically scrubbed from all traces

---

## Phase 7: User Story 5 - Wallet Connection (Priority: P2)

**Goal**: MetaMask/WalletConnect integration, multi-chain, gas strategies, explorer URLs

**Independent Test**: Connect wallet, anchor trace, verify on block explorer

### Tests for User Story 5

- [x] T064 [P] [US5] Test: Private key wallet creates valid signer in packages/sdk/test/runtime/wallet.test.ts
- [x] T065 [P] [US5] Test: Injected wallet (MetaMask mock) connects in packages/sdk/test/runtime/wallet.test.ts
- [x] T066 [P] [US5] Test: WalletConnect config accepted in packages/sdk/test/runtime/wallet.test.ts
- [x] T067 [P] [US5] Test: Chain selection switches RPC endpoint in packages/sdk/test/runtime/wallet.test.ts
- [x] T068 [P] [US5] Test: Gas strategy 'aggressive' increases priority fee in packages/sdk/test/runtime/wallet.test.ts
- [x] T069 [P] [US5] Test: getExplorerUrl() returns correct URL per chain in packages/sdk/test/runtime/wallet.test.ts

### Implementation for User Story 5

- [x] T070 [US5] Implement createWalletSigner() for privateKey config in packages/sdk/src/runtime/wallet.ts
- [x] T071 [US5] Implement connectInjectedWallet() for MetaMask in packages/sdk/src/runtime/wallet.ts
- [x] T072 [US5] Implement connectWalletConnect() adapter in packages/sdk/src/runtime/wallet.ts
- [x] T073 [US5] Implement gas estimation strategies in packages/sdk/src/runtime/gas.ts
- [x] T074 [US5] Implement getExplorerUrl() per chain in packages/sdk/src/runtime/chains.ts
- [x] T075 [US5] Expose connectWallet/disconnectWallet/getConnectedAddress on AgentAnchorRuntime in packages/sdk/src/runtime/index.ts

**Checkpoint**: Blockchain-native users can connect wallet and verify anchors on-chain

---

## Phase 8: User Story 6 - Resolve Unconfirmed Actions (Priority: P2)

**Goal**: Operators view pending actions, retry anchoring, or acknowledge local records

**Independent Test**: Simulate anchor failures, view pending list, exercise resolution options

### Tests for User Story 6

- [x] T076 [P] [US6] Test: getPendingRecords() returns all unconfirmed in packages/sdk/test/runtime/resolution.test.ts
- [x] T077 [P] [US6] Test: retryAnchor() attempts anchor again in packages/sdk/test/runtime/resolution.test.ts
- [x] T078 [P] [US6] Test: retryAnchor() updates status on success in packages/sdk/test/runtime/resolution.test.ts
- [x] T079 [P] [US6] Test: markLocallyVerified() changes status to 'local-only' in packages/sdk/test/runtime/resolution.test.ts
- [x] T080 [P] [US6] Test: getAnchorStatus() returns current state in packages/sdk/test/runtime/resolution.test.ts

### Implementation for User Story 6

- [x] T081 [US6] Implement getPendingRecords() query on cache in packages/sdk/src/runtime/cache.ts
- [x] T082 [US6] Implement retryAnchor() with status update in packages/sdk/src/runtime/anchor.ts
- [x] T083 [US6] Implement markLocallyVerified() state transition in packages/sdk/src/runtime/cache.ts
- [x] T084 [US6] Implement getAnchorStatus() lookup in packages/sdk/src/runtime/cache.ts
- [x] T085 [US6] Expose resolution methods on WrappedAgent interface in packages/sdk/src/runtime/wrapper.ts

**Checkpoint**: Operators can resolve all pending actions

---

## Phase 9: User Story 7 - Monitor with Callbacks (Priority: P3)

**Goal**: Lifecycle callbacks (pending, confirmed, failed) for monitoring integration

**Independent Test**: Configure callbacks, verify they fire at appropriate lifecycle events

### Tests for User Story 7

- [x] T086 [P] [US7] Test: onActionCaptured fires when method intercepted in packages/sdk/test/runtime/callbacks.test.ts
- [x] T087 [P] [US7] Test: onRecordSigned fires after signing in packages/sdk/test/runtime/callbacks.test.ts
- [x] T088 [P] [US7] Test: onAnchorPending fires when tx submitted in packages/sdk/test/runtime/callbacks.test.ts
- [x] T089 [P] [US7] Test: onAnchorConfirmed fires with receipt on confirmation in packages/sdk/test/runtime/callbacks.test.ts
- [x] T090 [P] [US7] Test: onAnchorFailed fires with error after retries exhausted in packages/sdk/test/runtime/callbacks.test.ts
- [x] T091 [P] [US7] Test: onStorageWarning fires at 80% capacity in packages/sdk/test/runtime/callbacks.test.ts

### Implementation for User Story 7

- [x] T092 [US7] Create callback invoker utility in packages/sdk/src/runtime/callbacks.ts
- [x] T093 [US7] Integrate onActionCaptured in interceptor in packages/sdk/src/runtime/interceptor.ts
- [x] T094 [US7] Integrate onRecordSigned in signer in packages/sdk/src/runtime/signer.ts
- [x] T095 [US7] Integrate onAnchorPending/Confirmed/Failed in consistency strategies in packages/sdk/src/runtime/consistency/*.ts
- [x] T096 [US7] Integrate onStorageWarning in cache write path in packages/sdk/src/runtime/cache.ts

**Checkpoint**: All lifecycle events trigger configured callbacks

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Integration, documentation, and quality improvements

- [ ] T097 [P] Create integration test: full wrap→trace→sign→anchor flow in packages/sdk/test/runtime/integration.test.ts
- [ ] T098 [P] Create integration test: edge cases (exceptions, nested calls, storage full) in packages/sdk/test/runtime/integration.test.ts
- [ ] T099 [P] Performance test: verify <10ms signing overhead in packages/sdk/test/runtime/performance.test.ts
- [ ] T100 [P] Performance test: verify 100+ actions/minute in async mode in packages/sdk/test/runtime/performance.test.ts
- [ ] T101 Update SDK documentation with runtime wrapper guide
- [ ] T102 Validate quickstart.md scenarios work end-to-end
- [ ] T103 Security review: verify no key logging, proper input validation
- [ ] T104 Final exports cleanup in packages/sdk/src/runtime/index.ts

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ─────────────────┐
                                │
Phase 2: Foundational ──────────┤
                                │
    ┌───────────────────────────┴───────────────────────────┐
    │                                                       │
    ▼                                                       │
Phase 3: US1 Wrap Agent (P1) ─────► Must complete first     │
    │                                                       │
    ▼                                                       │
Phase 4: US3 Local Signing (P1) ──► Requires US1            │
    │                                                       │
    ▼                                                       │
Phase 5: US2 Consistency (P1) ────► Requires US1 + US3      │
    │                                                       │
    ├───────────────────────────────────────────────────────┤
    │  After P1 stories complete, P2/P3 can run in parallel │
    ▼                                                       ▼
Phase 6: US4 Redaction (P2)     Phase 7: US5 Wallet (P2)
                                Phase 8: US6 Resolution (P2)
                                Phase 9: US7 Callbacks (P3)
    │                                                       │
    └───────────────────────────┬───────────────────────────┘
                                │
                                ▼
                    Phase 10: Polish & Cross-Cutting
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Wrap Agent) | Foundational only | Phase 2 complete |
| US3 (Local Signing) | US1 | Phase 3 complete |
| US2 (Consistency) | US1, US3 | Phase 4 complete |
| US4 (Redaction) | US1 | Phase 3 complete (parallel with US3) |
| US5 (Wallet) | Foundational | Phase 2 complete (parallel with US1) |
| US6 (Resolution) | US2, US3 | Phase 5 complete |
| US7 (Callbacks) | US1, US3 | Phase 4 complete |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Core logic before integration
3. Integration before exports
4. Verify story checkpoint before next phase

### Parallel Opportunities

**Phase 1 (all parallel)**:
```
T001, T002, T003, T004 can run simultaneously
```

**Phase 2 (partial parallel)**:
```
T007, T008, T009, T011 can run simultaneously after T006
```

**Phase 3-5 Tests (within each phase)**:
```
All [P] test tasks can run simultaneously
```

**Phase 6-9 (after P1 stories)**:
```
US4, US5, US6, US7 can all be worked on in parallel by different developers
```

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (Phase 3 tests):
Task T013: "Test: Proxy wraps object without modifying original"
Task T014: "Test: Sync method calls intercepted and traced"
Task T015: "Test: Async method calls intercepted and traced"
Task T016: "Test: TraceEntry captures method, args, result, timestamp, duration"
Task T017: "Test: Nested calls tracked with parentId"
Task T018: "Test: Errors captured with ErrorInfo"

# After tests fail, launch implementation (sequential due to dependencies):
T019 → T020 → T021 → T022 → T023 → T024
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 + 2 = Core P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 - Wrap Agent
4. Complete Phase 4: US3 - Local Signing
5. Complete Phase 5: US2 - Consistency Modes
6. **STOP and VALIDATE**: MVP complete - agents can be wrapped, traces signed, anchored with configurable modes

### Incremental Delivery

1. **Setup + Foundational** → Foundation ready
2. **Add US1** → Agents can be wrapped (demo: interception works)
3. **Add US3** → Signed local records (demo: tamper evidence)
4. **Add US2** → Consistency modes (demo: sync/async/cache)
5. **Add US4** → Redaction (enterprise-ready)
6. **Add US5** → Wallet connection (blockchain-native ready)
7. **Add US6** → Resolution workflow (operational readiness)
8. **Add US7** → Monitoring (production observability)

### Parallel Team Strategy

With 3 developers after Foundational complete:

- **Developer A**: US1 → US3 → US2 (critical path)
- **Developer B**: US5 (wallet - can start early) → US6 → US7
- **Developer C**: Wait for US1 → US4 (redaction)

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 104 |
| **Phase 1 (Setup)** | 5 |
| **Phase 2 (Foundational)** | 7 |
| **US1 (Wrap Agent)** | 12 |
| **US2 (Consistency)** | 13 |
| **US3 (Local Signing)** | 14 |
| **US4 (Redaction)** | 12 |
| **US5 (Wallet)** | 12 |
| **US6 (Resolution)** | 10 |
| **US7 (Callbacks)** | 11 |
| **Phase 10 (Polish)** | 8 |
| **Parallelizable [P]** | 62 (60%) |

### MVP Scope

**Minimum Viable Product**: Phases 1-5 (US1 + US3 + US2)
- Tasks: T001-T051 (51 tasks)
- Delivers: Wrap agent, signed local records, all consistency modes

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story independently completable and testable after dependencies met
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
