# Agent Anchor - Implementation Plan

## Overview
**Agent Anchor** is an on-chain trace anchoring protocol that extends Cursor's Agent Trace specification with blockchain-based verification. It enables verifiable, tamper-proof records of AI agent actions.

**Repository**: https://github.com/rxexdxaxcxtxexd/Agent-Anchor

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT ANCHOR PROTOCOL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│   │ Agent Trace  │     │   SDK        │     │  Smart       │    │
│   │ JSON File    │────▶│  (TypeScript)│────▶│  Contract    │    │
│   └──────────────┘     └──────────────┘     └──────────────┘    │
│                              │                     │             │
│                              ▼                     ▼             │
│                         ┌────────┐          ┌───────────┐       │
│                         │  IPFS  │          │ Polygon + │       │
│                         │        │          │   Base    │       │
│                         └────────┘          └───────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Problem We Solve

**Gap in Current Landscape:**
- **Agent Trace** (Cursor): Provides granular action-level attribution but explicitly excludes blockchain verification
- **ERC-8004**: Provides identity and reputation infrastructure but lacks detailed action-level tracing
- **Virtuals Protocol**: Focuses on agent tokenization/economics, not audit trails

**Agent Anchor bridges this gap** by providing verifiable, on-chain proof of what AI agents did - not just who they are or their reputation.

---

## Project Structure

```
agent-anchor/
├── packages/
│   ├── contracts/                 # Solidity smart contracts
│   │   ├── contracts/
│   │   │   └── AgentAnchor.sol
│   │   ├── test/
│   │   │   └── AgentAnchor.test.ts
│   │   ├── scripts/
│   │   │   ├── deploy.ts
│   │   │   └── verify.ts
│   │   ├── hardhat.config.ts
│   │   └── package.json
│   │
│   └── sdk/                       # TypeScript SDK
│       ├── src/
│       │   ├── index.ts           # Main exports
│       │   ├── client.ts          # AgentAnchorClient class
│       │   ├── ipfs.ts            # IPFS upload/fetch
│       │   ├── types.ts           # TypeScript interfaces
│       │   ├── utils.ts           # Hashing, validation
│       │   └── constants.ts       # Contract addresses, ABIs
│       ├── bin/
│       │   └── cli.ts             # CLI entry point
│       ├── test/
│       │   └── client.test.ts
│       ├── tsconfig.json
│       └── package.json
│
├── apps/
│   └── dashboard/                 # Week 4: React dashboard
│       └── (Next.js app)
│
├── docs/
│   ├── README.md
│   ├── SDK.md
│   └── ARCHITECTURE.md
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── package.json                   # Workspace root
├── pnpm-workspace.yaml
└── README.md
```

---

## Phase 1: Smart Contract (Days 1-2)

### Contract: `AgentAnchor.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentAnchor {

    // Granularity levels for trace storage
    // Session = 0: High-level session summary
    // Task = 1: Task-level granularity
    // Step = 2: Fine-grained step-by-step detail
    enum Granularity { Session, Task, Step }

    struct Anchor {
        bytes32 traceHash;        // keccak256 of trace JSON
        string ipfsUri;           // IPFS CID for full trace
        address creator;          // Who anchored this
        uint256 timestamp;        // Block timestamp
        Granularity granularity;  // Trace detail level
        bytes32 agentId;          // Required: agent identifier (hashed)
    }

    // Storage
    mapping(bytes32 => Anchor) public anchors;           // traceHash => Anchor
    mapping(bytes32 => bytes32[]) public agentAnchors;   // agentId => traceHashes[]
    mapping(address => bytes32[]) public creatorAnchors; // creator => traceHashes[]

    // Events
    event TraceAnchored(
        bytes32 indexed traceHash,
        bytes32 indexed agentId,
        address indexed creator,
        string ipfsUri,
        Granularity granularity,
        uint256 timestamp
    );

    // Core Functions
    function anchorTrace(
        bytes32 traceHash,
        string calldata ipfsUri,
        bytes32 agentId,
        Granularity granularity
    ) external returns (bool);

    function verifyTrace(bytes32 traceHash) external view returns (
        bool exists,
        string memory ipfsUri,
        address creator,
        uint256 timestamp
    );

    function getTracesByAgent(bytes32 agentId) external view returns (bytes32[] memory);

    function getTracesByCreator(address creator) external view returns (bytes32[] memory);

    function anchorExists(bytes32 traceHash) external view returns (bool);
}
```

### Deployment Targets

| Network | Type | Chain ID | RPC |
|---------|------|----------|-----|
| Polygon Amoy | Testnet | 80002 | https://rpc-amoy.polygon.technology |
| Polygon Mainnet | Production | 137 | https://polygon-rpc.com |
| Base Sepolia | Testnet | 84532 | https://sepolia.base.org |
| Base Mainnet | Production | 8453 | https://mainnet.base.org |

---

## Phase 2: TypeScript SDK (Days 3-5)

### Core Interfaces

```typescript
// types.ts

// Granularity enum matching the contract
enum Granularity {
  Session = 0,  // High-level session summary
  Task = 1,     // Task-level granularity
  Step = 2,     // Fine-grained step-by-step detail
}

// The trace data structure that gets anchored
interface AgentTrace {
  version: string;          // Schema version (e.g., "1.0.0")
  traceId: string;          // Unique trace identifier
  agentId: string;          // Agent identifier (required)
  sessionId?: string;       // Optional session grouping
  timestamp: string;        // ISO 8601 timestamp
  granularity: Granularity; // Detail level (0, 1, or 2)
  content: unknown;         // Flexible content payload
  metadata?: Record<string, unknown>; // Optional metadata
}

