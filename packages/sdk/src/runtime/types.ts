/**
 * Agent Anchor Runtime Wrapper - Type Definitions
 *
 * TypeScript interface definitions for the Runtime Wrapper module.
 * These types define the public API surface for wrapping agents
 * and configuring trace anchoring behavior.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Consistency mode determines when/how anchoring occurs relative to agent execution.
 * - 'sync': Anchor completes before method returns. Halts on failure. (default)
 * - 'async': Sign locally, anchor in background, return immediately.
 * - 'cache': Sign and cache locally, batch anchor on interval.
 * - 'two-phase': Sign locally with status tracking, anchor async, update status.
 */
export type ConsistencyMode = "sync" | "async" | "cache" | "two-phase";

/**
 * Gas pricing strategy for blockchain transactions.
 * - 'standard': Use network-suggested gas price.
 * - 'aggressive': Higher gas for faster inclusion.
 * - 'economy': Lower gas, slower confirmation.
 * - Custom object: User-provided gas settings.
 */
export type GasStrategy =
  | "normal"
  | "standard" // Alias for normal
  | "aggressive"
  | "economy"
  | {
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };

/**
 * Supported blockchain networks.
 */
export type ChainId =
  | "polygon"
  | "base"
  | "ethereum"
  | "sepolia"
  | "base-sepolia";

/**
 * Anchor state lifecycle.
 */
export type AnchorState =
  | "pending" // Signed locally, not yet submitted
  | "submitted" // Transaction sent, awaiting confirmation
  | "confirmed" // On-chain confirmation received
  | "failed" // All retries exhausted
  | "rejected" // User/wallet rejected transaction
  | "local-only"; // Marked as locally verified by operator

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Wallet configuration options.
 */
export type WalletConfig =
  | { type: "privateKey"; key: string }
  | { type: "injected" } // window.ethereum (MetaMask)
  | { type: "walletconnect"; projectId: string };

/**
 * Custom gas configuration for 'custom' gas strategy.
 */
export interface CustomGasConfig {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

/**
 * A single redaction pattern.
 */
export interface RedactionRule {
  /** Identifier for the rule */
  name: string;
  /** Pattern to match */
  pattern: RegExp;
  /** Override default replacement text */
  replacement?: string;
}

/**
 * Configuration for sensitive data redaction.
 */
export interface RedactionConfig {
  /** Whether redaction is active (default: true) */
  enabled?: boolean;
  /** Use built-in patterns for SSN, CC, API keys, etc. (default: true) */
  builtins?: boolean;
  /** Custom redaction patterns */
  patterns?: RedactionRule[];
  /** Default replacement text (default: '[REDACTED]') */
  replacement?: string;
}

/**
 * Structured error information for failed actions.
 */
export interface ErrorInfo {
  /** Error class name */
  name: string;
  /** Error message (redacted) */
  message: string;
  /** Stack trace (if enabled) */
  stack?: string;
}

/**
 * Local cache statistics.
 */
export interface StorageStats {
  /** Total records in cache */
  totalRecords: number;
  /** Records awaiting anchor */
  pendingRecords: number;
  /** Records with chain confirmation */
  confirmedRecords: number;
  /** Approximate storage used in bytes */
  storageBytes: number;
  /** Percentage of limit used */
  capacityPercent: number;
}

/**
 * Transaction receipt from blockchain.
 */
export interface TxReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}

// =============================================================================
// Trace Entry Types
// =============================================================================

/**
 * A single captured agent action before signing.
 */
export interface TraceEntry {
  /** UUID v4 identifier */
  id: string;
  /** Method name that was called */
  method: string;
  /** Arguments passed (redacted) */
  args: unknown[];
  /** Return value (redacted), null if error */
  result?: unknown;
  /** Error details if method threw */
  error?: ErrorInfo;
  /** Unix timestamp (ms) when call started */
  timestamp: number;
  /** Execution time in ms */
  duration: number;
  /** Parent trace ID for nested calls */
  parentId?: string;
}

/**
 * A trace entry with cryptographic signature.
 */
export interface SignedRecord {
  /** The captured action */
  traceEntry: TraceEntry;
  /** keccak256 of serialized entry */
  hash: string;
  /** secp256k1 signature of hash */
  signature: string;
  /** Hash of previous record (chain integrity) */
  previousHash: string;
  /** Ethereum address that signed */
  signerAddress: string;
  /** Unix timestamp when signed */
  createdAt: number;
  /** Anchor status for this record */
  anchorStatus?: AnchorStatus;
}

/**
 * On-chain anchor status for a signed record.
 */
