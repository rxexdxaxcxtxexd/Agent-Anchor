# Quickstart: Trace Linking/Chaining

**Feature**: 001-trace-linking

## Overview

Trace linking enables parent-child relationships between anchored traces, allowing you to:
- Build hierarchical trace structures (session → task → step)
- Query causality chains ("what led to this action?")
- Visualize execution trees for complex agent workflows

## Prerequisites

- `@agent-anchor/sdk` installed
- Private key with testnet funds
- (Optional) Web3.Storage token for IPFS uploads

## Basic Usage

### 1. Create a Root Trace

A root trace has no parent (or `parentTraceHash: 0x0`):

```typescript
import { AgentAnchorClient, Granularity } from '@agent-anchor/sdk';

const client = new AgentAnchorClient({
  network: 'base-testnet',
  privateKey: process.env.PRIVATE_KEY,
});

// Create root trace (session level)
const sessionTrace = {
  version: '1.0.0',
  traceId: 'session-001',
  agentId: 'my-agent',
  timestamp: new Date().toISOString(),
  granularity: Granularity.Session,
  content: { goal: 'Implement feature X' },
};

const sessionResult = await client.anchorTrace(sessionTrace);
console.log('Session anchored:', sessionResult.traceHash);
```

### 2. Link a Child Trace

Link a task trace to the session:

```typescript
// Create task trace linked to session
const taskTrace = {
  version: '1.0.0',
  traceId: 'task-001',
  agentId: 'my-agent',
  timestamp: new Date().toISOString(),
  granularity: Granularity.Task,
  content: { task: 'Write unit tests' },
};

const taskResult = await client.anchorTrace(taskTrace, {
  parentTraceHash: sessionResult.traceHash,  // Link to parent
});

console.log('Task anchored:', taskResult.traceHash);
console.log('Linked to:', sessionResult.traceHash);
```

### 3. Create Multi-Level Hierarchy

Build a complete trace tree:

```typescript
// Step trace linked to task
const stepTrace = {
  version: '1.0.0',
  traceId: 'step-001',
  agentId: 'my-agent',
  timestamp: new Date().toISOString(),
  granularity: Granularity.Step,
  content: {
    action: 'file_write',
    path: 'test/example.test.ts',
  },
};

const stepResult = await client.anchorTrace(stepTrace, {
  parentTraceHash: taskResult.traceHash,
});

// Result: session → task → step
```

## Querying Relationships

### Get Parent Trace

```typescript
const { parentHash, hasParent } = await client.getParentTrace(stepResult.traceHash);

if (hasParent) {
  console.log('Parent:', parentHash);  // task hash
}
```

### Get Child Traces

```typescript
// Get all children of the session
const children = await client.getChildTraces(sessionResult.traceHash);
console.log('Session has', children.length, 'direct children');

// For large datasets, use pagination
const { children: page1, total } = await client.getChildTracesPaginated(
  sessionResult.traceHash,
  0,    // offset
  10    // limit
);
```

### Get Full Lineage (Ancestry)

```typescript
// From step → task → session
const lineage = await client.getTraceLineage(stepResult.traceHash);

console.log('Depth:', lineage.depth);           // 2
console.log('Root:', lineage.root);             // session hash
console.log('Ancestors:', lineage.ancestors);   // [step, task, session]
```

### Get Full Tree (Descendants)

```typescript
// From session → all descendants
const tree = await client.getTraceTree(sessionResult.traceHash, {
  maxDepth: 5,
  includeAnchors: true,  // Include full anchor data
});

function printTree(node, indent = 0) {
  console.log(' '.repeat(indent) + node.traceHash.slice(0, 10) + '...');
  for (const child of node.children) {
    printTree(child, indent + 2);
  }
}

printTree(tree);
// Output:
// 0xabc123... (session)
//   0xdef456... (task)
//     0x789abc... (step)
```

## Error Handling

### Parent Not Found

```typescript
try {
  await client.anchorTrace(trace, {
    parentTraceHash: '0x' + '1'.repeat(64),  // Non-existent
  });
} catch (error) {
  if (error.message.includes('ParentTraceNotFound')) {
    console.error('Parent trace does not exist');
  }
}
```

### Self-Reference Prevention

```typescript
// This will fail - can't be your own parent
const result = await client.anchorTrace(trace);
await client.anchorTrace(anotherTrace, {
  parentTraceHash: result.traceHash,  // OK
});

// Error: SelfReferenceNotAllowed
```

## V2 Integration

Trace linking works with V2 ownership features:

```typescript
import { AgentAnchorClientV2, DeclarationType } from '@agent-anchor/sdk';

const clientV2 = new AgentAnchorClientV2({
  network: 'base-testnet',
  privateKey: process.env.PRIVATE_KEY,
});

// Anchor with linking AND ownership
const result = await clientV2.anchorTraceV2(trace, {
  parentTraceHash: parentHash,
  identity: { purpose: 'code-authorship' },
  contribution: { humanPercent: 30, aiPercent: 70 },
});
```

## Best Practices

1. **Use appropriate granularity**: Session → Task → Step hierarchy
2. **Verify parent exists**: SDK validates automatically, but handle errors
3. **Paginate child queries**: Use `getChildTracesPaginated` for production
4. **Limit tree depth**: Set `maxDepth` to avoid excessive queries
5. **Cache lineage results**: Ancestry doesn't change; safe to cache

## CLI Usage

```bash
# Anchor with parent link
agent-anchor anchor ./trace.json --parent 0xabc123... --network base-testnet

# Query children
agent-anchor children 0xparent... --network base-testnet

# Show lineage
agent-anchor lineage 0xchild... --network base-testnet

# Show tree
agent-anchor tree 0xroot... --depth 3 --network base-testnet
```
