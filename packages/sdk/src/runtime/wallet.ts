/**
 * Wallet connection utilities for blockchain interactions.
 *
 * Supports three wallet types:
 * - Private key: Direct signing from environment/config
 * - Injected: MetaMask and other browser wallet extensions
 * - WalletConnect: QR-code based mobile wallet connection
 */

// Type declaration for browser globals
declare const window: (typeof globalThis & { ethereum?: any }) | undefined;

import { ethers } from "ethers";
import type { WalletConfig, ChainId } from "./types.js";
import { getChainConfig } from "./chains.js";

// Re-export gas utilities for convenience
export { getGasSettings } from "./gas.js";

/**
 * Error thrown when wallet connection fails.
 */
export class WalletConnectionError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "WalletConnectionError";
  }
}

/**
 * Wallet signer interface.
 */
export interface WalletSigner {
  /** Ethereum address */
  address: string;
  /** Sign a message */
  signMessage(message: string | Uint8Array): Promise<string>;
  /** Sign a transaction */
  signTransaction(transaction: ethers.TransactionLike): Promise<string>;
  /** Get the underlying ethers signer */
  getSigner(): ethers.Signer;
}

/**
 * Connected wallet state.
 */
export interface ConnectedWallet {
  /** Ethereum address */
  address: string;
  /** Wallet type */
  type: WalletConfig["type"];
  /** Chain ID */
  chainId?: number;
  /** Disconnect function */
  disconnect?: () => Promise<void>;
}

/**
 * Validate an Ethereum address.
 *
 * @param address - Address to validate
 * @returns true if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  if (!address.startsWith("0x")) return false;
  if (address.length !== 42) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validate a private key format.
 *
 * @param key - Private key to validate
 * @returns true if valid format
 */
export function isValidPrivateKey(key: string): boolean {
  const normalized = key.startsWith("0x") ? key.slice(2) : key;
  return /^[0-9a-fA-F]{64}$/.test(normalized);
}

/**
 * Create a wallet signer from configuration.
 *
 * @param config - Wallet configuration
 * @param chainId - Optional chain ID for RPC connection
 * @returns WalletSigner instance
 * @throws WalletConnectionError if configuration is invalid
 */
export async function createWalletSigner(
  config: WalletConfig,
  chainId?: ChainId
): Promise<WalletSigner> {
  if (config.type === "privateKey") {
    return createPrivateKeySigner(config.key, chainId);
  }

  if (config.type === "injected") {
    const connected = await connectInjectedWallet();
    // For injected wallets, we wrap the ethereum provider
    return createInjectedSigner(connected.address);
  }

  if (config.type === "walletconnect") {
    // WalletConnect implementation is deferred
    throw new WalletConnectionError(
      "WalletConnect not yet implemented. See tasks T070-T072.",
      "NOT_IMPLEMENTED"
    );
  }

  throw new WalletConnectionError(
    `Unknown wallet type: ${(config as any).type}`,
    "UNKNOWN_TYPE"
  );
}

/**
 * Create a signer from a private key.
 *
 * @param privateKey - Hex private key (with or without 0x prefix)
 * @param chainId - Optional chain ID for RPC connection
 * @returns WalletSigner instance
 */
async function createPrivateKeySigner(
  privateKey: string,
  chainId?: ChainId
): Promise<WalletSigner> {
  // Normalize key format
  const normalizedKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;

  if (!isValidPrivateKey(normalizedKey)) {
    throw new WalletConnectionError(
      "Invalid private key format. Must be 64 hex characters.",
      "INVALID_KEY"
    );
  }

  // Create ethers wallet
  let wallet: ethers.Wallet;

  if (chainId) {
    const chainConfig = getChainConfig(chainId);
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    wallet = new ethers.Wallet(normalizedKey, provider);
  } else {
    wallet = new ethers.Wallet(normalizedKey);
  }

  return {
    address: wallet.address,

    async signMessage(message: string | Uint8Array): Promise<string> {
      return wallet.signMessage(message);
    },

    async signTransaction(transaction: ethers.TransactionLike): Promise<string> {
      return wallet.signTransaction(transaction);
    },

    getSigner(): ethers.Signer {
      return wallet;
    },
  };
}

