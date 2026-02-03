# @agent-anchor/sdk

TypeScript SDK for anchoring AI agent traces to the blockchain.

## Installation

```bash
npm install @agent-anchor/sdk
# or
pnpm add @agent-anchor/sdk
```

## Quick Start

```typescript
import { AgentAnchorClient } from '@agent-anchor/sdk';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const client = new AgentAnchorClient({
  network: 'base-testnet',
  signer,
});

// Create and anchor a trace
const trace = {
  version: '1.0.0',
  traceId: 'session-123',
  agentId: 'my-agent',
  timestamp: new Date().toISOString(),
  granularity: 0, // Session
  content: { task: 'Implement feature X' },
};

const result = await client.anchorTrace(trace);
console.log('Anchored:', result.traceHash);
```

## Runtime Wrapper (Zero-Code Tracing)

The Runtime Wrapper enables automatic trace anchoring for any AI agent with a single line of code. No modifications to your existing agent code required.

### Basic Usage

```typescript
import { AgentAnchorRuntime } from '@agent-anchor/sdk/runtime';

// Your existing agent (unchanged)
const myAgent = new MyAIAgent();

// Wrap it with one line
const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
  privateKey: process.env.AGENT_ANCHOR_KEY,
});

// Use wrapped.agent exactly like your original agent
// All method calls are now automatically traced and anchored
const result = await wrapped.agent.makeDecision(userInput);
```

### Consistency Modes

Choose how strictly anchoring is enforced:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `sync` (default) | Halts on anchor failure | Compliance-critical deployments |
| `async` | Anchors in background | Fast iteration, eventual consistency |
| `cache` | Batches anchors periodically | High-throughput, cost efficiency |
| `two-phase` | Local signing + async chain write | Balance of speed and evidence |

```typescript
const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  consistencyMode: 'async',  // or 'sync', 'cache', 'two-phase'
});
```

### Sensitive Data Redaction

Automatically redact PII before anchoring:

```typescript
const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  redaction: {
    enabled: true,
    builtins: true,  // SSN, credit cards, API keys
    patterns: [
      { name: 'custom-id', pattern: /INTERNAL_\w+/g },
    ],
  },
});
```

### Monitoring Callbacks

Track anchor status in real-time:

```typescript
const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
  privateKey: key,
  callbacks: {
    onActionCaptured: (entry) => console.log(`Captured: ${entry.method}`),
    onAnchorConfirmed: (record, receipt) => console.log(`Block: ${receipt.blockNumber}`),
    onAnchorFailed: (record, error) => console.error(`Failed: ${error.message}`),
  },
});
```

### Wallet Connection (Browser)

For blockchain-native users:

```typescript
// Connect MetaMask
await AgentAnchorRuntime.connectWallet({ type: 'injected' });

// Then wrap without privateKey
const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
  consistencyMode: 'sync',
});
```

For the complete Runtime Wrapper guide, see [specs/002-runtime-wrapper/quickstart.md](../../specs/002-runtime-wrapper/quickstart.md).

## Security Considerations

### Permissionless Design

The AgentAnchor contract is **permissionless by default**. This means:

1. **Anyone can anchor traces**: No authentication required to call `anchorTrace()`
2. **Agent IDs are not verified**: Anyone can anchor a trace claiming any `agentId`
3. **Creator address = submitter**: The `creator` field only proves who submitted the transaction, not who controls the agent

### Recommendations

- **Use V2 identity binding** for stronger attribution via EIP-712 signatures
- **Verify traces off-chain** before trusting them
- **Use paginated queries** for large datasets to avoid gas limits (SEC-002)
- **Validate IPFS content size** before fetching (max 10MB by default)

### Input Validation

The SDK validates:
- **IPFS URI length**: Max 256 bytes (SEC-001)
- **CID format**: Validates CIDv0 and CIDv1 formats (SEC-005)
- **Upload size**: Max 10MB for uploads and fetches (SEC-004)
- **Timestamp format**: ISO 8601 required
- **Trace content**: Required field validation

### Known Limitations

1. **No on-chain agent verification**: The contract cannot verify if a trace actually came from the claimed agent
2. **Mutable IPFS content**: IPFS URIs should use immutable CIDs; the contract does not verify content integrity
3. **Block timestamp dependency**: Anchor timestamps use `block.timestamp` which can vary by a few seconds

## API Reference

### AgentAnchorClient

#### Constructor Options

```typescript
interface ClientOptions {
  network: Network;           // 'base-testnet' | 'base-mainnet' | 'polygon-testnet' | 'polygon-mainnet' | 'localhost'
  signer: ethers.Signer;      // Wallet for signing transactions
  contractAddress?: string;   // Override default contract address
  ipfsToken?: string;         // Web3.Storage token for IPFS uploads
}
```

#### Methods

- `anchorTrace(trace)` - Anchor a trace to the blockchain
- `verifyTrace(traceHash)` - Verify a trace exists and get metadata
- `getTracesByAgent(agentId)` - Get all traces for an agent
- `getTracesByCreator(address)` - Get all traces for a creator
- `getTracesByAgentPaginated(agentId, offset, limit)` - Paginated agent query
- `getTracesByCreatorPaginated(address, offset, limit)` - Paginated creator query

### AgentAnchorClientV2

Extends V1 with ownership layer features for cryptographic identity binding, git commit linking, authorship declarations, and contribution tracking.

#### V2 Constructor Options

