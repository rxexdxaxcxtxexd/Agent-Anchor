/**
 * @agent-anchor/sdk
 *
 * TypeScript SDK for Agent Anchor on-chain trace verification.
 * Provides programmatic access to anchor and verify AI agent traces
 * on Polygon and Base blockchains.
 *
 * @packageDocumentation
 */

// Export types
export * from "./types.js";

// Export utilities
export * from "./utils.js";

// Export IPFS client
export { IpfsClient, createMockIpfsClient, ipfs } from "./ipfs.js";
export type { IpfsConfig, IpfsUploadResult } from "./ipfs.js";

// Export client
export { AgentAnchorClient } from "./client.js";

// Export constants
export * from "./constants.js";
