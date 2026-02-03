# Implementation Plan: Agent Anchor Runtime Wrapper

**Branch**: `002-runtime-wrapper` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-runtime-wrapper/spec.md`

## Summary

The Runtime Wrapper provides zero-code trace anchoring for AI agents by wrapping existing JavaScript/TypeScript objects with a Proxy that intercepts method calls, creates signed local records, and anchors traces to the blockchain. Key technical decisions include using JavaScript Proxy for interception, Ed25519/secp256k1 for local signing, IndexedDB/filesystem for local cache, and integration with the existing Agent Anchor SDK for chain writes.

## Technical Context

**Language/Version**: TypeScript 5.x (targeting ES2022+, Node.js 18+)
**Primary Dependencies**: ethers.js v6 (existing), @noble/secp256k1 (signing), idb (IndexedDB wrapper)
**Storage**: IndexedDB (browser), filesystem JSON (Node.js) for signed records cache
**Testing**: Vitest (existing), mock contracts, simulated wallet connections
**Target Platform**: Node.js 18+, modern browsers (Chrome 90+, Firefox 90+, Safari 15+)
**Project Type**: SDK extension (new module within existing `packages/sdk`)
**Performance Goals**: <10ms local signing overhead, 100+ actions/minute in async modes
**Constraints**: No external service dependencies except blockchain networks, offline-capable local operations
**Scale/Scope**: Single-agent to fleet deployment (100+ agents), local cache up to 10,000 records before flush warning

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Smart Contract Safety | N/A | No contract changes in this feature - uses existing AgentAnchor contracts |
| II. Test-First Development | PASS | Will write tests before implementation per spec acceptance scenarios |
| III. Multi-Chain Portability | PASS | Uses existing SDK chain abstraction, supports Polygon + Base |
| IV. SDK Developer Experience | PASS | One-line wrap API, TypeScript-first, sensible defaults, structured errors |
| V. Observability and Auditability | PASS | Lifecycle callbacks, signed local records, transaction tracking |
| Security Requirements | PASS | No key logging, input validation, secure defaults, local signing |

**Gate Status**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/002-runtime-wrapper/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts, not smart contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/sdk/
├── src/
│   ├── runtime/                    # NEW: Runtime Wrapper module
│   │   ├── index.ts               # Public exports
│   │   ├── wrapper.ts             # Core Proxy-based wrapper
│   │   ├── interceptor.ts         # Method interception logic
│   │   ├── signer.ts              # Local cryptographic signing
│   │   ├── cache.ts               # Local storage abstraction
│   │   ├── redaction.ts           # Sensitive data redaction
│   │   ├── consistency.ts         # Consistency mode handlers
│   │   ├── wallet.ts              # Wallet connection adapters
│   │   └── types.ts               # Runtime-specific types
│   ├── client.ts                   # Existing V1 client
│   ├── clientV2.ts                 # Existing V2 client
│   └── index.ts                    # Updated to export runtime module
├── test/
│   ├── runtime/                    # NEW: Runtime Wrapper tests
│   │   ├── wrapper.test.ts        # Proxy wrapping tests
│   │   ├── interceptor.test.ts    # Method interception tests
│   │   ├── signer.test.ts         # Local signing tests
│   │   ├── cache.test.ts          # Storage tests
│   │   ├── redaction.test.ts      # Redaction pattern tests
│   │   ├── consistency.test.ts    # Mode behavior tests
│   │   └── integration.test.ts    # End-to-end flow tests
│   └── [existing tests]
└── package.json                    # Updated dependencies
```

**Structure Decision**: Extends existing monorepo SDK package with new `runtime/` module. Maintains separation from existing client code while reusing shared utilities (types, constants, IPFS client).

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |

---

## Phase Completion Status

### Phase 0: Research ✅ COMPLETE
- **Output**: [research.md](./research.md)
- All NEEDS CLARIFICATION items resolved
- Technical decisions documented with rationale

### Phase 1: Design & Contracts ✅ COMPLETE
- **Outputs**:
  - [data-model.md](./data-model.md) - Entity definitions, state transitions, validation rules
  - [contracts/runtime-api.ts](./contracts/runtime-api.ts) - TypeScript API contracts
  - [quickstart.md](./quickstart.md) - Developer getting started guide
- Agent context updated via `update-agent-context.ps1`

### Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Smart Contract Safety | N/A | No contract changes - uses existing AgentAnchor contracts |
| II. Test-First Development | PASS | Test files defined in Project Structure; acceptance scenarios in spec |
| III. Multi-Chain Portability | PASS | ChainId type supports polygon, base, ethereum, sepolia |
| IV. SDK Developer Experience | PASS | One-line wrap API, sensible defaults, TypeScript-first, structured errors |
| V. Observability and Auditability | PASS | CallbackConfig for lifecycle events, StorageStats, AnchorStatus tracking |
| Security Requirements | PASS | RedactionConfig for PII, local signing, no key logging, signature verification |

**Post-Design Gate Status**: PASS - Design artifacts align with constitution principles.

### Phase 2: Task Generation ✅ COMPLETE
- **Output**: [tasks.md](./tasks.md)
- 104 total tasks across 10 phases
- 7 user stories mapped to phases 3-9
- 62 parallelizable tasks (60%)
- MVP scope defined: Phases 1-5 (51 tasks)

### Next: Implementation
- Run `/speckit.implement` to begin executing tasks
- Or manually work through tasks.md in order
