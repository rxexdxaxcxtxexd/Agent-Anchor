# TODO: Enterprise Gateway Feature (Solution 2)

## Overview

Infrastructure-level gateway/daemon for mandatory trace anchoring at the network level. This is the enterprise complement to the Runtime Wrapper (Solution 1).

**Priority**: Phase 2 (after Runtime Wrapper is complete)
**Target Users**: Enterprise, compliance-mandated organizations
**Pricing Tier**: Enterprise

---

## Feature Description

A local service/daemon that acts as a required gateway for all agent operations. Agents must route through it to access LLMs/tools—anchoring is enforced at the protocol level.

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Your Agent  │ ──── │  Agent Anchor    │ ──── │  LLM APIs   │
│  Application │      │  Gateway (local) │      │  Tools      │
└──────────────┘      └──────────────────┘      └─────────────┘
                              │
                              ▼
                      Auto-anchor all traffic
```

---

## Key Differentiators from Runtime Wrapper

| Aspect | Runtime Wrapper | Gateway (This Feature) |
|--------|-----------------|------------------------|
| Code changes | One line per agent | Zero (config only) |
| Granularity | Selective | All-or-nothing |
| Deployment | Per-application | Per-machine/infrastructure |
| Bypass risk | Developer could skip | Mandatory at network level |
| Best for | Voluntary adoption | Compliance enforcement |

---

## Requirements

### Functional Requirements

- [ ] Local daemon/service that runs on user's machine
- [ ] Proxy for common LLM APIs (OpenAI, Anthropic, etc.)
- [ ] Automatic trace capture of all requests/responses
- [ ] Automatic anchoring with configurable consistency modes
- [ ] Admin dashboard for monitoring anchor status
- [ ] Policy engine for what gets anchored vs filtered
- [ ] Support for multiple agents routing through single gateway

### Non-Functional Requirements

- [ ] Sub-10ms latency overhead
- [ ] Zero data sent to third parties
- [ ] Runs fully offline (except chain writes)
- [ ] Tamper-evident local logs
- [ ] Graceful degradation if chain unavailable

### Security Requirements

- [ ] Cannot be bypassed if properly configured
- [ ] Signed local cache for resilience
- [ ] No plaintext credential storage
- [ ] Audit log of gateway operations itself
- [ ] Network-level enforcement options (firewall rules)

### Blockchain-Native Requirements

- [ ] Wallet connection support (MetaMask, WalletConnect)
- [ ] Multi-chain support
- [ ] Gas strategy configuration
- [ ] Direct on-chain verification endpoints
- [ ] Block explorer integration

---

## Technical Approach (TBD)

Options to evaluate:
1. **HTTP Proxy**: Simple, works with any HTTP-based LLM API
2. **mTLS Proxy**: Stronger security, certificate-based auth
3. **Local MCP Server**: Integrates with Claude/MCP ecosystem
4. **Network namespace/container**: OS-level enforcement

---

## Dependencies

- Runtime Wrapper (Solution 1) must be complete first
- Shared anchoring logic between wrapper and gateway
- Common trace schema
- Common signing/verification code

---

## Open Questions

1. How to handle WebSocket connections (streaming LLM responses)?
2. Should gateway have its own identity/keys or use agent's?
3. How to deploy in containerized environments (K8s)?
4. Licensing model for enterprise feature?

---

## Related Documents

- Runtime Wrapper Spec: `docs/specs/runtime-wrapper.md` (TBD)
- Anchoring Protocol: `docs/specs/anchoring-protocol.md` (TBD)
- Enterprise Pricing: (TBD)

---

*Created: 2026-02-02*
*Status: PLANNED - Not yet in development*
*Owner: TBD*
