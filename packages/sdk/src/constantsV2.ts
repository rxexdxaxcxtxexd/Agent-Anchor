/**
 * V2 SDK Constants for Ownership Layer
 */

import type { Network } from "./types.js";

/**
 * V2 Network configuration (extends V1)
 */
export interface NetworkConfigV2 {
  chainId: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  contractAddressV2: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * V2 Network configurations with V2 contract addresses
 */
export const NETWORKS_V2: Record<Network, NetworkConfigV2> = {
  "polygon-mainnet": {
    chainId: 137,
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    contractAddress: "",
    contractAddressV2: "", // To be deployed
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
    contractAddress: "",
    contractAddressV2: "", // To be deployed
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
    contractAddress: "",
    contractAddressV2: "", // To be deployed
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
    contractAddress: "",
    contractAddressV2: "", // To be deployed
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
    contractAddress: "",
    contractAddressV2: "", // Set dynamically
    explorerUrl: "",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

/**
 * EIP-712 Domain for AgentAnchor V2
 */
export const EIP712_DOMAIN = {
  name: "AgentAnchor",
  version: "2",
};

/**
 * EIP-712 Types for TraceIdentity
 */
export const EIP712_TYPES = {
  TraceIdentity: [
    { name: "traceHash", type: "bytes32" },
    { name: "initiator", type: "address" },
    { name: "timestamp", type: "uint256" },
    { name: "purpose", type: "string" },
  ] as Array<{ name: string; type: string }>,
};

/**
 * Valid purposes for identity binding
 */
export const IDENTITY_PURPOSES = [
  "code-authorship",
  "audit-trail",
  "compliance",
] as const;

export type IdentityPurpose = (typeof IDENTITY_PURPOSES)[number];

/**
 * AgentAnchorV2 contract ABI (extends V1 with ownership functions)
 */
export const AGENT_ANCHOR_V2_ABI = [
  // V1 Functions
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

  // V2 Identity Binding Functions
  {
    type: "function",
    name: "bindIdentity",
    inputs: [
      { name: "traceHash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyIdentity",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      { name: "verified", type: "bool" },
      { name: "signer", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getIdentityBinding",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "signer", type: "address" },
          { name: "bindingTimestamp", type: "uint40" },
          { name: "signatureType", type: "uint8" },
          { name: "verified", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },

  // V2 Git Metadata Functions
  {
    type: "function",
    name: "setGitMetadata",
    inputs: [
      { name: "traceHash", type: "bytes32" },
      { name: "commitSha", type: "bytes32" },
      { name: "branch", type: "string" },
      { name: "repository", type: "string" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getGitMetadata",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      { name: "commitSha", type: "bytes32" },
      { name: "hasMetadata", type: "bool" },
    ],
    stateMutability: "view",
  },

  // V2 Authorship Functions
  {
    type: "function",
    name: "declareAuthorship",
    inputs: [
      { name: "traceHash", type: "bytes32" },
      { name: "declarationType", type: "uint8" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAuthorship",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      { name: "claimant", type: "address" },
      { name: "declarationType", type: "uint8" },
      { name: "claimTimestamp", type: "uint256" },
      { name: "hasClaim", type: "bool" },
    ],
    stateMutability: "view",
  },

  // V2 Contribution Functions
  {
    type: "function",
    name: "setContribution",
    inputs: [
      { name: "traceHash", type: "bytes32" },
      { name: "humanPercent", type: "uint8" },
      { name: "aiPercent", type: "uint8" },
      { name: "notes", type: "string" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getContribution",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      { name: "humanPercent", type: "uint8" },
      { name: "aiPercent", type: "uint8" },
      { name: "hasContribution", type: "bool" },
    ],
    stateMutability: "view",
  },

  // V2 Combined Functions
  {
    type: "function",
    name: "getOwnershipRecord",
    inputs: [{ name: "traceHash", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "traceHash", type: "bytes32" },
          { name: "creator", type: "address" },
          { name: "anchorTimestamp", type: "uint256" },
          { name: "identitySigner", type: "address" },
          { name: "identityVerified", type: "bool" },
          { name: "claimant", type: "address" },
          { name: "declarationType", type: "uint8" },
          { name: "humanPercent", type: "uint8" },
          { name: "aiPercent", type: "uint8" },
          { name: "commitSha", type: "bytes32" },
          { name: "hasIdentity", type: "bool" },
          { name: "hasOwnership", type: "bool" },
          { name: "hasGitMetadata", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },

  // V2 Events
  {
    type: "event",
    name: "TraceAnchored",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "ipfsUri", type: "string", indexed: false },
      { name: "granularity", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IdentityBound",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "signer", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IdentityBoundWithSignature",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "signer", type: "address", indexed: true },
      { name: "signature", type: "bytes", indexed: false },
      { name: "purpose", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GitMetadataSet",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "commitSha", type: "bytes32", indexed: true },
      { name: "branch", type: "string", indexed: false },
      { name: "repository", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AuthorshipClaimed",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "declarationType", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ContributionSet",
    inputs: [
      { name: "traceHash", type: "bytes32", indexed: true },
      { name: "humanPercent", type: "uint8", indexed: false },
      { name: "aiPercent", type: "uint8", indexed: false },
      { name: "notes", type: "string", indexed: false },
    ],
  },
] as const;

/**
 * Default network for V2
 */
export const DEFAULT_NETWORK_V2: Network = "base-testnet";
