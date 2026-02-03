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

// Export V2 client
export { AgentAnchorClientV2 } from "./clientV2.js";
export type {
  ExtendedClientOptionsV2,
  BindIdentityResult,
  SetGitMetadataResult,
  DeclareAuthorshipResult,
  SetContributionResult,
} from "./clientV2.js";

// Export identity utilities
export {
  createIdentitySignature,
  verifyIdentitySignature,
  isValidIdentitySignature,
} from "./identity.js";
export type {
  IdentitySignatureParams,
  IdentitySignatureResult,
} from "./identity.js";

// Export git utilities
export {
  commitShaToBytes32,
  bytes32ToCommitSha,
  extractGitMetadata,
  createGitMetadata,
  isValidGitSha,
} from "./git.js";
export type {
  ExtractedGitMetadata,
  ExtractGitOptions,
} from "./git.js";

// Export authorship utilities
export {
  getDeclarationTypeLabel,
  getDeclarationTypeDescription,
  parseDeclarationType,
  validateAuthorshipClaim,
  createAuthorshipClaim,
  formatAuthorshipClaim,
  canClaimAuthorship,
} from "./authorship.js";

// Export contribution utilities
export {
  validateContribution,
  createContributionRatio,
  fromAiPercent,
  fromHumanPercent,
  formatContribution,
  getContributionDescription,
  parseContribution,
  CONTRIBUTION_PRESETS,
} from "./contribution.js";
export type { CalculationMethod } from "./contribution.js";

// Export trace linking utilities
export {
  getTraceLineage,
  isRootTraceHelper,
  getRootTrace,
  getTraceDepth,
  validateMaxDepth,
  validateMaxNodes,
  validateTreeOptions,
  getTraceTree,
  countTreeNodes,
  flattenTree,
  findTreeNode,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TREE_MAX_DEPTH,
  DEFAULT_TREE_MAX_NODES,
} from "./linking.js";
export type { TraceQueryClient, TreeQueryClient } from "./linking.js";

// Export constants
export * from "./constants.js";

// Export V2 constants
export * from "./constantsV2.js";

// Export Runtime Wrapper module
export * from "./runtime/index.js";
