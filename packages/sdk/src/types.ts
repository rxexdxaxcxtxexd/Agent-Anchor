/**
 * Type definitions for Agent Anchor SDK
 */

/**
 * Granularity level for trace anchoring
 */
export enum Granularity {
  /** Anchor entire session */
  Session = 0,
  /** Anchor individual task */
  Task = 1,
  /** Anchor single step */
  Step = 2,
}

/**
 * Supported blockchain networks
 */
export type Network = "polygon-mainnet" | "polygon-testnet" | "base-mainnet" | "base-testnet" | "localhost";

/**
 * Configuration options for AgentAnchorClient
 */
export interface ClientOptions {
  /** Target network */
  network?: Network;
  /** Custom RPC URL (overrides default) */
  rpcUrl?: string;
  /** Custom contract address (overrides default) */
  contractAddress?: string;
  /** IPFS gateway URL */
  ipfsGateway?: string;
  /** Private key for signing transactions */
  privateKey?: string;
}

/**
 * Agent trace data structure (based on Cursor Agent Trace spec)
 */
export interface AgentTrace {
  /** Trace format version */
  version: string;
  /** Unique trace identifier */
  traceId: string;
  /** Agent identifier */
  agentId: string;
  /** Session identifier */
  sessionId?: string;
  /** Trace timestamp */
  timestamp: string;
  /** Trace granularity */
  granularity: Granularity;
  /** Trace content/steps */
  content: unknown;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * On-chain anchor data structure
 */
export interface Anchor {
  /** Keccak256 hash of trace content */
  traceHash: string;
  /** IPFS URI where full trace is stored */
  ipfsUri: string;
  /** Agent identifier (bytes32) */
  agentId: string;
  /** Granularity level */
  granularity: Granularity;
  /** Creator wallet address */
  creator: string;
  /** Block timestamp */
  timestamp: number;
  /** Block number */
  blockNumber: number;
}

/**
 * Result from anchoring a trace
 */
export interface AnchorResult {
  /** Whether anchoring succeeded */
  success: boolean;
  /** Transaction hash */
  transactionHash: string;
  /** Block number */
  blockNumber: number;
  /** Computed trace hash */
  traceHash: string;
  /** IPFS URI */
  ipfsUri: string;
  /** Gas used */
  gasUsed: bigint;
}

/**
 * Result from verifying a trace
 */
export interface VerifyResult {
  /** Whether anchor exists on-chain */
  exists: boolean;
  /** Whether content hash matches (if full verification) */
  hashMatches?: boolean;
  /** Anchor data (if exists) */
  anchor?: Anchor;
  /** Error message (if verification failed) */
  error?: string;
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
  /** Estimated gas units */
  gasLimit: bigint;
  /** Current gas price */
  gasPrice: bigint;
  /** Estimated total cost in wei */
  totalCost: bigint;
  /** Estimated cost in native token */
  costInToken: string;
}
