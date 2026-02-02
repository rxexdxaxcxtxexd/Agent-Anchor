# Data Model: Trace Linking/Chaining

**Feature**: 001-trace-linking
**Date**: 2026-01-31

## Entity Definitions

### 1. Anchor (Extended)

The existing `Anchor` struct is extended with parent reference:

| Field | Type | Description |
|-------|------|-------------|
| traceHash | bytes32 | Keccak256 hash of trace content (existing) |
| ipfsUri | string | IPFS URI where full trace is stored (existing) |
| agentId | bytes32 | Agent identifier (existing) |
| granularity | Granularity | Level of detail (existing) |
| creator | address | Address that anchored trace (existing) |
| timestamp | uint256 | Block timestamp (existing) |
| blockNumber | uint256 | Block number (existing) |
| **parentTraceHash** | **bytes32** | **Parent trace hash (0x0 = root)** *(NEW)* |

### 2. Child Trace List

New mapping for reverse lookup:

```text
childTraces: mapping(bytes32 => bytes32[])
```

| Key | Value | Description |
|-----|-------|-------------|
| parentTraceHash | bytes32[] | Array of child trace hashes |

### 3. Trace Lineage (SDK-side)

Computed structure for ancestry queries:

| Field | Type | Description |
|-------|------|-------------|
| traceHash | string | Starting trace hash |
| ancestors | string[] | Ordered list from trace to root |
| depth | number | Number of ancestors (0 = root) |
| root | string | Root trace hash |

### 4. Trace Tree Node (SDK-side)

Computed structure for tree queries:

| Field | Type | Description |
|-------|------|-------------|
| traceHash | string | This node's trace hash |
| parentHash | string \| null | Parent hash (null for root) |
| children | TraceTreeNode[] | Child nodes |
| depth | number | Depth from root (0 = root) |

## State Transitions

### Anchor Creation with Parent

```text
         ┌─────────────────────┐
         │   No Anchor Exists  │
         └──────────┬──────────┘
                    │ anchorTrace(hash, uri, agentId, gran, parentHash)
                    │
         ┌──────────▼──────────┐
         │  Validate Inputs    │
         │  - hash != 0        │
         │  - uri not empty    │
         │  - agentId != 0     │
         │  - parent exists    │◄──── NEW: Parent validation
         │    OR parent == 0   │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   Store Anchor      │
         │  + Update Indexes   │
         │  + Push to Children │◄──── NEW: Update child list
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   Emit Events       │
         │  - TraceAnchored    │
         │  - TraceLinked      │◄──── NEW: Link event
         └─────────────────────┘
```

### Query Flows

**Get Children (On-Chain)**:
```text
getChildTraces(parentHash) → bytes32[]
getChildTracesPaginated(parentHash, offset, limit) → (bytes32[], total)
```

**Get Lineage (SDK)**:
```text
1. Start with target traceHash
2. anchor = getAnchor(traceHash)
3. ancestors = [traceHash]
4. while anchor.parentTraceHash != 0x0:
     ancestors.push(anchor.parentTraceHash)
     anchor = getAnchor(anchor.parentTraceHash)
5. return { ancestors, root: ancestors[last], depth: ancestors.length - 1 }
```

**Get Tree (SDK)**:
```text
1. Start with root traceHash
2. Build node = { traceHash, children: [] }
3. childHashes = getChildTraces(traceHash)
4. for each childHash:
     node.children.push(getTree(childHash))  // Recursive
5. return node
```

## Validation Rules

### On-Chain Validation

| Field | Rule | Error |
|-------|------|-------|
| parentTraceHash | Must be 0x0 OR exist in anchors | `ParentTraceNotFound(bytes32)` |
| parentTraceHash | Cannot be same as traceHash | `SelfReferenceNotAllowed(bytes32)` |

### SDK Validation

| Method | Validation | Behavior |
|--------|------------|----------|
| `getTraceLineage()` | Max depth (configurable, default 100) | Throw if exceeded |
| `getTraceTree()` | Max nodes (configurable, default 1000) | Throw if exceeded |

## Indexes

### Existing Indexes (unchanged)

- `agentAnchors[agentId]` → bytes32[]
- `creatorAnchors[creator]` → bytes32[]

### New Index

- `childTraces[parentTraceHash]` → bytes32[]

## Migration Notes

### Backward Compatibility

- Existing anchors have implicit `parentTraceHash = 0x0` (root traces)
- No migration required - new field defaults to zero
- Existing queries continue to work unchanged
- New field only populated for newly created linked traces

### Storage Layout (V2)

```text
Slot | Variable
-----|----------
0    | owner (from Ownable)
1    | anchors mapping
2    | agentAnchors mapping
3    | creatorAnchors mapping
4    | totalAnchors
5    | MAX_IPFS_URI_LENGTH (constant, no slot)
6    | permissionless
7    | allowlist mapping
8    | identityBindings mapping
9    | ownershipRecords mapping
10   | identityRequired
11   | DOMAIN_SEPARATOR (immutable, no slot)
12   | childTraces mapping (NEW)
```

## SDK Type Extensions

### AnchorOptions (Extended)

```typescript
interface AnchorOptions {
  ipfsUri?: string;
  dryRun?: boolean;
  parentTraceHash?: string;  // NEW: Link to parent (0x0 or omit for root)
}
```

### Anchor (Extended)

```typescript
interface Anchor {
  // ... existing fields
  parentTraceHash: string;  // NEW: bytes32 hex
}
```

### New Types

```typescript
interface TraceLineage {
  traceHash: string;
  ancestors: string[];  // Ordered: [self, parent, grandparent, ..., root]
  depth: number;
  root: string;
}

interface TraceTreeNode {
  traceHash: string;
  anchor?: Anchor;  // Optional: include full data
  children: TraceTreeNode[];
  depth: number;
}

interface GetTreeOptions {
  maxDepth?: number;    // Default: 10
  maxNodes?: number;    // Default: 1000
  includeAnchors?: boolean;  // Default: false
}
```
