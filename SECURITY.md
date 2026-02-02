# Security Policy

## Overview

Agent Anchor is a trace anchoring system for AI agents. This document outlines security considerations, known limitations, and recommendations for safe usage.

## Security Model

### Permissionless Design (SEC-003)

The AgentAnchor contract is **permissionless by default**. This is an intentional design choice that enables:

- Decentralized trace submission without gatekeepers
- Lower barrier to entry for agent developers
- Censorship-resistant trace recording

**Implications:**

1. **No on-chain agent verification**: Anyone can anchor a trace claiming any `agentId`. The contract does not verify that the submitter actually controls the agent.

2. **Creator = Submitter only**: The `creator` address proves who submitted the transaction, but not who generated the trace content.

3. **Trust model**: Applications consuming traces should perform off-chain verification to validate trace authenticity.

### Restricted Mode

For deployments requiring access control:

```solidity
// Owner can enable restricted mode
contract.setPermissionless(false);

// Add addresses to allowlist
contract.setAllowlist(trustedAddress, true);
```

## Implemented Security Measures

### SEC-001: IPFS URI Length Limit

- **Issue**: Unbounded string storage could cause high gas costs
- **Mitigation**: Max 256 bytes enforced on-chain
- **Error**: `IpfsUriTooLong(length, maxLength)`

### SEC-002: Paginated Array Returns

- **Issue**: Unbounded array returns could exceed block gas limit
- **Mitigation**: Paginated query functions added
- **Functions**: `getTracesByAgentPaginated()`, `getTracesByCreatorPaginated()`

### SEC-004: IPFS Size Limits

- **Issue**: Fetching large IPFS content could cause DoS
- **Mitigation**: SDK enforces upload (10MB) and fetch (10MB) limits
- **Constants**: `MAX_UPLOAD_SIZE`, `MAX_FETCH_SIZE`

### SEC-005: CID Validation

- **Issue**: Invalid IPFS URIs could cause issues downstream
- **Mitigation**: SDK validates CIDv0 and CIDv1 format
- **Function**: `isValidCid()`

## Known Limitations

### 1. No Trace Content Verification

The contract stores only a hash of the trace content. It cannot verify:
- That the IPFS content matches the hash
- That the trace content is valid or meaningful
- That the claimed agent actually generated the trace

**Recommendation**: Use the SDK's `verifyTrace()` which checks both on-chain and IPFS data.

### 2. Mutable IPFS Content Risk

IPFS URIs using mutable references (IPNS, DNSLink) could point to different content over time.

**Recommendation**: Always use immutable CIDs (CIDv0: `Qm...`, CIDv1: `bafy...`).

### 3. Block Timestamp Precision

Anchor timestamps use `block.timestamp` which:
- Has ~15 second precision on most chains
- Can be slightly manipulated by miners/validators

**Recommendation**: For precise timing, include a timestamp in the trace content itself.

### 4. Replay Protection

The same trace content can only be anchored once (by hash). However:
- Different content with the same semantic meaning can be anchored multiple times
- There's no expiration or revocation mechanism

**Recommendation**: Use V2 identity binding with nonces for stronger replay protection.

## Recommended Security Practices

### For Developers

1. **Use V2 identity binding** for stronger attribution via EIP-712 signatures
2. **Validate all user input** before creating traces
3. **Use paginated queries** for production applications
4. **Set appropriate size limits** when processing trace content
5. **Monitor gas costs** when anchoring at high frequency

### For Operators

1. **Consider restricted mode** for enterprise deployments
2. **Monitor for unusual activity** (many anchors from same address)
3. **Keep contract upgradeable** if using proxy pattern
4. **Back up IPFS content** to multiple providers

### For Users

1. **Verify trace authenticity** before trusting claims
2. **Check creator address** against known sources
3. **Use the SDK** which includes validation
4. **Report issues** via responsible disclosure

## Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. **Email**: security@agent-anchor.io (placeholder)
3. **Include**: Description, reproduction steps, potential impact
4. **Response**: We aim to respond within 48 hours

## Audit Status

- [ ] Internal security review: Complete
- [ ] External audit: Pending
- [ ] Bug bounty: Not yet active

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01 | Initial security measures (SEC-001 to SEC-005) |
| 2.0.0 | 2026-01 | V2 ownership layer with EIP-712 identity binding |

## References

- [OpenZeppelin Security Best Practices](https://docs.openzeppelin.com/contracts/4.x/)
- [Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)
- [IPFS Best Practices](https://docs.ipfs.tech/concepts/persistence/)
