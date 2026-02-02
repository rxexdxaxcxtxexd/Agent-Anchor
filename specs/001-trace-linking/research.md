# Research: Trace Linking/Chaining

**Feature**: 001-trace-linking
**Date**: 2026-01-31

## Research Questions

### R1: Contract Storage Pattern for Parent-Child Relationships

**Decision**: Use a combination of:
1. `parentTraceHash` field in existing `Anchor` struct
2. New `mapping(bytes32 => bytes32[]) public childTraces` for reverse lookup

**Rationale**:
- Adding to existing struct is more gas-efficient than separate mapping for parent
- Child array mapping enables O(1) lookup of all children
- Consistent with existing `agentAnchors` and `creatorAnchors` patterns
- Pagination already solved in codebase (reuse pattern)

**Alternatives Considered**:
- Separate `TraceLink` struct: More complex, additional SSTORE costs
- Doubly-linked list: Complex, gas-expensive for removals (not needed - immutable)
- Events-only: Requires indexer for queries, loses on-chain verifiability

### R2: Parent Existence Validation Strategy

**Decision**: On-chain validation - revert if parent doesn't exist

**Rationale**:
- Trustless verification - anyone can verify link integrity
- Prevents orphan traces at creation time
- Small gas overhead (~2.5k for SLOAD check)
- Consistent with existing `anchorExists()` pattern

**Alternatives Considered**:
- SDK-only validation: Not trustless, could be bypassed
- Allow orphans with warning: Complicates queries, reduces data integrity
- Deferred validation: Complex, poor UX

### R3: Lineage/Tree Traversal Location

**Decision**: Implement in SDK (off-chain), not in contract

**Rationale**:
- Avoids unbounded loops on-chain (gas limit issues)
- Can handle arbitrarily deep trees
- Cheaper - uses view functions only
- Contract provides primitives (`getParent`, `getChildren`)

**Alternatives Considered**:
- On-chain traversal: Gas limit issues for deep trees
- Hybrid (contract for small, SDK for large): Complexity not worth it

### R4: Impact on Existing Anchor Struct

**Decision**: Extend V2 only with new field; V1 gets new function with separate storage

**Rationale**:
- V2 is the active development version
- V1 backward compatibility maintained
- Minimizes storage slot changes
- V2 can add field to Anchor struct cleanly

**Alternatives Considered**:
- New contract version (V3): Overkill for one feature
- Only modify V2: V1 users lose out on feature

### R5: Gas Optimization for Linking

**Decision**:
- Store `parentTraceHash` in anchor (one slot)
- Push to `childTraces` array (amortized cost)
- Emit `TraceLinked` event for indexing

**Estimated Gas Costs**:
- Base `anchorTrace`: ~85,000 gas
- With parent link: ~95,000 gas (+12% overhead)
- Well under 30% threshold from spec

**Alternatives Considered**:
- Lazy child tracking: Complex, worse query UX
- Bitmap for children: Only works for limited children count

### R6: Event Design for Trace Links

**Decision**: Single event `TraceLinked(bytes32 indexed childHash, bytes32 indexed parentHash)`

**Rationale**:
- Enables efficient indexing by either hash
- Separate from `TraceAnchored` for clarity
- Follows existing event patterns in codebase

**Alternatives Considered**:
- Extend TraceAnchored: Breaks existing event consumers
- Multiple events: Unnecessary complexity

## Technical Findings

### Existing Patterns to Reuse

1. **Pagination**: `getTracesByAgentPaginated` pattern directly applicable to `getChildTracesPaginated`
2. **Existence check**: `anchors[traceHash].timestamp != 0` pattern for parent validation
3. **Index management**: Same push-to-array pattern for child tracking
4. **SDK client methods**: Same async pattern with contract function calls

### Integration Points

| Component | Integration Point | Change Type |
|-----------|-------------------|-------------|
| AgentAnchor.sol | Anchor struct, anchorTrace, new mappings | Modify |
| AgentAnchorV2.sol | Same as V1 plus OwnershipRecord | Modify |
| ITraceLinking.sol | New interface | New file |
| client.ts | anchorTrace options, getChildren, getLineage | Modify |
| clientV2.ts | Same as V1 | Modify |
| types.ts | AnchorOptions, Anchor, new types | Modify |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking change to Anchor struct | Add field at end; backward compatible in Solidity |
| Gas increase for all anchors | Only ~12% increase; well within budget |
| Deep tree stack overflow in SDK | Use iterative (not recursive) traversal |
| Circular reference potential | Impossible - parent must exist first |

## Conclusion

All research questions resolved. Ready for Phase 1 design.
