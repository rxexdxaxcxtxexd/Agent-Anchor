# Agent Anchor

**On-chain trace anchoring for AI agents**

Agent Anchor extends [Cursor's Agent Trace specification](https://agent-trace.dev/) with blockchain-based verification, enabling verifiable, tamper-proof records of AI agent actions.

## The Problem

AI agents are increasingly autonomous, but there's no standardized way to prove what they did:

- **Agent Trace** provides granular action-level attribution but explicitly excludes blockchain verification
- **ERC-8004** provides identity/reputation infrastructure but lacks detailed action-level tracing
- Neither bridges the gap between *detailed traces* and *immutable verification*

## The Solution

Agent Anchor provides:

- **Anchored Traces**: Hash your Agent Trace JSON on-chain (Polygon + Base)
- **IPFS Storage**: Full trace data stored on decentralized storage
- **Verification**: Anyone can verify a trace hasn't been tampered with
- **Customizable Granularity**: Full trace, key decisions only, or hash-only

## Quick Start

```bash
# Install the SDK
npm install @agent-anchor/sdk

# Anchor a trace
npx agent-anchor anchor ./trace.json --network base-testnet

# Verify a trace
npx agent-anchor verify 0xabc123... --network base-testnet
```

## Architecture

```
Agent Trace JSON → SDK → IPFS (full data) + Blockchain (hash anchor)
                           ↓
                    Verification endpoint
```

## Deployed Contracts

| Network | Address | Status |
|---------|---------|--------|
| Polygon Amoy (testnet) | TBD | Coming Soon |
| Base Sepolia (testnet) | TBD | Coming Soon |
| Polygon Mainnet | TBD | Planned |
| Base Mainnet | TBD | Planned |

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [SDK Documentation](./docs/SDK.md) (coming soon)
- [Architecture](./docs/ARCHITECTURE.md) (coming soon)

## Roadmap

- **Week 1**: Smart contract + TypeScript SDK + CLI
- **Week 2**: Python SDK + SDK polish
- **Week 3-4**: Dashboard + Demo

## Related Projects

- [Agent Trace Specification](https://agent-trace.dev/)
- [ERC-8004: Trustless Agents](https://8004.org/)
- [Virtuals Protocol](https://virtuals.io/)

## License

MIT
