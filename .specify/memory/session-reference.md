# Agent Anchor - Session Reference Document

**Updated**: 2026-01-30
**Session**: MVP + Ownership Phase 1 Complete + Security Remediation Complete
**Branch**: main
**GitHub**: https://github.com/rxexdxaxcxtxexd/Agent-Anchor

---

## Project Status: OWNERSHIP PHASE 1 COMPLETE

### Implementation Status

| Spec | Status | Tasks | Tests |
|------|--------|-------|-------|
| 001-trace-anchoring-mvp | ✅ Complete | 42/42 | 68 |
| 002-ownership-phase1 | ✅ Complete | 75/75 | 256 |
| 003-security-remediation | ✅ Complete | 40/40 | 324 |

### Test Coverage
- **Contract tests**: 133 passing
- **SDK tests**: 191 passing
- **Total**: 324 tests (100% pass rate)

### Gas Costs (V2 Contract)

| Function | Min | Max | Avg |
|----------|-----|-----|-----|
| anchorTrace | 223,515 | 319,849 | 277,045 |
| bindIdentity | 59,471 | 59,495 | 59,493 |
| setGitMetadata | 36,801 | 54,483 | 52,850 |
| declareAuthorship | 51,589 | 51,613 | 51,608 |
| setContribution | 34,976 | 64,341 | 48,996 |

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

### MVP Specification (COMPLETE)
Full specifications at: `C:\Users\layden\specs\001-trace-anchoring-mvp\`
- `spec.md` - Full specification
- `plan.md` - Implementation plan
- `tasks.md` - 80 tasks (42 MVP)
- `quickstart.md` - Getting started
- `contracts/AgentAnchor.abi.json` - Contract ABI

### Ownership Phase 1 Specification (PLANNED)
Full specifications at: `C:\Users\layden\specs\002-ownership-phase1\`
- `spec.md` - 4 user stories (Identity, Git, Authorship, Contribution)
- `plan.md` - Technical implementation plan with architecture decisions
- `data-model.md` - Struct definitions, storage layout, EIP-712 types
- `tasks.md` - 75 tasks across 7 phases
- `quickstart.md` - Usage examples for all ownership features
- `research.md` - EIP-712 patterns, gas optimization, legal considerations
- `contracts/AgentAnchorV2.abi.json` - V2 contract ABI
- `checklists/requirements.md` - Functional & non-functional requirements

### Security Remediation Specification (CRITICAL - Before Mainnet)
Full specifications at: `C:\Users\layden\specs\003-security-remediation\`
- `spec.md` - 5 security findings + 5 quality issues with fixes
- `tasks.md` - 40 tasks across 4 phases

---

## Ownership Phase 1 Summary

**Status**: ✅ COMPLETE (All 75 tasks implemented)
**Contract**: AgentAnchorV2.sol (new, V1 unchanged)
**Location**: `packages/contracts/contracts/AgentAnchorV2.sol`

### User Stories - All Implemented
| Story | Priority | Status | Description |
|-------|----------|--------|-------------|
| US1 | P1 | ✅ | Identity Binding - EIP-712 signatures for session initiator |
| US2 | P2 | ✅ | Git Commit Linking - Connect traces to git commits |
| US3 | P2 | ✅ | Declaration of Authorship - Legal ownership claims |
| US4 | P3 | ✅ | Contribution Percentage - Human vs AI ratio tracking |

### Phases Completed
| Phase | Description | Tasks |
|-------|-------------|-------|
| 1 | Setup (interfaces, types) | T001-T008 ✅ |
| 2 | Identity Binding (US1) | T009-T022 ✅ |
| 3 | Git Commit Linking (US2) | T023-T034 ✅ |
| 4 | Authorship (US3) | T035-T045 ✅ |
| 5 | Contribution (US4) | T046-T057 ✅ |
| 6 | Integration | T058-T066 ✅ |
| 7 | Polish & Documentation | T067-T075 ✅ |

### Key Files Added
- `packages/contracts/contracts/AgentAnchorV2.sol` - V2 contract
- `packages/contracts/contracts/libraries/OwnershipTypes.sol` - Packed structs
- `packages/contracts/contracts/interfaces/I*.sol` - 4 interfaces
- `packages/sdk/src/clientV2.ts` - V2 SDK client
- `packages/sdk/src/identity.ts` - EIP-712 signing
- `packages/sdk/src/git.ts` - Git metadata extraction
- `packages/sdk/src/authorship.ts` - Authorship helpers
- `packages/sdk/src/contribution.ts` - Contribution validation

---

## Next Steps Options

1. **Deploy MVP to testnet** - V1 contract ready for Polygon Amoy / Base Sepolia
2. **Implement Ownership Phase 1** - Start with US1 (Identity Binding) for quick win
3. **Both** - Deploy MVP, then add V2 contract with ownership features
4. **Continue MVP polish** - Phases 5-8 (Query, SDK Polish, Multi-Chain, Docs)

---

## Research Sources

- [Cursor Agent Trace Spec](https://github.com/cursor/agent-trace)
- [Stanford CodeX: Blockchain IP Tools](https://law.stanford.edu/2025/01/30/a-collaborative-effort-to-design-and-promote-blockchain-based-ip-tools-and-standards-for-rightful-generative-ai/)
- [arXiv: Blockchain for AI Copyrights](https://arxiv.org/abs/2404.06077)
- [AI Code Enterprise Adoption](https://getdx.com/blog/ai-code-enterprise-adoption/)
- [Software Liability & AI Compliance](https://threatrix.io/blog/threatrix/software-liability-in-2025-ai-generated-code-compliance-regulatory-risks/)

---

## Security Review Findings (2026-01-30)

### All Issues Resolved ✅

| ID | Finding | Severity | Fix | Status |
|----|---------|----------|-----|--------|
| SEC-001 | Unbounded `ipfsUri` string storage | High | `MAX_IPFS_URI_LENGTH = 256` | ✅ Fixed |
| SEC-002 | Unbounded arrays in getTracesByAgent/Creator | Medium | Paginated functions added | ✅ Fixed |
| SEC-003 | No access control on anchorTrace | Medium | Documented permissionless design | ✅ Fixed |
| SEC-004 | IPFS upload/fetch lacks size limits | Medium | `MAX_UPLOAD_SIZE`, `MAX_FETCH_SIZE` | ✅ Fixed |
| SEC-005 | CID parsing overly permissive | Low | `isValidCid()` with regex | ✅ Fixed |

### Quality Issues Resolved ✅

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| QA-001 | verifyTrace returns placeholder fields | Added `getAnchor()` call | ✅ Fixed |
| QA-002 | CLI --creator flag not implemented | Implemented in V2 CLI | ✅ Fixed |
| QA-003 | Empty contract addresses in config | Deployment instructions added | ✅ Fixed |
| QA-004 | Shallow input validation in validateTrace | Timestamp/content validation | ✅ Fixed |
| QA-005 | hashTrace breaks with non-JSON types | JSDoc documentation | ✅ Fixed |

### Security Documentation Added
- `SECURITY.md` - Security policy and known limitations
- `packages/sdk/README.md` - Security considerations section
- `packages/contracts/contracts/AgentAnchor.sol` - Enhanced NatSpec for SEC-003
- `specs/002-ownership-phase1/checklists/security.md` - Security checklist (39/39 pass)

---

*This reference ensures session continuity for the Agent Anchor project.*
