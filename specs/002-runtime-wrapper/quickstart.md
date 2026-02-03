# Quickstart: Agent Anchor Runtime Wrapper

**Feature**: 002-runtime-wrapper
**Date**: 2026-02-02
**Time to First Trace**: Under 5 minutes

## Overview

The Agent Anchor Runtime Wrapper lets you add tamper-evident trace anchoring to any AI agent with a single line of code. No changes to your existing agent code required.

## Prerequisites

- Node.js 18+ or modern browser (Chrome 90+, Firefox 90+, Safari 15+)
- An Ethereum-compatible wallet OR private key
- Your existing AI agent code

## Installation

```bash
npm install @agent-anchor/sdk
```

## Basic Usage (5 Minutes)

### Step 1: Import the Runtime

```typescript
import { AgentAnchorRuntime } from '@agent-anchor/sdk/runtime';
```

### Step 2: Wrap Your Agent

```typescript
// Your existing agent (unchanged)
const myAgent = new MyAIAgent();

// Wrap it with one line
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: process.env.AGENT_ANCHOR_KEY,
});

// Use wrapped.agent exactly like your original agent
const result = await wrapped.agent.makeDecision(userInput);
```

That's it! Every method call on `wrapped.agent` is now automatically:
1. Captured with timestamp, inputs, and outputs
2. Signed cryptographically for tamper-evidence
3. Anchored to the blockchain

## Configuration Options

### Consistency Modes

Choose how strictly anchoring is enforced:

```typescript
// SYNC (default) - Halt on anchor failure
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  consistencyMode: 'sync',  // Default - safest for compliance
});

// ASYNC - Continue immediately, anchor in background
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  consistencyMode: 'async',  // Faster, eventual consistency
});

// CACHE - Batch anchors for efficiency
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  consistencyMode: 'cache',
  cacheFlushInterval: 30000,  // Flush every 30 seconds
});

// TWO-PHASE - Local signing + async chain write
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  consistencyMode: 'two-phase',  // Best of both worlds
});
```

### Wallet Connection (Browser)

For blockchain-native users who prefer MetaMask:

```typescript
// Connect MetaMask
await AgentAnchorRuntime.connectWallet({ type: 'injected' });

// Or WalletConnect for mobile
await AgentAnchorRuntime.connectWallet({
  type: 'walletconnect',
  projectId: 'your-project-id',
});

// Then wrap without privateKey
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  consistencyMode: 'sync',
});
```

### Multi-Chain Support

```typescript
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  chain: 'polygon',  // 'polygon' | 'base' | 'ethereum' | 'sepolia'
});
```

### Sensitive Data Redaction

Automatically redact PII before anchoring:

```typescript
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  redaction: {
    enabled: true,
    builtins: true,  // SSN, credit cards, API keys
    patterns: [
      { name: 'internal-id', pattern: /INTERNAL_\w+/g },
    ],
  },
});
```

## Monitoring & Callbacks

Track anchor status in real-time:

```typescript
const wrapped = AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  callbacks: {
    onActionCaptured: (entry) => {
      console.log(`Captured: ${entry.method}`);
    },
    onAnchorConfirmed: (record, receipt) => {
      console.log(`Anchored in block ${receipt.blockNumber}`);
    },
    onAnchorFailed: (record, error) => {
      console.error(`Anchor failed: ${error.message}`);
      // Alert your monitoring system
    },
  },
});
```

## Managing Pending Actions

When anchors fail (network issues, gas spikes), you can resolve them:

```typescript
// View all pending (unconfirmed) records
const pending = await wrapped.getPendingRecords();

for (const record of pending) {
  console.log(`Pending: ${record.traceEntry.method} at ${record.createdAt}`);

  // Option 1: Retry anchoring
  const status = await wrapped.retryAnchor(record.hash);

  // Option 2: Accept local record as sufficient
  // (for compliance, you may need on-chain, but local is signed evidence)
  await wrapped.markLocallyVerified(record.hash);
}
```

## Verification

Get proof that an action was anchored:

```typescript
// Get block explorer URL
const url = await wrapped.getExplorerUrl(recordHash);
console.log(`Verify on-chain: ${url}`);

// Check anchor status
const status = await wrapped.getAnchorStatus(recordHash);
console.log(`Status: ${status.status}`);  // 'confirmed', 'pending', etc.
```

## Full Example

```typescript
import { AgentAnchorRuntime } from '@agent-anchor/sdk/runtime';
import { MyAIAgent } from './my-agent';

async function main() {
  // Create your agent
  const agent = new MyAIAgent({
    model: 'gpt-4',
    systemPrompt: 'You are a helpful assistant.',
  });

  // Wrap for trace anchoring
  const wrapped = AgentAnchorRuntime.wrap(agent, {
    privateKey: process.env.AGENT_ANCHOR_KEY,
    consistencyMode: 'sync',
    chain: 'base',
    redaction: { enabled: true, builtins: true },
    callbacks: {
      onAnchorConfirmed: (record, receipt) => {
        console.log(`[ANCHORED] ${record.traceEntry.method} -> block ${receipt.blockNumber}`);
      },
    },
  });

  // Use the agent normally - traces are automatic
  const response = await wrapped.agent.chat('What is the capital of France?');
  console.log(response);

  // Check storage stats
  const stats = await wrapped.getStorageStats();
  console.log(`${stats.confirmedRecords} actions anchored on-chain`);
}

main().catch(console.error);
```

## Next Steps

- **[API Reference](./contracts/runtime-api.ts)**: Full TypeScript interface definitions
- **[Data Model](./data-model.md)**: Entity relationships and state transitions
- **[Research Notes](./research.md)**: Technical decisions and alternatives considered

## Troubleshooting

### "Anchor failed" errors in sync mode

Your agent will halt if anchoring fails. Options:
1. Switch to `async` or `two-phase` mode for resilience
2. Increase `maxRetries` (default: 3)
3. Use `gasStrategy: 'aggressive'` during network congestion

### High latency in sync mode

Sync mode waits for chain confirmation (2-15 seconds). For faster iteration:
1. Use `async` or `cache` mode during development
2. Switch to `sync` for production compliance requirements

### "Storage warning" callback firing

Your local cache is approaching capacity. Options:
1. Increase `localCacheLimit` (default: 10,000)
2. Ensure anchors are confirming (check pending records)
3. Manually flush with `wrapped.flushCache()`