export interface AnchorStatus {
  /** Current state */
  status: AnchorState;
  /** Transaction hash if submitted */
  transactionHash?: string;
  /** Block number if confirmed */
  blockNumber?: number;
  /** Timestamp of confirmation */
  confirmedAt?: number;
  /** Number of anchor attempts */
  retryCount: number;
  /** Most recent error message */
  lastError?: string;
}

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Lifecycle event handlers.
 */
export interface CallbackConfig {
  /** Fired when action is captured */
  onActionCaptured?: (entry: TraceEntry) => void;
  /** Fired when record is signed */
  onRecordSigned?: (record: SignedRecord) => void;
  /** Fired when anchor submitted */
  onAnchorPending?: (record: SignedRecord, txHash: string) => void;
  /** Fired on confirmation */
  onAnchorConfirmed?: (record: SignedRecord, receipt: TxReceipt) => void;
  /** Fired on anchor failure */
  onAnchorFailed?: (record: SignedRecord, error: Error) => void;
  /** Fired at 80% capacity */
  onStorageWarning?: (usage: StorageStats) => void;
}

// =============================================================================
// Runtime Configuration
// =============================================================================

/**
 * Configuration object passed to AgentAnchorRuntime.wrap().
 */
export interface RuntimeConfig {
  /** How anchoring relates to execution (default: 'sync') */
  consistencyMode?: ConsistencyMode;
  /** Wallet for signing transactions */
  wallet?: WalletConfig;
  /** Alternative to wallet for non-interactive use */
  privateKey?: string;
  /** Target blockchain network (default: 'base') */
  chain?: ChainId;
  /** Gas pricing strategy (default: 'standard') */
  gasStrategy?: GasStrategy;
  /** Custom gas configuration (required if gasStrategy is 'custom') */
  customGas?: CustomGasConfig;
  /** Redaction settings */
  redaction?: RedactionConfig;
  /** Lifecycle event handlers */
  callbacks?: CallbackConfig;
  /** Flush interval for cache mode in ms (default: 30000) */
  cacheFlushInterval?: number;
  /** Anchor retry attempts before failure (default: 3) */
  maxRetries?: number;
  /** Max records before warning (default: 10000) */
  localCacheLimit?: number;
}

// =============================================================================
// Main API Types
// =============================================================================

/**
 * Wrapped agent interface - extends original agent with trace methods.
 */
export interface WrappedAgent<T> {
  /** The wrapped agent with all original methods */
  agent: T;
  /** Get all pending (unconfirmed) records */
  getPendingRecords(): Promise<SignedRecord[]>;
  /** Retry anchoring for a specific record */
  retryAnchor(recordHash: string): Promise<AnchorStatus>;
  /** Mark a record as locally verified (operator acknowledgment) */
  markLocallyVerified(recordHash: string): Promise<void>;
  /** Get storage statistics */
  getStorageStats(): Promise<StorageStats>;
  /** Force flush cached records (for cache mode) */
  flushCache(): Promise<void>;
  /** Get anchor status for a specific record */
  getAnchorStatus(recordHash: string): Promise<AnchorStatus | null>;
  /** Get block explorer URL for an anchored record */
  getExplorerUrl(recordHash: string): Promise<string | null>;
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Internal context passed through the interception pipeline.
 */
export interface InterceptionContext {
  /** Current call stack for tracking nested calls */
  callStack: string[];
  /** Previous record hash for chaining */
  previousHash: string;
  /** Signer's Ethereum address */
  signerAddress: string;
  /** Private key for signing (hex string without 0x prefix) */
  privateKey: string;
}

/**
 * Storage backend interface for local cache.
 */
export interface CacheStorage {
  /** Append a signed record to storage */
  append(record: SignedRecord): Promise<void>;
  /** Get all records */
  getAll(): Promise<SignedRecord[]>;
  /** Get records by anchor status */
  getByStatus(status: AnchorState): Promise<SignedRecord[]>;
  /** Update a record's anchor status */
  updateStatus(hash: string, status: AnchorStatus): Promise<void>;
  /** Get a record by hash */
  get(hash: string): Promise<SignedRecord | null>;
  /** Get storage statistics */
  getStats(): Promise<StorageStats>;
  /** Clear all records */
  clear(): Promise<void>;
}

/**
 * Chain configuration for supported networks.
 */
export interface ChainConfig {
  /** Chain ID (numeric) */
  chainId: number;
  /** Chain name for display */
  name: string;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** AgentAnchor contract address on this chain */
  contractAddress: string;
}

/**
 * Genesis hash constant for the first record in a chain.
 */
export const GENESIS_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG = {
  consistencyMode: "sync" as ConsistencyMode,
  chain: "base" as ChainId,
  gasStrategy: "normal" as GasStrategy,
  cacheFlushInterval: 30000,
  maxRetries: 3,
  localCacheLimit: 10000,
  redaction: {
    enabled: true,
    builtins: true,
    replacement: "[REDACTED]",
  },
} as const;
