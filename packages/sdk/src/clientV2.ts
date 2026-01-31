/**
 * AgentAnchorClientV2 - Extended SDK client with ownership layer features
 */

import { Contract, JsonRpcProvider, Wallet, type Signer } from "ethers";
import {
  NETWORKS_V2,
  AGENT_ANCHOR_V2_ABI,
  DEFAULT_NETWORK_V2,
} from "./constantsV2.js";
import { DEFAULT_IPFS_GATEWAY } from "./constants.js";
import type {
  ClientOptions,
  Network,
  AgentTrace,
  AnchorResult,
  VerifyResult,
  GasEstimate,
  Anchor,
  Granularity,
  IdentityBinding,
  OwnershipRecord,
  DeclarationType,
  AnchorOptionsV2,
} from "./types.js";
import { hashTrace, validateTrace, stringToBytes32 } from "./utils.js";
import { IpfsClient, createMockIpfsClient } from "./ipfs.js";
import { createIdentitySignature } from "./identity.js";

/**
 * Extended client options for V2
 */
export interface ExtendedClientOptionsV2 extends ClientOptions {
  /** IPFS API token for uploads */
  ipfsApiToken?: string;
  /** Use mock IPFS client (for testing) */
  mockIpfs?: boolean;
  /** Use V2 contract address instead of V1 */
  useV2Contract?: boolean;
}

/**
 * Result from binding identity
 */
export interface BindIdentityResult {
  success: boolean;
  transactionHash: string;
  signer: string;
  signature: string;
}

/**
 * Result from setting git metadata
 */
export interface SetGitMetadataResult {
  success: boolean;
  transactionHash: string;
  commitSha: string;
}

/**
 * Result from declaring authorship
 */
export interface DeclareAuthorshipResult {
  success: boolean;
  transactionHash: string;
  claimant: string;
  declarationType: DeclarationType;
}

/**
 * Result from setting contribution
 */
export interface SetContributionResult {
  success: boolean;
  transactionHash: string;
  humanPercent: number;
  aiPercent: number;
}

/**
 * V2 Client with ownership layer features
 *
 * @example
 * ```typescript
 * const client = new AgentAnchorClientV2({
 *   network: "base-testnet",
 *   privateKey: process.env.PRIVATE_KEY,
 * });
 *
 * // Anchor trace
 * const result = await client.anchorTrace(myTrace);
 *
 * // Bind identity
 * await client.bindIdentity(result.traceHash);
 *
 * // Set contribution ratio
 * await client.setContribution(result.traceHash, 70, 30, "Designed architecture");
 * ```
 */
export class AgentAnchorClientV2 {
  private readonly network: Network;
  private readonly provider: JsonRpcProvider;
  private readonly contract: Contract;
  private readonly signer?: Signer;
  private readonly ipfsGateway: string;
  private readonly ipfsClient: IpfsClient;
  private readonly chainId: bigint;

  /**
   * Create a new AgentAnchorClientV2
   */
  constructor(options: ExtendedClientOptionsV2 = {}) {
    this.network = options.network || DEFAULT_NETWORK_V2;

    const networkConfig = NETWORKS_V2[this.network];
    if (!networkConfig) {
      throw new Error(`Unknown network: ${this.network}`);
    }

    this.chainId = BigInt(networkConfig.chainId);
    const rpcUrl = options.rpcUrl || networkConfig.rpcUrl;
    this.provider = new JsonRpcProvider(rpcUrl);

    // Use V2 contract address
    const contractAddress = options.contractAddress || networkConfig.contractAddressV2;
    if (!contractAddress) {
      throw new Error(`No V2 contract address configured for network: ${this.network}`);
    }

    if (options.privateKey) {
      this.signer = new Wallet(options.privateKey, this.provider);
      this.contract = new Contract(contractAddress, AGENT_ANCHOR_V2_ABI, this.signer);
    } else {
      this.contract = new Contract(contractAddress, AGENT_ANCHOR_V2_ABI, this.provider);
    }

    this.ipfsGateway = options.ipfsGateway || DEFAULT_IPFS_GATEWAY;

    if (options.mockIpfs) {
      this.ipfsClient = createMockIpfsClient();
    } else {
      this.ipfsClient = new IpfsClient({
        apiToken: options.ipfsApiToken,
        gateway: this.ipfsGateway,
      });
    }
  }

  // ============ Base Anchoring (V1 Compatible) ============

