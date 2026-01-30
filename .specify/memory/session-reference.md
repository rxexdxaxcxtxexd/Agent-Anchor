# Agent Anchor - Session Reference Document

**Created**: 2026-01-29
**Project**: Agent Anchor MVP (On-Chain Trace Anchoring Protocol)
**Branch**: 001-trace-anchoring-mvp

---

## Project Overview

Agent Anchor is an on-chain trace anchoring protocol that extends Cursor's Agent Trace specification with blockchain-based verification. It enables verifiable, tamper-proof records of AI agent actions on Polygon and Base blockchains.

### Core Value Proposition
- **Immutability**: Blockchain anchoring prevents trace tampering
- **Verifiability**: Anyone can verify trace authenticity
- **Decentralization**: IPFS storage + multi-chain support
- **Developer-Friendly**: TypeScript SDK with CLI tools

---

## Spec-Kit Setup (CRITICAL - Windows Fix)

### Installation
```bash
uv tool install specify-cli
```

### Windows Encoding Fix
**File**: `C:\Users\layden\AppData\Roaming\uv\tools\specify-cli\Lib\site-packages\specify_cli\__init__.py`

**Fix 1** - Add after imports (~line 30):
```python
# Fix Windows console encoding for Unicode support
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
```

**Fix 2** - Modify show_banner() (~line 444):
```python
def show_banner():
    """Display the ASCII art banner."""
    try:
        banner_lines = BANNER.strip().split('\n')
        colors = ["bright_blue", "blue", "cyan", "bright_cyan", "white", "bright_white"]
        styled_banner = Text()
        for i, line in enumerate(banner_lines):
            color = colors[i % len(colors)]
            styled_banner.append(line + "\n", style=color)
        console.print(Align.center(styled_banner))
        console.print(Align.center(Text(TAGLINE, style="italic bright_yellow")))
        console.print()
    except (UnicodeEncodeError, UnicodeDecodeError, Exception) as e:
        if "charmap" in str(e) or "encode" in str(e).lower():
            print("\n  SPECIFY - GitHub Spec Kit")
            print(f"  {TAGLINE}\n")
        else:
            raise
```

**Fix 3** - Change Console initialization (line 425):
```python
console = Console(force_terminal=True, legacy_windows=False)
```

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin |
| SDK | TypeScript, ethers.js v6, tsup bundler |
| CLI | Commander.js |
| Testing | Vitest (SDK), Hardhat/Chai (contracts) |
| IPFS | web3.storage |
| Chains | Polygon Amoy, Base Sepolia (testnets) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
agent-anchor/
├── packages/
│   ├── contracts/           # Solidity smart contracts
│   │   ├── contracts/
│   │   │   └── AgentAnchor.sol
│   │   ├── test/
│   │   └── hardhat.config.ts
│   └── sdk/                 # TypeScript SDK + CLI
│       ├── src/
│       │   ├── client.ts
│       │   ├── types.ts
│       │   ├── ipfs.ts
│       │   └── utils.ts
│       ├── bin/cli.ts
│       └── test/
├── .specify/                # Spec-kit memory
│   └── memory/
│       ├── constitution.md
│       └── session-reference.md (this file)
└── pnpm-workspace.yaml
```

---

## Constitution Principles (5 Core)

1. **Smart Contract Safety** (NON-NEGOTIABLE)
   - 95%+ test coverage for critical paths
   - OpenZeppelin patterns
   - No unbounded loops, reentrancy, overflow

2. **Test-First Development**
   - TDD mandatory: Red-Green-Refactor
   - Tests before implementation

3. **Multi-Chain Portability**
   - Polygon + Base support
   - Externalized configuration
   - No chain-specific opcodes

4. **SDK Developer Experience**
   - TypeScript-first with full types
   - ESM + CJS bundles
   - JSDoc on all public APIs

5. **Observability & Auditability**
   - Events for all state changes
   - Configurable logging
   - Dry-run mode support

---

## User Stories

| ID | Priority | Description |
|----|----------|-------------|
| US1 | P1 | Anchor trace to IPFS + blockchain |
| US2 | P1 | Verify anchor authenticity |
| US3 | P2 | Query traces by agent ID |
| US4 | P2 | SDK programmatic integration |
| US5 | P3 | Multi-chain deployment |

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

// Event emitted on anchor
event TraceAnchored(
    bytes32 indexed traceHash,
    bytes32 indexed agentId,
    address indexed creator
)
```

---

## Task Summary (80 Total)

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 7 | Setup (monorepo, tooling) |
| 2 | 11 | Foundational (contract + SDK skeletons) |
| 3 | 14 | US1: Anchor functionality |
| 4 | 10 | US2: Verify functionality |
| 5 | 9 | US3: Query functionality |
| 6 | 8 | US4: SDK polish |
| 7 | 9 | US5: Multi-chain |
| 8 | 12 | Polish & documentation |

**MVP = Phases 1-4 = 42 tasks**

---

## Success Criteria

- Anchor operation: < 30 seconds
- Verify operation: < 5 seconds
- Gas cost: < $0.10 USD
- SDK bundle: < 100KB gzipped
- Test coverage: 95%+ critical paths

---

## Key File Locations

| File | Path |
|------|------|
| Constitution | `.specify/memory/constitution.md` |
| Specification | `C:\Users\layden\specs\001-trace-anchoring-mvp\spec.md` |
| Plan | `C:\Users\layden\specs\001-trace-anchoring-mvp\plan.md` |
| Tasks | `C:\Users\layden\specs\001-trace-anchoring-mvp\tasks.md` |
| ABI | `C:\Users\layden\specs\001-trace-anchoring-mvp\contracts\AgentAnchor.abi.json` |
| Quickstart | `C:\Users\layden\specs\001-trace-anchoring-mvp\quickstart.md` |
| Data Model | `C:\Users\layden\specs\001-trace-anchoring-mvp\data-model.md` |
| Research | `C:\Users\layden\specs\001-trace-anchoring-mvp\research.md` |

---

## Next Steps

1. **Run /speckit.implement** to begin building Phase 1 tasks
2. Start with T001: Create monorepo root with pnpm-workspace.yaml
3. Follow TDD approach per constitution

---

## Spec-Kit Commands Reference

```bash
specify constitution    # Define project principles
specify specify         # Create formal specification
specify plan           # Generate implementation plan
specify tasks          # Generate task breakdown
specify implement      # Begin implementation
```

---

*This reference document ensures session continuity for the Agent Anchor project.*
