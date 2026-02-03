# Data Model: Agent Anchor Runtime Wrapper

**Feature**: 002-runtime-wrapper
**Date**: 2026-02-02

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│   WrappedAgent      │       │   RuntimeConfig     │
├─────────────────────┤       ├─────────────────────┤
│ - originalTarget    │◄──────│ - consistencyMode   │
│ - config            │       │ - redactionRules    │
│ - signer            │       │ - wallet/privateKey │
│ - cache             │       │ - callbacks         │
└─────────────────────┘       │ - chainConfig       │
         │                    └─────────────────────┘
         │ intercepts
         ▼
┌─────────────────────┐
│    TraceEntry       │
├─────────────────────┤
│ - id (UUID)         │
│ - method            │
│ - args              │
│ - result            │
│ - error             │
│ - timestamp         │
│ - duration          │
│ - parentId          │
└─────────────────────┘
         │
         │ signs to create
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│   SignedRecord      │       │   AnchorStatus      │
├─────────────────────┤       ├─────────────────────┤
│ - traceEntry        │──────►│ - status            │
│ - hash              │       │ - transactionHash   │
│ - signature         │       │ - blockNumber       │
│ - previousHash      │       │ - confirmedAt       │
│ - signerAddress     │       │ - retryCount        │
│ - createdAt         │       │ - lastError         │
└─────────────────────┘       └─────────────────────┘
         │
         │ stored in
         ▼
┌─────────────────────┐
│   LocalCache        │
├─────────────────────┤
│ - records[]         │
│ - pendingCount      │
│ - confirmedCount    │
│ - storageUsed       │
└─────────────────────┘
```

## Entities

### RuntimeConfig

Configuration object passed to `AgentAnchorRuntime.wrap()`.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `consistencyMode` | `ConsistencyMode` | No | `'sync'` | How anchoring relates to execution |
| `wallet` | `WalletConfig` | Yes* | - | Wallet for signing transactions |
| `privateKey` | `string` | Yes* | - | Alternative to wallet for non-interactive |
| `chain` | `ChainId` | No | `'base'` | Target blockchain network |
| `gasStrategy` | `GasStrategy` | No | `'standard'` | Gas pricing strategy |
| `redaction` | `RedactionConfig` | No | `{ enabled: true, builtins: true }` | Redaction settings |
| `callbacks` | `CallbackConfig` | No | `{}` | Lifecycle event handlers |
| `cacheFlushInterval` | `number` | No | `30000` | Flush interval for cache mode (ms) |
| `maxRetries` | `number` | No | `3` | Anchor retry attempts before failure |
| `localCacheLimit` | `number` | No | `10000` | Max records before warning |

*One of `wallet` or `privateKey` required.

### ConsistencyMode (Enum)

```typescript
type ConsistencyMode = 'sync' | 'async' | 'cache' | 'two-phase';
```

| Value | Behavior |
|-------|----------|
| `sync` | Anchor completes before method returns. Halts on failure. |
| `async` | Sign locally, anchor in background, return immediately. |
| `cache` | Sign and cache locally, batch anchor on interval. |
| `two-phase` | Sign locally with status tracking, anchor async, update status. |

### TraceEntry

A single captured agent action before signing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4 identifier |
| `method` | `string` | Yes | Method name that was called |
| `args` | `unknown[]` | Yes | Arguments passed (redacted) |
| `result` | `unknown` | No | Return value (redacted), null if error |
| `error` | `ErrorInfo` | No | Error details if method threw |
| `timestamp` | `number` | Yes | Unix timestamp (ms) when call started |
| `duration` | `number` | Yes | Execution time in ms |
| `parentId` | `string` | No | Parent trace ID for nested calls |

### SignedRecord

A trace entry with cryptographic signature.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `traceEntry` | `TraceEntry` | Yes | The captured action |
| `hash` | `string` | Yes | keccak256 of serialized entry |
| `signature` | `string` | Yes | secp256k1 signature of hash |
| `previousHash` | `string` | Yes | Hash of previous record (chain integrity) |
| `signerAddress` | `string` | Yes | Ethereum address that signed |
| `createdAt` | `number` | Yes | Unix timestamp when signed |

### AnchorStatus

On-chain anchor status for a signed record.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `AnchorState` | Yes | Current state |
| `transactionHash` | `string` | No | Transaction hash if submitted |
| `blockNumber` | `number` | No | Block number if confirmed |
| `confirmedAt` | `number` | No | Timestamp of confirmation |
| `retryCount` | `number` | Yes | Number of anchor attempts |
| `lastError` | `string` | No | Most recent error message |

### AnchorState (Enum)

```typescript
type AnchorState =
  | 'pending'      // Signed locally, not yet submitted
  | 'submitted'    // Transaction sent, awaiting confirmation
  | 'confirmed'    // On-chain confirmation received
  | 'failed'       // All retries exhausted
  | 'rejected'     // User/wallet rejected transaction
  | 'local-only';  // Marked as locally verified by operator
