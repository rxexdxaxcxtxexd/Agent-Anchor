/**
 * Gas estimation and strategy utilities.
 *
 * Provides configurable gas strategies for blockchain transactions:
 * - normal: Standard gas prices from network
 * - aggressive: Higher gas for faster confirmation
 * - economy: Lower gas, willing to wait longer
 * - custom: User-specified gas parameters
 */

import { ethers } from "ethers";
import type { GasStrategy, ChainId } from "./types.js";
import { getChainConfig } from "./chains.js";

/**
 * Gas settings for a transaction.
 */
export interface GasSettings {
  /** Maximum total fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;
  /** Maximum priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;
  /** Legacy gas price (for non-EIP-1559 chains) */
  gasPrice?: bigint;
  /** Gas limit estimate */
  gasLimit?: bigint;
}

/**
 * Runtime gas estimate result.
 * Note: Named RuntimeGasEstimate to avoid conflict with the main SDK GasEstimate type.
 */
export interface RuntimeGasEstimate {
  /** Estimated gas units needed */
  gasLimit: bigint;
  /** Estimated total cost in wei */
  estimatedCost: bigint;
  /** Gas settings to use */
  settings: GasSettings;
}

/**
 * Default gas values when network data is unavailable.
 */
export const DEFAULT_GAS_VALUES = {
  /** Default max fee: 30 gwei */
  maxFeePerGas: BigInt(30000000000),
  /** Default priority fee: 1.5 gwei */
  maxPriorityFeePerGas: BigInt(1500000000),
  /** Default gas limit for anchor transaction */
  gasLimit: BigInt(100000),
};

/**
 * Strategy multipliers for fee adjustments.
 */
const STRATEGY_MULTIPLIERS = {
  aggressive: {
    maxFee: 1.5,
    priorityFee: 2.0,
  },
  economy: {
    maxFee: 0.8,
    priorityFee: 1.0,
  },
  normal: {
    maxFee: 1.0,
    priorityFee: 1.0,
  },
  standard: {
    maxFee: 1.0,
    priorityFee: 1.0,
  },
};

/**
 * Get gas settings based on strategy.
 *
 * @param strategy - Gas strategy name or custom settings
 * @param chainId - Optional chain ID for fee estimation
 * @returns Gas settings for transaction
 */
export async function getGasSettings(
  strategy: GasStrategy,
  chainId?: ChainId
): Promise<GasSettings> {
  // Custom strategy - use provided values directly
  if (typeof strategy === "object") {
    return {
      maxFeePerGas: BigInt(strategy.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(strategy.maxPriorityFeePerGas),
    };
  }

  // Get multipliers for strategy
  const multipliers = STRATEGY_MULTIPLIERS[strategy] || STRATEGY_MULTIPLIERS.normal;

  // If we have a chain ID, get current network fees
  if (chainId) {
    try {
      const chainConfig = getChainConfig(chainId);
      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
      const feeData = await provider.getFeeData();

      const baseFee = feeData.maxFeePerGas ?? DEFAULT_GAS_VALUES.maxFeePerGas;
      const priorityFee = feeData.maxPriorityFeePerGas ?? DEFAULT_GAS_VALUES.maxPriorityFeePerGas;

      return {
        maxFeePerGas: BigInt(Math.floor(Number(baseFee) * multipliers.maxFee)),
        maxPriorityFeePerGas: BigInt(Math.floor(Number(priorityFee) * multipliers.priorityFee)),
      };
    } catch {
      // Fall through to default values if network fetch fails
    }
  }

  // Use default values with multipliers
  return {
    maxFeePerGas: BigInt(Math.floor(Number(DEFAULT_GAS_VALUES.maxFeePerGas) * multipliers.maxFee)),
    maxPriorityFeePerGas: BigInt(Math.floor(Number(DEFAULT_GAS_VALUES.maxPriorityFeePerGas) * multipliers.priorityFee)),
  };
}

/**
 * Estimate gas for an anchor transaction.
 *
 * @param provider - Ethers provider
 * @param to - Contract address
 * @param data - Transaction data
 * @param strategy - Gas strategy
 * @returns Gas estimate with settings
 */
export async function estimateAnchorGas(
  provider: ethers.Provider,
  to: string,
  data: string,
  strategy: GasStrategy = "normal"
): Promise<RuntimeGasEstimate> {
  // Estimate gas limit
  let gasLimit: bigint;
  try {
    gasLimit = await provider.estimateGas({ to, data });
    // Add 20% buffer for safety
    gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
  } catch {
    gasLimit = DEFAULT_GAS_VALUES.gasLimit;
  }

  // Get gas settings
  const settings = await getGasSettings(strategy);
  settings.gasLimit = gasLimit;

  // Calculate estimated cost
  const maxFee = settings.maxFeePerGas ?? DEFAULT_GAS_VALUES.maxFeePerGas;
  const estimatedCost = gasLimit * maxFee;

  return {
    gasLimit,
    estimatedCost,
    settings,
  };
}

/**
 * Check if a gas strategy is valid.
 *
 * @param strategy - Strategy to validate
 * @returns true if valid
 */
export function isValidGasStrategy(strategy: unknown): strategy is GasStrategy {
  if (typeof strategy === "string") {
    return ["normal", "standard", "aggressive", "economy"].includes(strategy);
  }

  if (typeof strategy === "object" && strategy !== null) {
    const obj = strategy as Record<string, unknown>;
    return (
      typeof obj.maxFeePerGas === "string" &&
      typeof obj.maxPriorityFeePerGas === "string"
    );
  }

  return false;
}

/**
 * Format gas settings for display.
 *
 * @param settings - Gas settings to format
 * @returns Human-readable string
 */
export function formatGasSettings(settings: GasSettings): string {
  const parts: string[] = [];

  if (settings.maxFeePerGas !== undefined) {
    const gweiMaxFee = Number(settings.maxFeePerGas) / 1e9;
    parts.push(`Max Fee: ${gweiMaxFee.toFixed(2)} gwei`);
  }

  if (settings.maxPriorityFeePerGas !== undefined) {
    const gweiPriority = Number(settings.maxPriorityFeePerGas) / 1e9;
    parts.push(`Priority: ${gweiPriority.toFixed(2)} gwei`);
  }

  if (settings.gasLimit !== undefined) {
    parts.push(`Gas Limit: ${settings.gasLimit.toString()}`);
  }

  return parts.join(", ");
}

/**
 * Get recommended gas strategy based on urgency.
 *
 * @param urgency - How urgent the transaction is (0-1, where 1 is most urgent)
 * @returns Recommended gas strategy
 */
export function getRecommendedStrategy(urgency: number): GasStrategy {
  if (urgency >= 0.8) {
    return "aggressive";
  }
  if (urgency <= 0.2) {
    return "economy";
  }
  return "normal";
}
