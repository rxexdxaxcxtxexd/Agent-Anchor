# Implementation Plan: Trace Linking/Chaining

**Branch**: `001-trace-linking` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-trace-linking/spec.md`

## Summary

Add parent-child relationships between traces to establish causality chains. This feature extends both V1 and V2 contracts with a `parentTraceHash` field, child tracking mappings, and query functions. The SDK will provide `getTraceLineage()` and `getTraceTree()` methods for traversing trace hierarchies. Backward compatible - existing traces remain valid as root traces.

## Technical Context

**Language/Version**: Solidity ^0.8.20 (contracts), TypeScript 5.x (SDK)
**Primary Dependencies**: OpenZeppelin Contracts, ethers.js v6, Hardhat, Vitest
**Storage**: Blockchain (Polygon/Base), IPFS (trace content)
**Testing**: Hardhat (contracts), Vitest (SDK)
**Target Platform**: EVM-compatible chains (Polygon Amoy/Mainnet, Base Sepolia/Mainnet)
**Project Type**: Monorepo (pnpm workspaces)
**Performance Goals**: Paginated child queries in <2s, lineage traversal (10 levels) in <1s
**Constraints**: <30% gas overhead for linked anchoring, no breaking changes to existing API
**Scale/Scope**: Support 100+ children per trace, 10+ depth hierarchies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Smart Contract Safety | ✅ PASS | No unbounded loops in contract; pagination enforced; uses established patterns |
| II. Test-First Development | ✅ PASS | Tests defined before implementation in tasks |
| III. Multi-Chain Portability | ✅ PASS | No chain-specific opcodes; same pattern as existing code |
| IV. SDK Developer Experience | ✅ PASS | TypeScript-first, typed APIs, sensible defaults (zero = root) |
| V. Observability and Auditability | ✅ PASS | Events emitted for all link operations |

**Security Checks:**
- ✅ No private key exposure
- ✅ Input validation (parent existence check)
- ✅ Uses existing secure patterns from V1/V2

## Project Structure

### Documentation (this feature)

```text
specs/001-trace-linking/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Entity definitions
├── quickstart.md        # Integration guide
├── contracts/           # API contracts (OpenAPI)
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
packages/
├── contracts/
│   ├── contracts/
│   │   ├── AgentAnchor.sol         # Modify: add linking to V1
│   │   ├── AgentAnchorV2.sol       # Modify: add linking to V2
│   │   ├── interfaces/
│   │   │   └── ITraceLinking.sol   # NEW: linking interface
│   │   └── libraries/
│   │       └── TraceLinkingLib.sol # NEW: shared logic (optional)
│   └── test/
│       └── TraceLinking.test.ts    # NEW: linking tests
│
└── sdk/
    ├── src/
    │   ├── client.ts               # Modify: add linking methods
    │   ├── clientV2.ts             # Modify: add linking methods
    │   ├── types.ts                # Modify: add linking types
    │   └── linking.ts              # NEW: lineage/tree helpers
    └── test/
        └── linking.test.ts         # NEW: linking tests
```

**Structure Decision**: Extends existing monorepo structure. New interface for trace linking added to contracts, SDK extended with new methods and helper module.

## Complexity Tracking

> No Constitution violations requiring justification.

| Item | Decision | Rationale |
|------|----------|-----------|
| Interface vs inline | ITraceLinking interface | Clean separation, testable, consistent with V2 ownership interfaces |
| Lineage in contract vs SDK | SDK-side traversal | Avoids unbounded loops on-chain; cheaper reads |
| Modify V1 and V2 | Both modified | Maintain feature parity; users may use either version |