```

### RedactionConfig

Configuration for sensitive data redaction.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enabled` | `boolean` | No | `true` | Whether redaction is active |
| `builtins` | `boolean` | No | `true` | Use built-in patterns (SSN, CC, etc.) |
| `patterns` | `RedactionRule[]` | No | `[]` | Custom patterns |
| `replacement` | `string` | No | `'[REDACTED]'` | Replacement text |

### RedactionRule

A single redaction pattern.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Identifier for the rule |
| `pattern` | `RegExp` | Yes | Pattern to match |
| `replacement` | `string` | No | Override default replacement |

### CallbackConfig

Lifecycle event handlers.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `onActionCaptured` | `(entry: TraceEntry) => void` | No | Fired when action is captured |
| `onRecordSigned` | `(record: SignedRecord) => void` | No | Fired when record is signed |
| `onAnchorPending` | `(record: SignedRecord, tx: string) => void` | No | Fired when anchor submitted |
| `onAnchorConfirmed` | `(record: SignedRecord, receipt: TxReceipt) => void` | No | Fired on confirmation |
| `onAnchorFailed` | `(record: SignedRecord, error: Error) => void` | No | Fired on anchor failure |
| `onStorageWarning` | `(usage: StorageStats) => void` | No | Fired at 80% capacity |

### WalletConfig (Union)

```typescript
type WalletConfig =
  | { type: 'privateKey'; key: string }
  | { type: 'injected' }
  | { type: 'walletconnect'; projectId: string };
```

### GasStrategy (Enum)

```typescript
type GasStrategy = 'standard' | 'aggressive' | 'custom';

interface CustomGasConfig {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}
```

### ErrorInfo

Structured error information for failed actions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Error class name |
| `message` | `string` | Yes | Error message (redacted) |
| `stack` | `string` | No | Stack trace (if enabled) |

### StorageStats

Local cache statistics.

| Field | Type | Description |
|-------|------|-------------|
| `totalRecords` | `number` | Total records in cache |
| `pendingRecords` | `number` | Records awaiting anchor |
| `confirmedRecords` | `number` | Records with chain confirmation |
| `storageBytes` | `number` | Approximate storage used |
| `capacityPercent` | `number` | Percentage of limit used |

## State Transitions

### SignedRecord Lifecycle

```
                    ┌──────────────┐
                    │   Created    │
                    │  (signing)   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
        ┌──────────│   Pending    │──────────┐
        │          │ (local only) │          │
        │          └──────┬───────┘          │
        │                 │                  │
        │    anchor       │                  │ operator marks
        │    submitted    │                  │ local-only
        │                 ▼                  │
        │          ┌──────────────┐          │
        │          │  Submitted   │          │
        │          │ (tx pending) │          │
        │          └──────┬───────┘          │
        │                 │                  │
        │    ┌────────────┼────────────┐     │
        │    │            │            │     │
        │    ▼            ▼            ▼     │
        │ ┌──────┐  ┌──────────┐  ┌───────┐  │
        │ │Failed│  │Confirmed │  │Rejected│ │
        │ └──┬───┘  └──────────┘  └───────┘  │
        │    │                               │
        │    │ retry                         │
        │    │ (if < maxRetries)             │
        └────┴───────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Local-Only  │
                    │  (resolved)  │
                    └──────────────┘
```

## Validation Rules

### TraceEntry
- `id` must be valid UUID v4
- `method` must be non-empty string
- `timestamp` must be positive integer
- `duration` must be non-negative

### SignedRecord
- `hash` must be 66-character hex string (0x + 64)
- `signature` must be valid secp256k1 signature
- `signerAddress` must be valid checksummed Ethereum address
- `previousHash` must reference existing record or be genesis hash

### RuntimeConfig
- Either `wallet` or `privateKey` must be provided
- `cacheFlushInterval` must be >= 1000 (1 second minimum)
- `maxRetries` must be >= 0
- `localCacheLimit` must be >= 100

## Indexes

### LocalCache Storage

| Index | Fields | Purpose |
|-------|--------|---------|
| Primary | `hash` | Unique record lookup |
| ByStatus | `anchorStatus.status` | Query pending/failed records |
| ByTimestamp | `createdAt` | Chronological queries, pruning |
| ByParent | `traceEntry.parentId` | Nested call reconstruction |
