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
} from "./types.js";
import { hashTrace, validateTrace, stringToBytes32 } from "./utils.js";
import { IpfsClient, createMockIpfsClient } from "./ipfs.js";

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

    // Submit transaction
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
   * @param traceHash - The trace hash to verify
   * @param options - Optional verify options
   * @returns Verification result
   */
  async verifyTrace(traceHash: string, options?: { full?: boolean }): Promise<VerifyResult> {
    const verifyFn = this.contract.getFunction("verifyTrace");
    const [exists, ipfsUri, creator, timestamp] = await verifyFn(traceHash);

    if (!exists) {
      return { exists: false };
    }

    const anchor: Anchor = {
      traceHash,
      ipfsUri,
      agentId: "", // Would need additional query
      granularity: 0 as Granularity, // Would need additional query
      creator,
      timestamp: Number(timestamp),
      blockNumber: 0, // Would need to query from events
    };

    if (options?.full) {
      try {
        // Fetch from IPFS and verify hash
        const fetchedTrace = await this.ipfsClient.fetch<AgentTrace>(ipfsUri);
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
   */
  async getTracesByAgent(agentId: string): Promise<string[]> {
    const agentIdBytes32 = stringToBytes32(agentId);
    const getTracesFn = this.contract.getFunction("getTracesByAgent");
    const hashes = await getTracesFn(agentIdBytes32);
    return (hashes as string[]).map((h: string) => h);
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
}
