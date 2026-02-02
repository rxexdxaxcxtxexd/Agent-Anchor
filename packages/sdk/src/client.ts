/**
 * AgentAnchorClient - Main SDK client for interacting with Agent Anchor contracts
 */

import { Contract, JsonRpcProvider, Wallet, type Signer } from "ethers";
import {
  NETWORKS,
  AGENT_ANCHOR_ABI,
  DEFAULT_NETWORK,
  DEFAULT_IPFS_GATEWAY,
} from "./constants.js";
import type {
  ClientOptions,
  Network,
  AgentTrace,
  AnchorResult,
  VerifyResult,
  GasEstimate,
  Anchor,
  Granularity,
  TraceLineage,
  GetLineageOptions,
  GetTreeOptions,
  TraceTreeNode,
} from "./types.js";
import { hashTrace, validateTrace, stringToBytes32, parseIpfsUri } from "./utils.js";
import { IpfsClient, createMockIpfsClient } from "./ipfs.js";
import { getTraceLineage as getTraceLineageHelper, getTraceTree as getTraceTreeHelper } from "./linking.js";

/**
 * Extended client options including IPFS configuration
 */
export interface ExtendedClientOptions extends ClientOptions {
  /** IPFS API token for uploads */
  ipfsApiToken?: string;
  /** Use mock IPFS client (for testing) */
  mockIpfs?: boolean;
}

/**
 * Anchor options for customizing the anchor operation
 */
export interface AnchorOptions {
  /** Skip IPFS upload and use provided URI */
  ipfsUri?: string;
  /** Dry run - estimate gas without submitting */
  dryRun?: boolean;
  /** Parent trace hash to link to (0x0 or omit for root trace) */
  parentTraceHash?: string;
}

/**
 * Client for interacting with Agent Anchor smart contracts
 *
 * @example
 * ```typescript
 * const client = new AgentAnchorClient({
 *   network: "base-testnet",
 *   privateKey: process.env.PRIVATE_KEY,
 *   ipfsApiToken: process.env.WEB3_STORAGE_TOKEN
 * });
 *
 * const result = await client.anchorTrace(myTrace);
 * console.log("Anchored:", result.transactionHash);
 * ```
 */
export class AgentAnchorClient {
  private readonly network: Network;
  private readonly provider: JsonRpcProvider;
  private readonly contract: Contract;
  private readonly signer?: Signer;
  private readonly ipfsGateway: string;
  private readonly ipfsClient: IpfsClient;

  /**
   * Create a new AgentAnchorClient
   * @param options - Client configuration options
   */
  constructor(options: ExtendedClientOptions = {}) {
    this.network = options.network || DEFAULT_NETWORK;

    const networkConfig = NETWORKS[this.network];
    if (!networkConfig) {
      throw new Error(`Unknown network: ${this.network}`);
    }

    const rpcUrl = options.rpcUrl || networkConfig.rpcUrl;
    this.provider = new JsonRpcProvider(rpcUrl);

    const contractAddress = options.contractAddress || networkConfig.contractAddress;
    if (!contractAddress) {
      throw new Error(`No contract address configured for network: ${this.network}`);
    }

    // Set up signer if private key provided
    if (options.privateKey) {
      this.signer = new Wallet(options.privateKey, this.provider);
      this.contract = new Contract(contractAddress, AGENT_ANCHOR_ABI, this.signer);
    } else {
      this.contract = new Contract(contractAddress, AGENT_ANCHOR_ABI, this.provider);
    }

    this.ipfsGateway = options.ipfsGateway || DEFAULT_IPFS_GATEWAY;

    // Set up IPFS client
    if (options.mockIpfs) {
      this.ipfsClient = createMockIpfsClient();
    } else {
      this.ipfsClient = new IpfsClient({
        apiToken: options.ipfsApiToken,
        gateway: this.ipfsGateway,
      });
    }
  }