  /**
   * Anchor a trace to IPFS and blockchain
   */
  async anchorTrace(trace: AgentTrace, options?: AnchorOptionsV2): Promise<AnchorResult> {
    const validation = validateTrace(trace);
    if (!validation.valid) {
      throw new Error(`Invalid trace: ${validation.error}`);
    }

    if (!this.signer) {
      throw new Error("Signer required for anchoring. Provide privateKey in options.");
    }

    const traceHash = hashTrace(trace);
    const agentIdBytes32 = stringToBytes32(trace.agentId);

    let ipfsUri: string;
    if (options?.ipfsUri) {
      ipfsUri = options.ipfsUri;
    } else {
      const uploadResult = await this.ipfsClient.upload(trace);
      ipfsUri = uploadResult.uri;
    }

    if (options?.dryRun) {
      const gasEstimate = await this.estimateGas(trace);
      return {
        success: true,
        transactionHash: "0x" + "0".repeat(64),
        blockNumber: 0,
        traceHash,
        ipfsUri,
        gasUsed: gasEstimate.gasLimit,
      };
    }

    const anchorFn = this.contract.getFunction("anchorTrace");
    const tx = await anchorFn(traceHash, ipfsUri, agentIdBytes32, trace.granularity);

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction failed - no receipt received");
    }

    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      traceHash,
      ipfsUri,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Verify a trace anchor on-chain
   */
  async verifyTrace(traceHash: string, options?: { full?: boolean }): Promise<VerifyResult> {
    const verifyFn = this.contract.getFunction("verifyTrace");
    const [exists] = await verifyFn(traceHash);

    if (!exists) {
      return { exists: false };
    }

    const getAnchorFn = this.contract.getFunction("getAnchor");
    const anchorData = await getAnchorFn(traceHash);

    const anchor: Anchor = {
      traceHash: anchorData.traceHash,
      ipfsUri: anchorData.ipfsUri,
      agentId: anchorData.agentId,
      granularity: Number(anchorData.granularity) as Granularity,
      creator: anchorData.creator,
      timestamp: Number(anchorData.timestamp),
      blockNumber: Number(anchorData.blockNumber),
    };

    if (options?.full) {
      try {
        const fetchedTrace = await this.ipfsClient.fetch<AgentTrace>(anchor.ipfsUri);
        const recomputedHash = hashTrace(fetchedTrace);
        const hashMatches = recomputedHash === traceHash;

        return { exists: true, hashMatches, anchor };
      } catch (error) {
        return {
          exists: true,
          hashMatches: false,
          anchor,
          error: `Failed to fetch/verify IPFS content: ${error}`,
        };
      }
    }

    return { exists: true, anchor };
  }

  // ============ Identity Binding (US1) ============

  /**
   * Bind identity to a trace using EIP-712 signature
   *
   * @param traceHash - The trace hash to bind identity to
   * @returns Binding result with transaction details
   */
  async bindIdentity(traceHash: string): Promise<BindIdentityResult> {
    if (!this.signer) {
      throw new Error("Signer required for identity binding. Provide privateKey in options.");
    }

    // Get anchor timestamp for the signature
    const anchor = await this.contract.getFunction("getAnchor")(traceHash);
    const anchorTimestamp = anchor.timestamp;

    // Create EIP-712 signature
    const { signature, signer } = await createIdentitySignature(this.signer, {
      traceHash,
      anchorTimestamp,
      chainId: this.chainId,
      contractAddress: await this.contract.getAddress(),
    });

    // Submit to contract
    const bindFn = this.contract.getFunction("bindIdentity");
    const tx = await bindFn(traceHash, signature);
    const receipt = await tx.wait();

    return {
      success: true,
      transactionHash: receipt.hash,
      signer,
      signature,
    };
  }

  /**
   * Verify identity binding for a trace
   */
  async verifyIdentity(traceHash: string): Promise<{ verified: boolean; signer: string }> {
    const verifyFn = this.contract.getFunction("verifyIdentity");
    const [verified, signer] = await verifyFn(traceHash);
    return { verified, signer };
  }

  /**
   * Get full identity binding data
   */
  async getIdentityBinding(traceHash: string): Promise<IdentityBinding> {
    const getFn = this.contract.getFunction("getIdentityBinding");
    const binding = await getFn(traceHash);
    return {
      signer: binding.signer,
      bindingTimestamp: Number(binding.bindingTimestamp),
      signatureType: Number(binding.signatureType),
      verified: binding.verified,
    };
  }

  // ============ Git Metadata (US2) ============

  /**
   * Set git metadata for a trace
   */
  async setGitMetadata(
    traceHash: string,
    commitSha: string,
    branch: string = "",
    repository: string = ""
  ): Promise<SetGitMetadataResult> {
    if (!this.signer) {
      throw new Error("Signer required. Provide privateKey in options.");
    }

    // Convert commit SHA to bytes32 if needed
    let commitShaBytes32: string;
    if (commitSha.startsWith("0x") && commitSha.length === 66) {
      commitShaBytes32 = commitSha;
    } else {
      // Convert hex string to bytes32
      commitShaBytes32 = "0x" + commitSha.padStart(64, "0");
    }

    const setFn = this.contract.getFunction("setGitMetadata");
    const tx = await setFn(traceHash, commitShaBytes32, branch, repository);
    const receipt = await tx.wait();

    return {
      success: true,
      transactionHash: receipt.hash,
      commitSha: commitShaBytes32,
    };
  }

