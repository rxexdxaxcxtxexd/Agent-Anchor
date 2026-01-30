/**
 * SDK Constants
 */

import type { Network } from "./types.js";

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Network configurations for supported chains
 */
export const NETWORKS: Record<Network, NetworkConfig> = {
  "polygon-mainnet": {
    chainId: 137,
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    contractAddress: "", // To be deployed
    explorerUrl: "https://polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
  "polygon-testnet": {
    chainId: 80002,
    name: "Polygon Amoy",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    contractAddress: "", // To be deployed
    explorerUrl: "https://amoy.polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
  "base-mainnet": {
    chainId: 8453,
    name: "Base Mainnet",
    rpcUrl: "https://mainnet.base.org",
    contractAddress: "", // To be deployed
    explorerUrl: "https://basescan.org",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  "base-testnet": {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    contractAddress: "", // To be deployed
    explorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  localhost: {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    contractAddress: "", // Set dynamically
    explorerUrl: "",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

/**
 * Default IPFS gateway
 */
export const DEFAULT_IPFS_GATEWAY = "https://w3s.link/ipfs/";

/**
 * AgentAnchor contract ABI (minimal for SDK usage)
 */
export const AGENT_ANCHOR_ABI = [
  {
    type: "function",
    name: "anchorTrace",
    inputs: [
      { name: "traceHash", type: "bytes32" },
      { name: "ipfsUri", type: "string" },
      { name: "agentId", type: "bytes32" },
      { name: "granularity", type: "uint8" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyTrace",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "ipfsUri", type: "string" },
      { name: "creator", type: "address" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTracesByAgent",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TraceAnchored",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "creator", type: "address", indexed: true },
    ],
  },
] as const;

/**
 * Default network
 */
export const DEFAULT_NETWORK: Network = "base-testnet";
