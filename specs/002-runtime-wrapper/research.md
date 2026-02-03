# Research: Agent Anchor Runtime Wrapper

**Feature**: 002-runtime-wrapper
**Date**: 2026-02-02
**Status**: Complete

## Research Tasks

### 1. JavaScript Proxy Pattern for Method Interception

**Decision**: Use ES6 Proxy with `get` trap to intercept method calls on wrapped objects.

**Rationale**:
- Native JavaScript feature, no dependencies required
- Works with any object type (classes, plain objects, functions)
- Transparent to the wrapped object—no modification needed
- Supports both sync and async methods via Promise detection
- Well-supported in all target environments (Node 18+, modern browsers)

**Alternatives Considered**:
- **Function wrapping**: Manual wrapping of each method. Rejected because it requires knowing method names upfront and doesn't handle dynamic properties.
- **Decorator pattern**: TypeScript decorators. Rejected because requires code modification and experimental flag.
- **Aspect-Oriented Programming (AOP) libraries**: (e.g., aspect.js). Rejected because adds dependency and complexity for simple interception needs.

**Implementation Notes**:
```typescript
const handler: ProxyHandler<T> = {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return createTracedMethod(target, prop, value);
    }
    return value;
  }
};
return new Proxy(target, handler);
```

---

### 2. Local Cryptographic Signing Strategy

**Decision**: Use secp256k1 signatures via `@noble/secp256k1` library, compatible with Ethereum key pairs.

**Rationale**:
- Same curve as Ethereum—users can sign with their existing wallet keys
- `@noble/secp256k1` is audited, zero-dependency, fast pure JavaScript
- Produces signatures verifiable both locally and on-chain
- <1ms signing time meets 10ms performance requirement

**Alternatives Considered**:
- **Ed25519**: Faster but incompatible with Ethereum ecosystem. Would require separate key management.
- **ethers.js signMessage**: Adds ethers dependency to signing path. Rejected because we want signing to work offline without provider.
- **WebCrypto API**: Browser-native but inconsistent Node.js support and doesn't support secp256k1 directly.

**Implementation Notes**:
- Sign: `hash(timestamp + actionHash + previousHash)` → chain integrity
- Store: `{ action, timestamp, hash, signature, previousHash }`
- Verify: Recover public key from signature, compare to expected signer

---

### 3. Local Storage Strategy (Cross-Platform)

**Decision**: Abstract storage interface with two implementations: IndexedDB (browser), filesystem JSON (Node.js).

**Rationale**:
- IndexedDB handles large datasets (100k+ records) efficiently in browsers
- Filesystem JSON is simple and debuggable for Node.js server deployments
- Abstraction allows future backends (SQLite, LevelDB) without API changes
- Both support atomic writes for crash safety

**Alternatives Considered**:
- **localStorage**: 5MB limit too restrictive for audit logs. Rejected.
- **SQLite via better-sqlite3**: Excellent but adds native dependency, complicates browser support. Deferred to future enhancement.
- **In-memory only**: Loses records on crash. Rejected for compliance use cases.

**Implementation Notes**:
```typescript
interface CacheStorage {
  append(record: SignedRecord): Promise<void>;
  getAll(): Promise<SignedRecord[]>;
  getPending(): Promise<SignedRecord[]>;
  markConfirmed(hashes: string[]): Promise<void>;
  prune(beforeTimestamp: number): Promise<number>;
}
```

---

### 4. Consistency Mode Implementation Patterns

**Decision**: Implement as strategy pattern with four concrete strategies, configurable at wrap time.

**Rationale**:
- Strategy pattern cleanly separates mode logic from core wrapper
- Each mode has distinct lifecycle hooks and error handling
- Default (synchronous) is simplest to reason about for compliance
- Modes can be switched at runtime if needed

**Mode Behaviors**:

| Mode | On Action Complete | On Anchor Fail | Performance | Guarantee |
|------|-------------------|----------------|-------------|-----------|
| `sync` (default) | Sign → Anchor → Return | Halt, throw error | Slow (2-15s) | Complete |
| `async` | Sign → Return; Anchor background | Log, callback, continue | Fast | Eventual |
| `cache` | Sign → Cache; Flush on interval | Retry batch on next flush | Fast | Batched eventual |
| `two-phase` | Sign → Return; Anchor background; Update status | Retry, status stays "pending" | Fast | Local + eventual chain |