  /**
   * Get git metadata for a trace
   */
  async getGitMetadata(traceHash: string): Promise<{ commitSha: string; hasMetadata: boolean }> {
    const getFn = this.contract.getFunction("getGitMetadata");
    const [commitSha, hasMetadata] = await getFn(traceHash);
    return { commitSha, hasMetadata };
  }

  // ============ Authorship (US3) ============

  /**
   * Declare authorship of a trace
   */
  async declareAuthorship(
    traceHash: string,
    declarationType: DeclarationType
  ): Promise<DeclareAuthorshipResult> {
    if (!this.signer) {
      throw new Error("Signer required. Provide privateKey in options.");
    }

    const declareFn = this.contract.getFunction("declareAuthorship");
    const tx = await declareFn(traceHash, declarationType);
    const receipt = await tx.wait();

    return {
      success: true,
      transactionHash: receipt.hash,
      claimant: await this.signer.getAddress(),
      declarationType,
    };
  }

  /**
   * Get authorship claim for a trace
   */
  async getAuthorship(traceHash: string): Promise<{
    claimant: string;
    declarationType: DeclarationType;
    claimTimestamp: number;
    hasClaim: boolean;
  }> {
    const getFn = this.contract.getFunction("getAuthorship");
    const [claimant, declarationType, claimTimestamp, hasClaim] = await getFn(traceHash);
    return {
      claimant,
      declarationType: Number(declarationType) as DeclarationType,
      claimTimestamp: Number(claimTimestamp),
      hasClaim,
    };
  }

  // ============ Contribution (US4) ============

  /**
   * Set contribution ratio for a trace
   */
  async setContribution(
    traceHash: string,
    humanPercent: number,
    aiPercent: number,
    notes: string = ""
  ): Promise<SetContributionResult> {
    if (!this.signer) {
      throw new Error("Signer required. Provide privateKey in options.");
    }

    if (humanPercent + aiPercent !== 100) {
      throw new Error("Human and AI percentages must sum to 100");
    }

    const setFn = this.contract.getFunction("setContribution");
    const tx = await setFn(traceHash, humanPercent, aiPercent, notes);
    const receipt = await tx.wait();

    return {
      success: true,
      transactionHash: receipt.hash,
      humanPercent,
      aiPercent,
    };
  }

  /**
   * Get contribution ratio for a trace
   */
  async getContribution(traceHash: string): Promise<{
    humanPercent: number;
    aiPercent: number;
    hasContribution: boolean;
  }> {
    const getFn = this.contract.getFunction("getContribution");
    const [humanPercent, aiPercent, hasContribution] = await getFn(traceHash);
    return {
      humanPercent: Number(humanPercent),
      aiPercent: Number(aiPercent),
      hasContribution,
    };
  }

  // ============ Combined V2 Functions ============

  /**
   * Get complete ownership record for a trace
   */
  async getOwnershipRecord(traceHash: string): Promise<OwnershipRecord> {
    const getFn = this.contract.getFunction("getOwnershipRecord");
    const record = await getFn(traceHash);
    return {
      traceHash: record.traceHash,
      creator: record.creator,
      anchorTimestamp: Number(record.anchorTimestamp),
      identitySigner: record.identitySigner,
      identityVerified: record.identityVerified,
      claimant: record.claimant,
      declarationType: Number(record.declarationType) as DeclarationType,
      humanPercent: Number(record.humanPercent),
      aiPercent: Number(record.aiPercent),
      commitSha: record.commitSha,
      hasIdentity: record.hasIdentity,
      hasOwnership: record.hasOwnership,
      hasGitMetadata: record.hasGitMetadata,
    };
  }

  // ============ Utility Functions ============

  /**
   * Estimate gas for anchoring a trace
   */
  async estimateGas(trace: AgentTrace): Promise<GasEstimate> {
    const traceHash = hashTrace(trace);
    const agentIdBytes32 = stringToBytes32(trace.agentId);
    const ipfsUri = "ipfs://QmEstimateGasPlaceholder";

    const anchorFn = this.contract.getFunction("anchorTrace");
    const gasLimit = await anchorFn.estimateGas(
      traceHash,
      ipfsUri,
      agentIdBytes32,
      trace.granularity
    );

    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const totalCost = gasLimit * gasPrice;

    const networkConfig = NETWORKS_V2[this.network];
    const costInToken = (Number(totalCost) / 1e18).toFixed(8);

    return {
      gasLimit,
      gasPrice,
      totalCost,
      costInToken: `${costInToken} ${networkConfig.nativeCurrency.symbol}`,
    };
  }

  /**
   * Get the current network
   */
  getNetwork(): Network {
    return this.network;
  }

  /**
   * Get the contract address
   */
  getContractAddress(): string {
    return this.contract.target as string;
  }

  /**
   * Get the chain ID
   */
  getChainId(): bigint {
    return this.chainId;
  }
}
