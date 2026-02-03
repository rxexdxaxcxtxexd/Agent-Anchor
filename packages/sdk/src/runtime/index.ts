/**
 * Agent Anchor Runtime Wrapper
 *
 * Zero-code trace anchoring for AI agents. Wrap existing agents with a single
 * line of code to automatically capture and anchor all method calls.
 *
 * @example
 * ```typescript
 * import { AgentAnchorRuntime } from '@agent-anchor/sdk';
 *
 * const myAgent = new MyAIAgent();
 * const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
 *   privateKey: process.env.PRIVATE_KEY,
 *   consistencyMode: 'sync',
 * });
 *
 * // All method calls are now automatically traced and anchored
 * await wrapped.agent.makeDecision(input);
 * ```
 *
 * @packageDocumentation
 */

// Type declaration for browser globals (used in wallet connection)
declare const window: (typeof globalThis & { ethereum?: any }) | undefined;

// Export all types
export * from "./types.js";

// Export configuration utilities
export { validateConfig, applyDefaults, ConfigValidationError } from "./config.js";

// Export chain utilities
export {
  getChainConfig,
  getTransactionExplorerUrl,
  getAddressExplorerUrl,
  getBlockExplorerUrl,
  isTestnet,
  CHAIN_CONFIGS,
} from "./chains.js";

// Export storage utilities
export {
  createStorage,
  createAndInitializeStorage,
  detectStorageBackend,
  getDefaultStorageConfig,
  MemoryStorage,
} from "./storage/index.js";
export type { CacheStorage, StorageConfig, StorageBackend } from "./storage/index.js";

// Export interceptor utilities
export {
  InterceptorState,
  createSyncInterceptedMethod,
  createInterceptedMethod,
  isFunction,
  shouldIntercept,
} from "./interceptor.js";

// Export signer utilities
export {
  hashTraceEntry,
  signTraceEntry,
  verifySignature as verifyRecordSignature,
  verifyChainIntegrity as verifyRecordChainIntegrity,
  SigningContext,
  createSigningContext,
  deriveAddress,
  isValidPrivateKey,
  serializeTraceEntry,
  createSigningMessage,
} from "./signer.js";

// Export cache utilities
export { CacheManager, createCacheManager } from "./cache.js";
export type { CacheConfig } from "./cache.js";

// Export consistency strategies
export {
  createConsistencyStrategy,
  getDefaultConsistencyMode,
  supportsBatching,
  blocksOnAnchor,
  providesLocalEvidence,
  getConsistencyModeDescription,
  SyncStrategy,
  AsyncStrategy,
  CacheStrategy,
  TwoPhaseStrategy,
} from "./consistency/index.js";
export type {
  ConsistencyStrategy,
  ConsistencyStrategyConfig,
  AnchorFunction,
  StatusUpdateFunction,
} from "./consistency/index.js";

// Export wrapper
export { wrapAgent, wrapAgentSync } from "./wrapper.js";

// Export redaction utilities
export {
  redactString,
  redactValue,
  createRedactor,
  createRedactionContext,
  containsSensitiveData,
  getBuiltinPatterns,
  BUILTIN_PATTERNS,
  DEFAULT_REPLACEMENT,
  RedactionContext,
} from "./redaction.js";

// Export wallet utilities
export {
  createWalletSigner,
  connectInjectedWallet,
  connectWalletConnect,
  switchChain,
  isValidAddress,
  WalletConnectionError,
} from "./wallet.js";
export type { WalletSigner, ConnectedWallet } from "./wallet.js";

// Export gas utilities
export {
  getGasSettings,
  estimateAnchorGas,
  isValidGasStrategy,
  formatGasSettings,
  getRecommendedStrategy,
  DEFAULT_GAS_VALUES,
} from "./gas.js";
export type { GasSettings, RuntimeGasEstimate } from "./gas.js";

// Import types for the main API
import type {
  RuntimeConfig,
  WrappedAgent,
  WalletConfig,
  SignedRecord,
} from "./types.js";
import { wrapAgent } from "./wrapper.js";

// Wallet state (for browser wallet connections)
let connectedWallet: {
  address: string;
  type: WalletConfig["type"];
} | null = null;

/**
 * Main entry point for the Runtime Wrapper.
 *
 * Provides methods to wrap agents for automatic trace anchoring,
 * connect wallets, and manage the runtime state.
 */
export const AgentAnchorRuntime = {
  /**
   * Wrap an existing agent object to enable automatic trace anchoring.
   *
   * @param target - The agent object to wrap
   * @param config - Runtime configuration options
   * @returns Promise resolving to wrapped agent with trace capabilities
   *
   * @example
   * ```typescript
   * const myAgent = new MyAIAgent();
   * const wrapped = await AgentAnchorRuntime.wrap(myAgent, {
   *   privateKey: process.env.PRIVATE_KEY,
   *   consistencyMode: 'sync',
   * });
   *
   * // All method calls are now automatically traced
   * await wrapped.agent.makeDecision(input);
   * ```
   */
  async wrap<T extends object>(
    target: T,
    config: RuntimeConfig
  ): Promise<WrappedAgent<T>> {
    return wrapAgent(target, config);
  },

  /**
   * Connect a wallet for signing transactions.
   *
   * @param config - Wallet configuration
   * @returns Promise resolving when wallet is connected
   *
   * @example
   * ```typescript
   * // MetaMask
   * await AgentAnchorRuntime.connectWallet({ type: 'injected' });
   *
   * // WalletConnect
   * await AgentAnchorRuntime.connectWallet({
   *   type: 'walletconnect',
   *   projectId: 'your-project-id'
   * });
   * ```
   */
  async connectWallet(config: WalletConfig): Promise<void> {
    // Implementation will be completed in Phase 7 (US5)
    if (config.type === "injected") {
      // Check for injected provider (MetaMask)
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No injected wallet found. Please install MetaMask.");
      }

      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet");
      }

      connectedWallet = {
        address: accounts[0],
        type: "injected",
      };
    } else if (config.type === "walletconnect") {
      // WalletConnect implementation will be added in US5
      throw new Error(
        "WalletConnect not yet implemented. See tasks T070-T072."
      );
    } else if (config.type === "privateKey") {
      // Private key doesn't need "connection" - just validate
      const key = config.key.startsWith("0x")
        ? config.key.slice(2)
        : config.key;
      if (!/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error("Invalid private key format");
      }

      // Derive address from private key
      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet(`0x${key}`);

      connectedWallet = {
        address: wallet.address,
        type: "privateKey",
      };
    }
  },

  /**
   * Get the currently connected wallet address.
   *
   * @returns Ethereum address or null if not connected
   */
  getConnectedAddress(): string | null {
    return connectedWallet?.address ?? null;
  },

  /**
   * Disconnect the current wallet.
   */
  async disconnectWallet(): Promise<void> {
    connectedWallet = null;
  },
};

// Re-export verification functions with simpler names
import {
  verifySignature as _verifySignature,
  verifyChainIntegrity as _verifyChainIntegrity,
} from "./signer.js";

/**
 * Verify a signed record's signature.
 *
 * @param record - The signed record to verify
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(record: SignedRecord): boolean {
  return _verifySignature(record);
}

/**
 * Verify chain integrity of a sequence of records.
 *
 * @param records - Array of signed records in order
 * @returns true if chain is intact, false if tampering detected
 */
export function verifyChainIntegrity(records: SignedRecord[]): boolean {
  return _verifyChainIntegrity(records);
}