// Result from anchoring a trace
interface AnchorResult {
  success: boolean;
  transactionHash: string;
  blockNumber: number;
  traceHash: string;        // keccak256 of trace JSON
  ipfsUri: string;          // IPFS URI where trace is stored
  gasUsed: bigint;
}

// Result from verifying a trace
interface VerifyResult {
  exists: boolean;
  hashMatches?: boolean;    // True if IPFS content matches on-chain hash
  anchor?: Anchor;          // Full anchor data if exists
  error?: string;           // Error message if verification failed
}

// On-chain anchor record
interface Anchor {
  traceHash: string;
  ipfsUri: string;
  agentId: string;          // bytes32 format
  granularity: Granularity;
  creator: string;          // Address that submitted the anchor
  timestamp: number;        // Block timestamp
  blockNumber: number;
}
```

### SDK Client

```typescript
// client.ts
class AgentAnchorClient {
  constructor(options: {
    network: 'polygon-testnet' | 'polygon' | 'base-testnet' | 'base';
    privateKey?: string;      // For write operations
    ipfsGateway?: string;     // Default: web3.storage
  });

  // Core methods
  async anchorTrace(trace: AgentTrace | string, options?: AnchorOptions): Promise<AnchorResult>;
  async verifyTrace(traceHash: string): Promise<VerifyResult>;
  async getTracesByAgent(agentId: string): Promise<AnchorResult[]>;

  // Utilities
  static hashTrace(trace: AgentTrace | string): string;
  static parseTraceFile(filePath: string): AgentTrace;
}
```

### CLI Commands

```bash
# Anchor a trace
agent-anchor anchor ./trace.json --network base-testnet

# Verify a trace
agent-anchor verify 0xabc123... --network base-testnet

# List traces by agent
agent-anchor list --agent 0xdef456... --network polygon
```

---

## Phase 3: Integration & Testing (Days 6-7)

### End-to-End Test Flow

1. **Create mock Agent Trace** (following Cursor spec)
2. **Upload to IPFS** → get CID
3. **Anchor on-chain** → get tx hash
4. **Verify anchor** → confirm hash matches
5. **Query by agent** → retrieve anchor history

---

## Week 1 Deliverables (MVP)

| Component | Description |
|-----------|-------------|
| Smart Contract | Deployed to Polygon Amoy + Base Sepolia |
| TypeScript SDK | Core client + IPFS + CLI |
| Documentation | README + basic usage guide |
| GitHub Repo | Pushed to rxexdxaxcxtxexd/Agent-Anchor |

---

## Week 2-4 Roadmap

### Week 2: SDK Polish + Python SDK
- Error handling improvements
- Retry logic for IPFS/chain
- Python SDK (mirror TypeScript API)
- Rate limiting for freemium

### Week 3: Dashboard Foundation
- Next.js app setup
- Wallet connection (RainbowKit)
- Anchor submission form
- Verification lookup

### Week 4: Dashboard Complete + Demo
- Trace history view
- Verification badges
- Agent profile pages
- Demo video recording
- Investor deck integration

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | pnpm workspaces | Simple, fast, good for related packages |
| Contract framework | Hardhat | Industry standard, good TypeScript support |
| SDK bundler | tsup | Fast, zero-config, ESM + CJS output |
| IPFS provider | web3.storage | Free tier, reliable, no API key for reads |
| Testing | Vitest + Hardhat | Fast, modern, good DX |
| CLI framework | Commander.js | Mature, well-documented |

---

## Business Model: Freemium SaaS

| Tier | What They Get | Price |
|------|---------------|-------|
| **Free** | 10 anchors/month, basic SDK, community support | $0 |
| **Pro** | 500 anchors/month, priority IPFS pinning, API access | $29/mo |
| **Enterprise** | Unlimited, private storage options, SLA, custom integrations | Custom |

---

## Value Proposition by User Segment

| User Segment | Problem | Solution Value |
|--------------|---------|----------------|
| **Enterprises** | AI audit compliance (EU AI Act) | Immutable audit trail for regulators |
| **Developers** | Prove AI didn't hallucinate code | Verifiable reasoning chain |
| **DAOs** | AI governance transparency | On-chain proof of agent decisions |
| **AI Marketplaces** | Quality assurance | Traceable agent performance history |
| **Legal/Insurance** | Liability attribution | Tamper-proof action records |

---

## Competitive Advantage

| Feature | Agent Trace | ERC-8004 | Virtuals | **Agent Anchor** |
|---------|------------|----------|----------|------------------|
| Action-level tracing | ✓ | ✗ | ✗ | ✓ |
| On-chain anchoring | ✗ | ✓ | ✓ | ✓ |
| Identity integration | ✗ | ✓ | ✓ | ✓ |
| Customizable granularity | ~ | ✗ | ✗ | ✓ |
| Privacy-preserving | ✗ | ~ | ✗ | ✓ (future: zkML) |
| Cross-VCS support | ✓ | ✗ | ✗ | ✓ |
| Regulatory alignment | ✗ | ~ | ✗ | ✓ |

---

## Contact & Links

- **Agent Trace Spec**: https://agent-trace.dev/
- **ERC-8004**: https://8004.org/
- **Cursor GitHub**: https://github.com/cursor/agent-trace