```typescript
interface ClientOptionsV2 {
  network: Network;              // Same as V1
  signer: ethers.Signer;         // Wallet for signing
  contractAddress?: string;      // V2 contract address override
  ipfsToken?: string;            // Web3.Storage token
  requireIdentity?: boolean;     // Fail if identity not provided
}
```

#### V2 Methods

| Method | Description | Gas (avg) |
|--------|-------------|-----------|
| `anchorTraceV2(trace, options)` | Anchor with ownership options | 277,045 |
| `bindIdentity(traceHash, signature)` | Bind EIP-712 identity | 59,493 |
| `setGitMetadata(traceHash, metadata)` | Link to git commit | 52,850 |
| `declareAuthorship(traceHash, type)` | Declare ownership | 51,608 |
| `setContribution(traceHash, ratio)` | Set human/AI ratio | 48,996 |
| `verifyIdentity(traceHash)` | Verify identity binding | view |
| `getOwnershipRecord(traceHash)` | Get all ownership data | view |

#### V2 Types

```typescript
// Declaration types for authorship claims
enum DeclarationType {
  SoleAuthor = 0,      // Individual ownership
  JointAuthor = 1,     // Multiple authors
  CoAuthor = 2         // Collaborative work
}

// Contribution ratio
interface ContributionRatio {
  humanPercent: number;  // 0-100
  aiPercent: number;     // 0-100 (must sum to 100)
  notes?: string;        // Optional explanation
}

// Git metadata
interface GitMetadata {
  commitSha: string;     // bytes32 format
  branch?: string;
  repository?: string;
}
```

#### V2 Quick Start

```typescript
import { AgentAnchorClientV2, DeclarationType } from '@agent-anchor/sdk';

const client = new AgentAnchorClientV2({
  network: 'base-testnet',
  signer,
});

// Anchor with full ownership
const result = await client.anchorTraceV2(trace, {
  identity: { signer, purpose: 'code-authorship' },
  git: { commitSha: '0x...', branch: 'main' },
  authorship: { declarationType: DeclarationType.SoleAuthor },
  contribution: { humanPercent: 70, aiPercent: 30 },
});

// Query ownership record
const record = await client.getOwnershipRecord(result.traceHash);
console.log('Identity verified:', record.identityVerified);
console.log('Human contribution:', record.humanPercent + '%');
```

## CLI Usage

### V1 Commands

```bash
# Anchor a trace
agent-anchor anchor ./trace.json --network base-testnet

# Verify a trace
agent-anchor verify 0x123... --network base-testnet

# List traces by agent or creator
agent-anchor list --agent my-agent --network base-testnet
agent-anchor list --creator 0x123... --network base-testnet
```

### V2 Commands (Ownership Layer)

```bash
# Anchor with ownership features
agent-anchor anchor-v2 ./trace.json --network base-testnet \
  --identity \                    # Bind EIP-712 identity
  --git \                         # Auto-detect git metadata
  --authorship sole \             # Declare authorship (sole|joint|co)
  --contribution 70/30            # Human/AI ratio

# Verify with ownership info
agent-anchor verify-v2 0x123... --network base-testnet

# Set identity on existing trace
agent-anchor set-identity 0x123... --network base-testnet

# Set git metadata
agent-anchor set-git 0x123... --auto --network base-testnet
agent-anchor set-git 0x123... --commit abc123 --branch main --network base-testnet

# Declare authorship
agent-anchor declare-authorship 0x123... sole --network base-testnet

# Set contribution ratio
agent-anchor set-contribution 0x123... 70 30 \
  --notes "Human designed, AI implemented" \
  --network base-testnet
```

## Environment Variables

```bash
PRIVATE_KEY=0x...              # Wallet private key
RPC_URL=https://...            # RPC endpoint (optional, uses default for network)
WEB3_STORAGE_TOKEN=...         # For IPFS uploads
AGENT_ANCHOR_ADDRESS=0x...     # Override contract address
```

## Contract Deployment

The SDK includes pre-configured contract addresses for supported networks. For custom deployments:

### Deploying Contracts

1. Navigate to the contracts package:
   ```bash
   cd packages/contracts
   ```

2. Configure deployment settings in `hardhat.config.ts` with your network RPC URLs and deployer private key.

3. Deploy to a network:
   ```bash
   # Deploy to testnet
   npx hardhat run scripts/deploy.ts --network base-sepolia

   # Deploy V2 contract (with ownership layer)
   npx hardhat run scripts/deploy-v2.ts --network base-sepolia
   ```

4. Note the deployed contract address from the output.

### Updating SDK Constants

After deployment, update `packages/sdk/src/constants.ts`:

```typescript
export const NETWORKS: Record<Network, NetworkConfig> = {
  'base-testnet': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    contractAddress: '0xYOUR_DEPLOYED_ADDRESS', // Update this
    // ...
  },
  // ...
};
```

### Custom Contract Address at Runtime

You can also provide a contract address at runtime without modifying constants:

```typescript
const client = new AgentAnchorClient({
  network: 'base-testnet',
  contractAddress: '0xYOUR_DEPLOYED_ADDRESS',  // Override default
  privateKey: process.env.PRIVATE_KEY,
});
```

### Supported Networks

| Network | Chain ID | Explorer |
|---------|----------|----------|
| Base Sepolia (testnet) | 84532 | https://sepolia.basescan.org |
| Base Mainnet | 8453 | https://basescan.org |
| Polygon Amoy (testnet) | 80002 | https://amoy.polygonscan.com |
| Polygon Mainnet | 137 | https://polygonscan.com |
| Localhost | 31337 | - |

## License

MIT
