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

/**
 * Client for interacting with Agent Anchor smart contracts
 *
 * @example
 * ```typescript
 * const client = new AgentAnchorClient({
 *   network: "base-testnet",
 *   privateKey: process.env.PRIVATE_KEY
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

  /**
   * Create a new AgentAnchorClient
   * @param options - Client configuration options
   */
  constructor(options: ClientOptions = {}) {
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
  }

  /**
   * Anchor a trace to IPFS and blockchain
   * @param trace - The agent trace to anchor
   * @param options - Optional anchor options
   * @returns Anchor result with transaction details
   */
  async anchorTrace(
    trace: AgentTrace,
    options?: { dryRun?: boolean }
  ): Promise<AnchorResult> {
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

    // TODO: Upload to IPFS (Phase 3)
    const ipfsUri = "ipfs://placeholder";

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
    const tx = await this.contract.anchorTrace(
      traceHash,
      ipfsUri,
      agentIdBytes32,
      trace.granularity
    );

    const receipt = await tx.wait();

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
  async verifyTrace(
    traceHash: string,
    options?: { full?: boolean }
  ): Promise<VerifyResult> {
    const [exists, ipfsUri, creator, timestamp] = await this.contract.verifyTrace(traceHash);

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
      // TODO: Fetch from IPFS and verify hash (Phase 4)
      return {
        exists: true,
        hashMatches: true, // Placeholder
        anchor,
      };
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
    const hashes = await this.contract.getTracesByAgent(agentIdBytes32);
    return hashes.map((h: string) => h);
  }

  /**
   * Estimate gas for anchoring a trace
   * @param trace - The trace to estimate for
   * @returns Gas estimation details
   */
  async estimateGas(trace: AgentTrace): Promise<GasEstimate> {
    const traceHash = hashTrace(trace);
    const agentIdBytes32 = stringToBytes32(trace.agentId);
    const ipfsUri = "ipfs://placeholder";

    const gasLimit = await this.contract.anchorTrace.estimateGas(
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
