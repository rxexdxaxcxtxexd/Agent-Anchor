/**
 * SDK Constants
 *
 * DEPLOYMENT INSTRUCTIONS:
 *
 * To deploy the AgentAnchor contract to a new network:
 *
 * 1. Deploy the contract using Hardhat:
 *    ```bash
 *    cd packages/contracts
 *    npx hardhat run scripts/deploy.ts --network <network-name>
 *    ```
 *
 * 2. Update the contractAddress in NETWORKS below for the deployed network
 *
 * 3. For V2 features, also deploy AgentAnchorV2:
 *    ```bash
 *    npx hardhat run scripts/deployV2.ts --network <network-name>
 *    ```
 *
 * 4. Update NETWORKS_V2 in constantsV2.ts with the V2 contract address
 *
 * 5. Verify the contract on block explorer:
 *    ```bash
 *    npx hardhat verify --network <network-name> <contract-address>
 *    ```
 *
 * IMPORTANT: Contract addresses should be updated via PR after deployment,
 * not dynamically at runtime (except for localhost testing).
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
    name: "anchorTrace",
    inputs: [
      { name: "traceHash", type: "bytes32" },
      { name: "ipfsUri", type: "string" },
      { name: "agentId", type: "bytes32" },
      { name: "granularity", type: "uint8" },
      { name: "parentTraceHash", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getParentTrace",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      { name: "parentHash", type: "bytes32" },
      { name: "hasParent", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getChildTraces",
    inputs: [{ name: "parentTraceHash", type: "bytes32" }],
    outputs: [{ name: "childHashes", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getChildTracesPaginated",
    inputs: [
      { name: "parentTraceHash", type: "bytes32" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "childHashes", type: "bytes32[]" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getChildTraceCount",
    inputs: [{ name: "parentTraceHash", type: "bytes32" }],
    outputs: [{ name: "count", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRootTrace",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [{ name: "isRoot", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TraceLinked",
    inputs: [
      { name: "childTraceHash", type: "bytes32", indexed: true },
      { name: "parentTraceHash", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
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
    name: "getAnchor",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "traceHash", type: "bytes32" },
          { name: "ipfsUri", type: "string" },
          { name: "agentId", type: "bytes32" },
          { name: "granularity", type: "uint8" },
          { name: "creator", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
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
    type: "function",
    name: "getTracesByCreator",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTracesByAgentPaginated",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "traces", type: "bytes32[]" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTracesByCreatorPaginated",
    inputs: [
      { name: "creator", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "traces", type: "bytes32[]" },
      { name: "total", type: "uint256" },
    ],
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