**Alternatives Considered**:
- **Single configurable mode**: Too many if/else branches. Rejected.
- **Middleware chain**: Over-engineered for 4 modes. Rejected.

---

### 5. Sensitive Data Redaction Approach

**Decision**: Regex-based pattern matching with built-in patterns + custom pattern support.

**Rationale**:
- Regex is universal, well-understood, and performant for pattern matching
- Built-in patterns cover 95%+ of common sensitive data (per spec SC-006)
- Custom patterns allow domain-specific redaction without code changes
- Redaction happens before signing—redacted data never persists

**Built-in Patterns**:
```typescript
const BUILTIN_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  apiKey: /\b(sk_live_|pk_live_|api[_-]?key[_-]?)[a-zA-Z0-9]{20,}\b/gi,
  awsKey: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
};
```

**Alternatives Considered**:
- **ML-based PII detection**: More accurate but adds large dependency, latency, and complexity. Explicitly out of scope per spec.
- **Allow-list approach**: Specify what TO include rather than what to exclude. Rejected because default would be too restrictive.

---

### 6. Wallet Connection Integration

**Decision**: Support ethers.js Signer interface with adapters for MetaMask (injected) and WalletConnect.

**Rationale**:
- ethers.js Signer is already used by existing SDK clients
- MetaMask is dominant browser wallet (>90% market share)
- WalletConnect provides mobile wallet support
- Adapter pattern allows future wallet integrations

**Implementation Notes**:
```typescript
type WalletConfig =
  | { type: 'privateKey'; key: string }
  | { type: 'injected' }  // window.ethereum (MetaMask)
  | { type: 'walletconnect'; projectId: string };

async function connectWallet(config: WalletConfig): Promise<Signer>
```

**Alternatives Considered**:
- **Direct window.ethereum access**: Works but no abstraction for other wallets. Rejected.
- **web3modal**: Good UX but adds significant bundle size. Deferred—can integrate later.

---

### 7. Performance Optimization Strategies

**Decision**: Batch operations, async signing for cache mode, and lazy serialization.

**Rationale**:
- Batching amortizes overhead across multiple actions
- Async signing in non-sync modes prevents blocking agent execution
- Lazy serialization defers JSON.stringify until actually needed
- Combined strategies achieve <10ms overhead target

**Optimizations**:
1. **Signing**: Use streaming hash for large payloads
2. **Serialization**: Cache serialized form if re-used (e.g., retry)
3. **Storage**: Batch writes in cache mode (single I/O per flush)
4. **Memory**: Circular buffer for recent records, older records on disk

**Benchmark Targets**:
- Sign 1KB payload: <2ms
- Sign 100KB payload: <10ms
- Cache write (single): <5ms
- Cache flush (100 records): <50ms

---

## Dependencies Analysis

### New Dependencies

| Package | Purpose | Size | Risk |
|---------|---------|------|------|
| `@noble/secp256k1` | Local signing | 40KB | Low (audited, maintained) |
| `idb` | IndexedDB wrapper | 8KB | Low (Google maintained) |

### Existing Dependencies (reused)

| Package | Purpose |
|---------|---------|
| `ethers` | Chain interaction, wallet abstraction |
| `commander` | CLI (if adding runtime commands) |

### No New Native Dependencies

All new dependencies are pure JavaScript, maintaining cross-platform compatibility.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Proxy performance overhead | Low | Medium | Benchmarked at <0.1ms per interception |
| IndexedDB quota limits | Medium | Low | Storage warning at 80% capacity, pruning API |
| Signature verification differences across platforms | Low | High | Use standardized secp256k1, extensive cross-platform tests |
| Wallet connection failures | Medium | Medium | Graceful fallback to local-only mode with warning |
| Large payload signing latency | Low | Medium | Streaming hash, lazy serialization |

---

## Open Questions Resolved

All NEEDS CLARIFICATION items from Technical Context have been resolved through research above. No blocking questions remain.