/**
 * Create a signer from an injected wallet.
 *
 * @param address - Connected address
 * @returns WalletSigner instance
 */
async function createInjectedSigner(address: string): Promise<WalletSigner> {
  const ethereum = getInjectedProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner(address);

  return {
    address,

    async signMessage(message: string | Uint8Array): Promise<string> {
      return signer.signMessage(message);
    },

    async signTransaction(transaction: ethers.TransactionLike): Promise<string> {
      return signer.signTransaction(transaction);
    },

    getSigner(): ethers.Signer {
      return signer;
    },
  };
}

/**
 * Get the injected Ethereum provider (e.g., MetaMask).
 *
 * @returns Injected ethereum provider
 * @throws WalletConnectionError if no provider found
 */
function getInjectedProvider(): ethers.Eip1193Provider {
  if (typeof window === "undefined") {
    throw new WalletConnectionError(
      "No window object. Injected wallets only work in browser environments.",
      "NO_WINDOW"
    );
  }

  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new WalletConnectionError(
      "No injected wallet found. Please install MetaMask or another Web3 wallet.",
      "NO_PROVIDER"
    );
  }

  return ethereum as ethers.Eip1193Provider;
}

/**
 * Connect to an injected wallet (MetaMask, etc.).
 *
 * @returns Connected wallet info
 * @throws WalletConnectionError on connection failure
 */
export async function connectInjectedWallet(): Promise<ConnectedWallet> {
  const ethereum = getInjectedProvider();

  try {
    // Request account access
    const accounts = await ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      throw new WalletConnectionError(
        "No accounts returned from wallet. Please unlock your wallet and try again.",
        "NO_ACCOUNTS"
      );
    }

    const address = accounts[0] as string;

    // Get current chain ID
    const chainIdHex = await ethereum.request({
      method: "eth_chainId",
    });
    const chainId = parseInt(chainIdHex as string, 16);

    return {
      address,
      type: "injected",
      chainId,
      async disconnect() {
        // Most injected wallets don't have a programmatic disconnect
        // The user must disconnect from the wallet UI
      },
    };
  } catch (error: unknown) {
    if (error instanceof WalletConnectionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Handle common MetaMask errors
    if (message.includes("User rejected") || message.includes("user rejected")) {
      throw new WalletConnectionError(
        "User rejected the wallet connection request.",
        "USER_REJECTED",
        error
      );
    }

    throw new WalletConnectionError(
      `Failed to connect injected wallet: ${message}`,
      "CONNECTION_FAILED",
      error
    );
  }
}

/**
 * Connect using WalletConnect.
 *
 * @param projectId - WalletConnect Cloud project ID
 * @param chains - Supported chain IDs
 * @returns Connected wallet info
 */
export async function connectWalletConnect(
  projectId: string,
  chains?: ChainId[]
): Promise<ConnectedWallet> {
  // WalletConnect v2 implementation requires additional dependencies
  // This is a placeholder that will be implemented in a future phase
  throw new WalletConnectionError(
    "WalletConnect not yet implemented. This requires @walletconnect/modal package.",
    "NOT_IMPLEMENTED"
  );
}

/**
 * Switch to a different chain (for injected wallets).
 *
 * @param chainId - Target chain ID
 * @throws WalletConnectionError if switch fails
 */
export async function switchChain(chainId: ChainId): Promise<void> {
  const ethereum = getInjectedProvider();
  const chainConfig = getChainConfig(chainId);

  try {
    // Request chain switch
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chainConfig.chainId.toString(16)}` }],
    });
  } catch (error: any) {
    // If chain is not added, try to add it
    if (error.code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${chainConfig.chainId.toString(16)}`,
              chainName: chainConfig.name,
              rpcUrls: [chainConfig.rpcUrl],
              blockExplorerUrls: [chainConfig.explorerUrl],
              // Default native currency for EVM chains
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        });
      } catch (addError) {
        throw new WalletConnectionError(
          `Failed to add chain ${chainConfig.name} to wallet`,
          "ADD_CHAIN_FAILED",
          addError
        );
      }
    } else {
      throw new WalletConnectionError(
        `Failed to switch to chain ${chainConfig.name}`,
        "SWITCH_CHAIN_FAILED",
        error
      );
    }
  }
}
