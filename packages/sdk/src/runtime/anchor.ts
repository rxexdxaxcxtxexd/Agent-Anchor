/**
 * AgentAnchor SDK integration layer.
 *
 * Bridges the runtime wrapper with the existing AgentAnchor SDK
 * for on-chain anchoring of signed records.
 */

import { ethers } from "ethers";
import type {
  SignedRecord,
  AnchorStatus,
  ChainId,
  GasStrategy,
  CustomGasConfig,
  TxReceipt,
} from "./types.js";
import { getChainConfig, getTransactionExplorerUrl } from "./chains.js";

/**
 * Options for anchoring a signed record.
 */
export interface AnchorOptions {
  /** Target blockchain network */
  chain: ChainId;
  /** Gas pricing strategy */
  gasStrategy: GasStrategy;
  /** Custom gas configuration (if gasStrategy is 'custom') */
  customGas?: CustomGasConfig;
  /** Maximum retry attempts */
  maxRetries: number;
}

/**
 * Result of an anchor operation.
 */
export interface AnchorResult {
  /** Whether the anchor was successful */
  success: boolean;
  /** Updated anchor status */
  status: AnchorStatus;
  /** Transaction receipt (if successful) */
  receipt?: TxReceipt;
  /** Error message (if failed) */
  error?: string;
  /** Block explorer URL (if submitted) */
  explorerUrl?: string;
}

/**
 * Anchor integration service.
 *
 * Handles the submission of signed records to the blockchain
 * using the AgentAnchor smart contracts.
 */
export class AnchorService {
  private signer: ethers.Signer;
  private options: AnchorOptions;
  private contract: ethers.Contract | null = null;

  constructor(signer: ethers.Signer, options: AnchorOptions) {
    this.signer = signer;
    this.options = options;
  }

  /**
   * Initialize the anchor service by connecting to the contract.
   */
  async initialize(): Promise<void> {
    const config = getChainConfig(this.options.chain);

    if (!config.contractAddress) {
      throw new Error(
        `AgentAnchor contract address not configured for chain: ${this.options.chain}`
      );
    }

    // Minimal ABI for anchoring - just the function we need
    const abi = [
      "function anchorTrace(bytes32 traceHash, string ipfsUri, bytes32 parentTraceHash) returns (bytes32)",
      "event TraceAnchored(bytes32 indexed traceHash, address indexed owner, string ipfsUri, uint256 timestamp)",
    ];

    this.contract = new ethers.Contract(
      config.contractAddress,
      abi,
      this.signer
    );
  }