  /**
   * Anchor a trace to IPFS and blockchain
   * @param trace - The agent trace to anchor
   * @param options - Optional anchor options
   * @returns Anchor result with transaction details
   */
  async anchorTrace(trace: AgentTrace, options?: AnchorOptions): Promise<AnchorResult> {
    // Validate trace
    const validation = validateTrace(trace);
    if (!validation.valid) {
      throw new Error(`Invalid trace: ${validation.error}`);
    }

    if (!this.signer) {
      throw new Error("Signer required for anchoring. Provide privateKey in options.");
    }

    // Compute hash
    const traceHash = hashTrace(trace);
    const agentIdBytes32 = stringToBytes32(trace.agentId);

    // Upload to IPFS or use provided URI
    let ipfsUri: string;
    if (options?.ipfsUri) {
      // SEC-006: Validate user-provided IPFS URI
      try {
        parseIpfsUri(options.ipfsUri);
      } catch (error) {
        throw new Error(`Invalid IPFS URI provided: ${options.ipfsUri}`);
      }
      ipfsUri = options.ipfsUri;
    } else {
      const uploadResult = await this.ipfsClient.upload(trace);
      ipfsUri = uploadResult.uri;
    }

    if (options?.dryRun) {
      // Estimate gas without submitting
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

    // Submit transaction with optional parent linking
    const anchorFn = this.contract.getFunction("anchorTrace");
    const parentTraceHash = options?.parentTraceHash || "0x" + "0".repeat(64);

    // Use 5-arg version if parent specified, otherwise 4-arg for backward compatibility
    const tx = parentTraceHash !== "0x" + "0".repeat(64)
      ? await anchorFn(traceHash, ipfsUri, agentIdBytes32, trace.granularity, parentTraceHash)
      : await anchorFn(traceHash, ipfsUri, agentIdBytes32, trace.granularity);

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
   * @param traceHash - The trace hash to verify
   * @param options - Optional verify options
   * @returns Verification result
   */
  async verifyTrace(traceHash: string, options?: { full?: boolean }): Promise<VerifyResult> {
    // First check if it exists using verifyTrace
    const verifyFn = this.contract.getFunction("verifyTrace");
    const [exists] = await verifyFn(traceHash);

    if (!exists) {
      return { exists: false };
    }

    // Use getAnchor for complete data (QA-001 fix)
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
        // Fetch from IPFS and verify hash
        const fetchedTrace = await this.ipfsClient.fetch<AgentTrace>(anchor.ipfsUri);
        const recomputedHash = hashTrace(fetchedTrace);
        const hashMatches = recomputedHash === traceHash;

        return {
          exists: true,
          hashMatches,
          anchor,
        };
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

  /**
   * Get traces by agent ID
   * @param agentId - The agent identifier
   * @returns Array of trace hashes
   * @deprecated Use getTracesByAgentPaginated for large datasets
   */
  async getTracesByAgent(agentId: string): Promise<string[]> {
    const agentIdBytes32 = stringToBytes32(agentId);
    const getTracesFn = this.contract.getFunction("getTracesByAgent");
    const hashes = await getTracesFn(agentIdBytes32);
    return (hashes as string[]).map((h: string) => h);
  }

  /**
   * Get traces by creator address
   * @param creator - The creator address
   * @returns Array of trace hashes
   * @deprecated Use getTracesByCreatorPaginated for large datasets
   */
  async getTracesByCreator(creator: string): Promise<string[]> {
    const getTracesFn = this.contract.getFunction("getTracesByCreator");
    const hashes = await getTracesFn(creator);
    return (hashes as string[]).map((h: string) => h);
  }

  /**
   * Get paginated traces by agent ID
   * @param agentId - The agent identifier
   * @param offset - Starting index (default 0)
   * @param limit - Maximum results (default 100)
   * @returns Object with traces array and total count
   */
  async getTracesByAgentPaginated(
    agentId: string,
    offset = 0,
    limit = 100
  ): Promise<{ traces: string[]; total: number }> {
    const agentIdBytes32 = stringToBytes32(agentId);
    const fn = this.contract.getFunction("getTracesByAgentPaginated");
    const [traces, total] = await fn(agentIdBytes32, offset, limit);
    return {
      traces: (traces as string[]).map((h: string) => h),
      total: Number(total),
    };
  }

  /**
   * Get paginated traces by creator address
   * @param creator - The creator address
   * @param offset - Starting index (default 0)
   * @param limit - Maximum results (default 100)
   * @returns Object with traces array and total count
   */
  async getTracesByCreatorPaginated(
    creator: string,
    offset = 0,
    limit = 100
  ): Promise<{ traces: string[]; total: number }> {
    const fn = this.contract.getFunction("getTracesByCreatorPaginated");
    const [traces, total] = await fn(creator, offset, limit);
    return {
      traces: (traces as string[]).map((h: string) => h),
      total: Number(total),
    };
  }

  /**
   * Estimate gas for anchoring a trace
   * @param trace - The trace to estimate for
   * @returns Gas estimation details
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

    const networkConfig = NETWORKS[this.network];
    const costInToken = (Number(totalCost) / 1e18).toFixed(8);

    return {
      gasLimit,
      gasPrice,
      totalCost,
      costInToken: `${costInToken} ${networkConfig.nativeCurrency.symbol}`,
    };
  }

  /**
   * Fetch trace data from IPFS
   * @param ipfsUri - IPFS URI to fetch
   * @returns Trace data
   */
  async fetchTrace(ipfsUri: string): Promise<AgentTrace> {
    return this.ipfsClient.fetch<AgentTrace>(ipfsUri);
  }

  /**
   * Get the IPFS client for direct access
   */
  getIpfsClient(): IpfsClient {
    return this.ipfsClient;
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

  // ============ Trace Linking Methods ============

  /**
   * Get the parent trace hash for a given trace
   * @param traceHash - The trace hash to query
   * @returns Parent trace info
   */
  async getParentTrace(traceHash: string): Promise<{ parentHash: string; hasParent: boolean }> {
    const fn = this.contract.getFunction("getParentTrace");
    const [parentHash, hasParent] = await fn(traceHash);
    return { parentHash, hasParent };
  }

  /**
   * Get all child traces for a given parent
   * @param parentTraceHash - The parent trace hash
   * @returns Array of child trace hashes
   * @deprecated Use getChildTracesPaginated for large datasets
   */
  async getChildTraces(parentTraceHash: string): Promise<string[]> {
    const fn = this.contract.getFunction("getChildTraces");
    const hashes = await fn(parentTraceHash);
    return (hashes as string[]).map((h: string) => h);
  }

  /**
   * Get paginated child traces for a given parent
   * @param parentTraceHash - The parent trace hash
   * @param offset - Starting index
   * @param limit - Maximum results to return
   * @returns Paginated children result
   */
  async getChildTracesPaginated(
    parentTraceHash: string,
    offset = 0,
    limit = 100
  ): Promise<{ children: string[]; total: number }> {
    const fn = this.contract.getFunction("getChildTracesPaginated");
    const [children, total] = await fn(parentTraceHash, offset, limit);
    return {
      children: (children as string[]).map((h: string) => h),
      total: Number(total),
    };
  }

  /**
   * Get the count of child traces
   * @param parentTraceHash - The parent trace hash
   * @returns Number of children
   */
  async getChildTraceCount(parentTraceHash: string): Promise<number> {
    const fn = this.contract.getFunction("getChildTraceCount");
    const count = await fn(parentTraceHash);
    return Number(count);
  }

  /**
   * Check if a trace is a root trace (no parent)
   * @param traceHash - The trace hash to check
   * @returns True if root trace
   */
  async isRootTrace(traceHash: string): Promise<boolean> {
    const fn = this.contract.getFunction("isRootTrace");
    return await fn(traceHash);
  }

  /**
   * Get the full lineage (ancestry) of a trace
   *
   * Traverses from the given trace up through its parents until reaching
   * a root trace (one with no parent) or hitting the maxDepth limit.
   *
   * @param traceHash - Starting trace hash
   * @param options - Lineage query options (maxDepth defaults to 100)
   * @returns TraceLineage with ancestors from trace to root
   *
   * @example
   * ```typescript
   * const lineage = await client.getTraceLineage(myTraceHash);
   * console.log(`Trace has ${lineage.depth} ancestors`);
   * console.log(`Root trace: ${lineage.root}`);
   * ```
   *
   * @throws Error if maxDepth is exceeded during traversal
   */
  async getTraceLineage(traceHash: string, options?: GetLineageOptions): Promise<TraceLineage> {
    return getTraceLineageHelper(this, traceHash, options);
  }

  /**
   * Get anchor data for a trace
   * @param traceHash - The trace hash to query
   * @returns Anchor data
   */
  async getAnchor(traceHash: string): Promise<Anchor> {
    const getAnchorFn = this.contract.getFunction("getAnchor");
    const anchorData = await getAnchorFn(traceHash);

    return {
      traceHash: anchorData.traceHash,
      ipfsUri: anchorData.ipfsUri,
      agentId: anchorData.agentId,
      granularity: Number(anchorData.granularity) as Granularity,
      creator: anchorData.creator,
      timestamp: Number(anchorData.timestamp),
      blockNumber: Number(anchorData.blockNumber),
      parentTraceHash: anchorData.parentTraceHash,
    };
  }

  /**
   * Get the full tree (descendants) from a root trace
   *
   * Traverses from the given trace down through all its descendants,
   * building a tree structure using BFS traversal.
   *
   * @param rootTraceHash - Root trace hash to start from
   * @param options - Tree query options (maxDepth, maxNodes, includeAnchors)
   * @returns TraceTreeNode with all descendants
   *
   * @example
   * ```typescript
   * const tree = await client.getTraceTree(rootHash, {
   *   maxDepth: 5,
   *   maxNodes: 100,
   *   includeAnchors: true
   * });
   * console.log(`Tree has ${tree.children.length} direct children`);
   * ```
   *
   * @throws Error if maxNodes is exceeded during traversal
   */
  async getTraceTree(rootTraceHash: string, options?: GetTreeOptions): Promise<TraceTreeNode> {
    return getTraceTreeHelper(this, rootTraceHash, options);
  }
}
