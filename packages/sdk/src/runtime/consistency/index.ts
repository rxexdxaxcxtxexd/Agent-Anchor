/**
 * Consistency strategy factory and exports.
 *
 * Creates the appropriate strategy based on configuration.
 */

import type { ConsistencyMode } from "../types.js";
import type { ConsistencyStrategy, ConsistencyStrategyConfig } from "./interface.js";
import { SyncStrategy } from "./sync.js";
import { AsyncStrategy } from "./async.js";
import { CacheStrategy } from "./cache.js";
import { TwoPhaseStrategy } from "./two-phase.js";

// Re-export types and interfaces
export type {
  ConsistencyStrategy,
  ConsistencyStrategyConfig,
  AnchorFunction,
  StatusUpdateFunction,
} from "./interface.js";

// Re-export strategy classes
export { SyncStrategy } from "./sync.js";
export { AsyncStrategy } from "./async.js";
export { CacheStrategy } from "./cache.js";
export { TwoPhaseStrategy } from "./two-phase.js";

/**
 * Create a consistency strategy based on the mode.
 *
 * @param mode - The consistency mode to use
 * @param config - Strategy configuration
 * @returns The appropriate strategy instance
 */
export function createConsistencyStrategy(
  mode: ConsistencyMode,
  config: ConsistencyStrategyConfig
): ConsistencyStrategy {
  switch (mode) {
    case "sync":
      return new SyncStrategy(config);
    case "async":
      return new AsyncStrategy(config);
    case "cache":
      return new CacheStrategy(config);
    case "two-phase":
      return new TwoPhaseStrategy(config);
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = mode;
      throw new Error(`Unknown consistency mode: ${_exhaustive}`);
  }
}

/**
 * Get the default consistency mode.
 */
export function getDefaultConsistencyMode(): ConsistencyMode {
  return "sync";
}

/**
 * Check if a mode supports batching.
 */
export function supportsBatching(mode: ConsistencyMode): boolean {
  return mode === "cache";
}

/**
 * Check if a mode blocks on anchor.
 */
export function blocksOnAnchor(mode: ConsistencyMode): boolean {
  return mode === "sync";
}

/**
 * Check if a mode provides immediate local evidence.
 */
export function providesLocalEvidence(mode: ConsistencyMode): boolean {
  // All modes sign locally first
  return true;
}

/**
 * Get a description of the consistency mode.
 */
export function getConsistencyModeDescription(mode: ConsistencyMode): string {
  switch (mode) {
    case "sync":
      return "Synchronous: Waits for chain confirmation before returning. Halts on failure.";
    case "async":
      return "Asynchronous: Returns immediately. Anchors in background.";
    case "cache":
      return "Cache: Batches records and flushes on interval for efficiency.";
    case "two-phase":
      return "Two-Phase: Signs locally immediately, anchors asynchronously with status tracking.";
    default:
      return "Unknown mode";
  }
}
