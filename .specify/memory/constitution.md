<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0
Modified principles: N/A (initial creation)
Added sections: Core Principles (5), Security Requirements, Development Workflow, Governance
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (no changes needed)
  - .specify/templates/spec-template.md ✅ (no changes needed)
  - .specify/templates/tasks-template.md ✅ (no changes needed)
Follow-up TODOs: None
-->

# Agent Anchor Constitution

## Core Principles

### I. Smart Contract Safety (NON-NEGOTIABLE)

Smart contract code is immutable once deployed to mainnet. All contract changes MUST:
- Pass comprehensive test coverage (minimum 95% for critical paths)
- Complete security audit checklist before testnet deployment
- Deploy to testnet and verify behavior before mainnet
- Use battle-tested patterns from OpenZeppelin where applicable
- Avoid unbounded loops, reentrancy vulnerabilities, and integer overflow/underflow
- Include explicit access control for privileged functions

**Rationale**: Blockchain vulnerabilities cannot be patched post-deployment without complex upgrade patterns. Prevention is the only reliable defense.

### II. Test-First Development

All features MUST follow test-driven development:
- Tests written and reviewed before implementation begins
- Red-Green-Refactor cycle strictly enforced
- Smart contracts require both unit tests (Hardhat) and integration tests
- SDK requires contract mock tests + live testnet integration tests
- CLI commands require end-to-end test scenarios

**Rationale**: Financial and cryptographic systems have zero tolerance for bugs. TDD catches issues before they become immutable on-chain.

### III. Multi-Chain Portability

Code MUST remain portable across supported chains (Polygon, Base):
- No chain-specific opcodes or precompiles unless abstracted
- Contract addresses and ABIs externalized to configuration
- SDK MUST support network switching via constructor options
- Gas estimation MUST account for chain-specific pricing
- All features tested on both Polygon Amoy and Base Sepolia testnets

**Rationale**: Multi-chain support is a competitive advantage and user requirement. Tight coupling to one chain limits adoption.

### IV. SDK Developer Experience

The SDK is the primary interface for users. It MUST:
- Provide TypeScript-first API with full type definitions
- Export both ESM and CJS bundles for maximum compatibility
- Include comprehensive JSDoc comments on all public APIs
- Offer sensible defaults (network, IPFS gateway) while allowing override
- Return structured error types with actionable messages
- Support both programmatic and CLI usage patterns

**Rationale**: Developer adoption depends on frictionless integration. Poor DX kills products faster than missing features.

### V. Observability and Auditability

All operations MUST be traceable for debugging and compliance:
- Emit events for every state-changing contract operation
- SDK MUST log operations at configurable verbosity levels
- Transaction hashes and block numbers included in all responses
- IPFS CIDs MUST be verifiable against on-chain hashes
- Support dry-run mode for pre-flight validation without chain writes

**Rationale**: Agent Anchor's core value is verifiability. The system itself must be verifiable and debuggable.

## Security Requirements

All code handling private keys, transactions, or user data MUST:
- Never log or expose private keys, even in debug mode
- Validate all external inputs (trace JSON, IPFS data, user parameters)
- Use secure defaults (HTTPS, verified SSL, checksummed addresses)
- Implement rate limiting for API endpoints to prevent abuse
- Follow OWASP guidelines for any web-facing components
- Pin dependencies to exact versions to prevent supply chain attacks

## Development Workflow

### Code Review Requirements
- All PRs require at least one approval before merge
- Smart contract changes require security-focused review
- Breaking API changes require migration documentation

### Quality Gates
- All tests must pass before merge
- No decrease in test coverage for modified files
- Linting (ESLint, Solhint) must pass with zero warnings
- TypeScript strict mode enabled, no `any` types in public APIs

### Deployment Process
- Testnet deployment: Automated via CI on `develop` branch merge
- Mainnet deployment: Manual approval required, changelog mandatory
- Contract verification on block explorers required post-deployment

## Governance

This constitution supersedes all other development practices for Agent Anchor. Amendments require:
1. Written proposal documenting the change and rationale
2. Review period of at least 48 hours for team feedback
3. Update to this document with version increment
4. Migration plan for any breaking changes to existing code

All pull requests and code reviews MUST verify compliance with these principles. Deviations require explicit justification documented in the PR description.

**Version**: 1.0.0 | **Ratified**: 2026-01-29 | **Last Amended**: 2026-01-29
