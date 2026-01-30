# Agent Anchor - Session Reference Document

**Updated**: 2026-01-29
**Session**: MVP Complete + Strategic Analysis
**Branch**: main
**GitHub**: https://github.com/rxexdxaxcxtxexd/Agent-Anchor

---

## Project Status: MVP COMPLETE

### Commits History
| Commit | Phase | Description |
|--------|-------|-------------|
| `ebdf422` | - | Initial implementation plan (remote) |
| `42f1958` | 1 | Project setup & monorepo |
| `1fa1d1d` | 2 | Smart contract foundation |
| `01e117f` | 3 | US1: Anchor a Trace |
| `4cb7c4e` | 4 | US2: Verify a Trace |

### Test Coverage
- **Contract tests**: 30 passing (100% coverage)
- **SDK tests**: 38 passing
- **Total**: 68 tests

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin patterns |
| SDK | TypeScript, ethers.js v6, tsup bundler |
| CLI | Commander.js |
| Testing | Vitest (SDK), Hardhat/Chai (contracts) |
| IPFS | web3.storage integration |
| Chains | Polygon Amoy (80002), Base Sepolia (84532) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
agent-anchor/
├── .github/workflows/ci.yml       # GitHub Actions CI
├── .specify/memory/               # Spec-kit memory
│   ├── constitution.md            # 5 core principles
│   └── session-reference.md       # This file
├── packages/
│   ├── contracts/
│   │   ├── contracts/AgentAnchor.sol  # Main contract
│   │   ├── test/                      # 30 tests
│   │   └── hardhat.config.ts
│   └── sdk/
│       ├── src/
│       │   ├── client.ts          # AgentAnchorClient
│       │   ├── ipfs.ts            # IPFS upload/fetch
│       │   ├── cli.ts             # CLI commands
│       │   ├── types.ts           # TypeScript types
│       │   ├── utils.ts           # Hash, validation
│       │   └── constants.ts       # Network configs
│       └── test/                  # 38 tests
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Smart Contract ABI (Key Functions)

```solidity
// Anchor a trace
function anchorTrace(
    bytes32 traceHash,
    string ipfsUri,
    bytes32 agentId,
    uint8 granularity
) returns (bool)

// Verify a trace
function verifyTrace(bytes32 traceHash) view returns (
    bool exists,
    string ipfsUri,
    address creator,
    uint256 timestamp
)

// Query by agent
function getTracesByAgent(bytes32 agentId) view returns (bytes32[])

// Event
event TraceAnchored(
    bytes32 indexed traceHash,
    bytes32 indexed agentId,
    address indexed creator
)
```

---

## CLI Commands

```bash
# Anchor a trace file
agent-anchor anchor ./trace.json --network base-testnet

# Verify on-chain
agent-anchor verify 0xabc... --network base-testnet --full

# List by agent
agent-anchor list --agent my-agent-id

# Validate locally
agent-anchor validate ./trace.json

# Compute hash
agent-anchor hash ./trace.json
```

---

## Spec-Kit Windows Fix (CRITICAL)

**File**: `C:\Users\layden\AppData\Roaming\uv\tools\specify-cli\Lib\site-packages\specify_cli\__init__.py`

Three fixes required for Windows:

1. **UTF-8 encoding** (after imports):
```python
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
```

2. **show_banner() try/except** with fallback for Unicode errors

3. **Console initialization**:
```python
console = Console(force_terminal=True, legacy_windows=False)
```

---

## Strategic Analysis (2026-01-29)

### Current Value Proposition Gap

Agent Trace explicitly does NOT track code ownership. It tracks:
- What model was used
- Which lines were AI-touched

It does NOT prove:
- Who instructed the agent
- Who approved the output
- Legal ownership claims

**Current state**: Blockchain adds immutability to data not structured for ownership claims.

### Recommended Improvements

#### Phase 1: Quick Wins (1-2 weeks)
| Feature | Description |
|---------|-------------|
| Identity Binding | Cryptographic signature from human who initiated session |
| Git Commit Linking | Store commit SHA + GPG signature with trace |
| Declaration of Authorship | Explicit ownership claims in trace schema |
| Contribution Percentage | Human vs AI contribution estimates |

#### Phase 2: Features (2-4 weeks)
| Feature | Description |
|---------|-------------|
| Delegation Registry | On-chain "Entity X authorizes Agent Y for Repo Z" |
| Work Order NFTs | Auditable task assignments |
| Multi-sig Approval | N-of-M signatures before anchoring |
| Dispute Mechanism | Counter-claims within grace period |
| License Compliance | Check against GPL/Apache dependencies |

#### Phase 3: Enterprise-Ready (1-3 months)
| Feature | Description |
|---------|-------------|
| Legal Template Integration | Smart contracts encoding CLAs |
| EU AI Act Compliance | Regulatory reporting (Aug 2026 deadline) |
| Enterprise SSO | Link wallets to corporate identities |
| Audit Export | Compliance reports for legal/finance |
| Cross-Repository Lineage | Track code movement between repos |

### Core Problem to Solve

Transform from: **"Did this trace exist at this time?"**

To answering:
1. "Who authorized this work?" → Identity + delegation
2. "What was delivered?" → Git linking + content hash
3. "Who has legal claim?" → Ownership declarations + disputes
4. "Is this compliant?" → License checking + regulatory reporting

---

## Key File Locations

| File | Path |
|------|------|
| Constitution | `.specify/memory/constitution.md` |
| This Reference | `.specify/memory/session-reference.md` |
| Main Contract | `packages/contracts/contracts/AgentAnchor.sol` |
| SDK Client | `packages/sdk/src/client.ts` |
| CLI | `packages/sdk/src/cli.ts` |
| Contract Tests | `packages/contracts/test/` |
| SDK Tests | `packages/sdk/test/` |

---

## Specs Location (External)

Full specifications at: `C:\Users\layden\specs\001-trace-anchoring-mvp\`
- `spec.md` - Full specification
- `plan.md` - Implementation plan
- `tasks.md` - 80 tasks (42 MVP)
- `quickstart.md` - Getting started
- `contracts/AgentAnchor.abi.json` - Contract ABI

---

## Next Steps Options

1. **Deploy to testnet** - Contract is ready for Polygon Amoy / Base Sepolia
2. **Phase 5-8** - Continue with Query, SDK Polish, Multi-Chain, Documentation
3. **Strategic pivot** - Implement Phase 1 ownership improvements
4. **Both** - Deploy MVP, then iterate with ownership features

---

## Research Sources

- [Cursor Agent Trace Spec](https://github.com/cursor/agent-trace)
- [Stanford CodeX: Blockchain IP Tools](https://law.stanford.edu/2025/01/30/a-collaborative-effort-to-design-and-promote-blockchain-based-ip-tools-and-standards-for-rightful-generative-ai/)
- [arXiv: Blockchain for AI Copyrights](https://arxiv.org/abs/2404.06077)
- [AI Code Enterprise Adoption](https://getdx.com/blog/ai-code-enterprise-adoption/)
- [Software Liability & AI Compliance](https://threatrix.io/blog/threatrix/software-liability-in-2025-ai-generated-code-compliance-regulatory-risks/)

---

*This reference ensures session continuity for the Agent Anchor project.*
