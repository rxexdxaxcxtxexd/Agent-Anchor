/**
 * Chain configuration for supported blockchain networks.
 */

import type { ChainId, ChainConfig } from "./types.js";

/**
 * Chain configurations for all supported networks.
 */
export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  polygon: {
    chainId: 137,
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    contractAddress: "", // To be set from deployed contracts
  },
  base: {
    chainId: 8453,
    name: "Base Mainnet",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    contractAddress: "", // To be set from deployed contracts
  },
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    contractAddress: "", // To be set from deployed contracts
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    contractAddress: "", // To be set from deployed contracts
  },
  "base-sepolia": {
    chainId: 84532,
    name: "Base Sepolia Testnet",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    contractAddress: "", // To be set from deployed contracts
  },
};

/**
 * Get chain configuration by chain ID.
 *
 * @param chainId - Chain identifier
 * @returns Chain configuration
 * @throws Error if chain is not supported
 */
export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return config;
}

/**
 * Get block explorer URL for a transaction.
 *
 * @param chainId - Chain identifier
 * @param txHash - Transaction hash
 * @returns Full URL to transaction on block explorer
 */
export function getTransactionExplorerUrl(
  chainId: ChainId,
  txHash: string
): string {
  const config = getChainConfig(chainId);
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address.
 *
 * @param chainId - Chain identifier
 * @param address - Ethereum address
 * @returns Full URL to address on block explorer
 */
export function getAddressExplorerUrl(
  chainId: ChainId,
  address: string
): string {
  const config = getChainConfig(chainId);
  return `${config.explorerUrl}/address/${address}`;
}

/**
 * Get block explorer URL for a block.
 *
 * @param chainId - Chain identifier
 * @param blockNumber - Block number
 * @returns Full URL to block on block explorer
 */
export function getBlockExplorerUrl(
  chainId: ChainId,
  blockNumber: number
): string {
  const config = getChainConfig(chainId);
  return `${config.explorerUrl}/block/${blockNumber}`;
}

/**
 * Check if a chain is a testnet.
 *
 * @param chainId - Chain identifier
 * @returns true if the chain is a testnet
 */
export function isTestnet(chainId: ChainId): boolean {
  return chainId === "sepolia" || chainId === "base-sepolia";
}

/**
 * Get numeric chain ID from string chain identifier.
 *
 * @param chainId - String chain identifier
 * @returns Numeric chain ID
 */
export function getNumericChainId(chainId: ChainId): number {
  return getChainConfig(chainId).chainId;
}

/**
 * Get chain identifier from numeric chain ID.
 *
 * @param numericId - Numeric chain ID
 * @returns String chain identifier or null if not found
 */
export function getChainIdFromNumeric(numericId: number): ChainId | null {
  for (const [key, config] of Object.entries(CHAIN_CONFIGS)) {
    if (config.chainId === numericId) {
      return key as ChainId;
    }
  }
  return null;
}

/**
 * Update chain contract address.
 *
 * Used to configure the AgentAnchor contract address for each chain
 * after deployment.
 *
 * @param chainId - Chain identifier
 * @param contractAddress - Deployed contract address
 */
export function setChainContractAddress(
  chainId: ChainId,
  contractAddress: string
): void {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  config.contractAddress = contractAddress;
}
