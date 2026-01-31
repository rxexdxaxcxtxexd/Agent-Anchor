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

// ============ V2 Types - Ownership Layer ============

/**
 * Declaration type for authorship claims
 */
export enum DeclarationType {
  /** Personal claim - individual authored the code */
  Individual = 0,
  /** Company/team claim - organization owns the code */
  Organization = 1,
  /** Employer owns the work - work-for-hire arrangement */
  WorkForHire = 2,
}

/**
 * Identity binding information
 */
export interface IdentityBinding {
  /** Verified signer address */
  signer: string;
  /** Unix timestamp when identity was bound */
  bindingTimestamp: number;
  /** Signature type (0=EIP712, 1=EIP191) */
  signatureType: number;
  /** Whether the signature has been verified */
  verified: boolean;
}

/**
 * Git metadata for a trace
 */
export interface GitMetadata {
  /** Git commit SHA (bytes32 hex) */
  commitSha: string;
  /** Branch name */
  branch?: string;
  /** Repository identifier/URL */
  repository?: string;
  /** Optional GPG signature */
  gpgSignature?: string;
  /** Git commit timestamp */
  commitTimestamp?: number;
}

/**
 * Authorship claim
 */
export interface AuthorshipClaim {
  /** Address of the claimant */
  claimant: string;
  /** Type of authorship declaration */
  declarationType: DeclarationType;
  /** Unix timestamp when claim was made */
  claimTimestamp: number;
  /** Optional organization identifier */
  organizationId?: string;
}

/**
 * Contribution ratio between human and AI
 */
export interface ContributionRatio {
  /** Percentage of human contribution (0-100) */
  humanPercent: number;
  /** Percentage of AI contribution (0-100) */
  aiPercent: number;
  /** Optional notes explaining the calculation */
  notes?: string;
  /** How the ratio was determined */
  calculationMethod?: string;
}

/**
 * Complete ownership record combining all V2 features
 */
export interface OwnershipRecord {
  /** Trace hash */
  traceHash: string;
  /** Original trace creator address */
  creator: string;
  /** When the anchor was created */
  anchorTimestamp: number;
  /** Identity signer address */
  identitySigner: string;
  /** Whether identity is verified */
  identityVerified: boolean;
  /** Authorship claimant address */
  claimant: string;
  /** Type of authorship declaration */
  declarationType: DeclarationType;
  /** Human contribution percentage */
  humanPercent: number;
  /** AI contribution percentage */
  aiPercent: number;
  /** Git commit SHA */
  commitSha: string;
  /** Whether identity binding exists */
  hasIdentity: boolean;
  /** Whether ownership claim exists */
  hasOwnership: boolean;
  /** Whether git metadata exists */
  hasGitMetadata: boolean;
}

/**
 * Extended trace with ownership data
 */
export interface AgentTraceV2 extends AgentTrace {
  /** Optional ownership information */
  ownership?: {
    identity?: IdentityBinding;
    authorship?: AuthorshipClaim;
    contribution?: ContributionRatio;
    git?: GitMetadata;
  };
}

/**
 * Options for V2 anchoring with ownership features
 */
export interface AnchorOptionsV2 {
  /** Skip IPFS upload and use provided URI */
  ipfsUri?: string;
  /** Dry run - estimate gas without submitting */
  dryRun?: boolean;
  /** Identity binding options */
  identity?: {
    /** Purpose of the signature */
    purpose?: "code-authorship" | "audit-trail" | "compliance";
  };
  /** Authorship declaration options */
  authorship?: {
    /** Type of declaration */
    declarationType: DeclarationType;
    /** Optional organization identifier */
    organizationId?: string;
  };
  /** Contribution tracking options */
  contribution?: {
    /** Human contribution percentage (0-100) */
    humanPercent: number;
    /** AI contribution percentage (0-100) */
    aiPercent: number;
    /** Optional notes */
    notes?: string;
  };
  /** Git metadata options */
  git?: {
    /** Commit SHA (auto-detect if not provided) */
    commitSha?: string;
    /** Branch name */
    branch?: string;
    /** Repository identifier */
    repository?: string;
  };
}