  /**
   * Anchor a signed record to the blockchain.
   *
   * @param record - The signed record to anchor
   * @param ipfsUri - IPFS URI containing the full trace data
   * @param parentHash - Parent trace hash (or zero hash for root)
   * @returns Anchor result
   */
  async anchor(
    record: SignedRecord,
    ipfsUri: string,
    parentHash: string
  ): Promise<AnchorResult> {
    if (!this.contract) {
      throw new Error("AnchorService not initialized. Call initialize() first.");
    }

    // Store reference for use in loop (avoids repeated null checks)
    const contract = this.contract;

    let lastError: string | undefined;
    let retryCount = 0;

    while (retryCount <= this.options.maxRetries) {
      try {
        // Get gas options
        const gasOptions = await this.getGasOptions();

        // Submit transaction - use indexed access for dynamic method
        const tx = await (contract as any).anchorTrace(
          record.hash,
          ipfsUri,
          parentHash,
          gasOptions
        );

        // Return pending status with tx hash
        const pendingStatus: AnchorStatus = {
          status: "submitted",
          transactionHash: tx.hash,
          retryCount,
        };

        // Wait for confirmation
        const receipt = await tx.wait();

        // Build successful result
        const confirmedStatus: AnchorStatus = {
          status: "confirmed",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: Date.now(),
          retryCount,
        };

        const txReceipt: TxReceipt = {
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.gasPrice ?? BigInt(0),
        };

        return {
          success: true,
          status: confirmedStatus,
          receipt: txReceipt,
          explorerUrl: getTransactionExplorerUrl(this.options.chain, receipt.hash),
        };
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Unknown error occurred";

        // Check for user rejection
        if (this.isUserRejection(error)) {
          return {
            success: false,
            status: {
              status: "rejected",
              retryCount,
              lastError: "Transaction rejected by user",
            },
          };
        }

        retryCount++;

        // Add delay between retries (exponential backoff)
        if (retryCount <= this.options.maxRetries) {
          await this.delay(Math.pow(2, retryCount) * 1000);
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      status: {
        status: "failed",
        retryCount,
        lastError,
      },
      error: lastError,
    };
  }

  /**
   * Retry anchoring a previously failed record.
   *
   * @param record - The signed record to retry
   * @param ipfsUri - IPFS URI containing the full trace data
   * @param parentHash - Parent trace hash (or zero hash for root)
   * @param currentStatus - Current anchor status
   * @returns Anchor result
   */
  async retryAnchor(
    record: SignedRecord,
    ipfsUri: string,
    parentHash: string,
    currentStatus: AnchorStatus
  ): Promise<AnchorResult> {
    // Reset retry count for retry operation
    const result = await this.anchor(record, ipfsUri, parentHash);

    // Preserve total retry count
    if (result.status.retryCount !== undefined) {
      result.status.retryCount += currentStatus.retryCount;
    }

    return result;
  }

  /**
   * Get gas options based on the configured strategy.
   */
  private async getGasOptions(): Promise<ethers.Overrides> {
    const provider = this.signer.provider;
    if (!provider) {
      return {};
    }

    const feeData = await provider.getFeeData();
    const strategy = this.options.gasStrategy;

    // Handle custom object strategy
    if (typeof strategy === "object" && strategy !== null) {
      return {
        maxFeePerGas: strategy.maxFeePerGas ? BigInt(strategy.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: strategy.maxPriorityFeePerGas ? BigInt(strategy.maxPriorityFeePerGas) : undefined,
      };
    }

    // Handle string strategies
    switch (strategy) {
      case "aggressive":
        // Increase priority fee by 50% for faster inclusion
        return {
          maxFeePerGas: feeData.maxFeePerGas
            ? (feeData.maxFeePerGas * BigInt(150)) / BigInt(100)
            : undefined,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            ? (feeData.maxPriorityFeePerGas * BigInt(150)) / BigInt(100)
            : undefined,
        };

      case "economy":
        // Use lower fees for cost savings
        return {
          maxFeePerGas: feeData.maxFeePerGas
            ? (feeData.maxFeePerGas * BigInt(80)) / BigInt(100)
            : undefined,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            ? (feeData.maxPriorityFeePerGas * BigInt(80)) / BigInt(100)
            : undefined,
        };

      case "normal":
      case "standard":
      default:
        return {
          maxFeePerGas: feeData.maxFeePerGas ?? undefined,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
        };
    }
  }

  /**
   * Check if an error indicates user rejection.
   */
  private isUserRejection(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("user rejected") ||
        message.includes("user denied") ||
        message.includes("rejected by user") ||
        message.includes("action_rejected")
      );
    }
    return false;
  }

  /**
   * Delay helper for retry backoff.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create an anchor service with a private key signer.
 *
 * @param privateKey - Private key (hex string, with or without 0x prefix)
 * @param options - Anchor options
 * @returns Configured anchor service
 */
export async function createAnchorServiceWithPrivateKey(
  privateKey: string,
  options: AnchorOptions
): Promise<AnchorService> {
  const config = getChainConfig(options.chain);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const signer = new ethers.Wallet(key, provider);

  const service = new AnchorService(signer, options);
  await service.initialize();

  return service;
}

/**
 * Create an anchor service with an existing signer.
 *
 * @param signer - ethers.js Signer instance
 * @param options - Anchor options
 * @returns Configured anchor service
 */
export async function createAnchorServiceWithSigner(
  signer: ethers.Signer,
  options: AnchorOptions
): Promise<AnchorService> {
  const service = new AnchorService(signer, options);
  await service.initialize();

  return service;
}
