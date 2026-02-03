/**
 * Consistency strategy interface.
 *
 * Defines the contract for different anchoring consistency modes.
 */

import type {
  SignedRecord,
  AnchorStatus,
  ConsistencyMode,
  CallbackConfig,
} from "../types.js";
import type { AnchorResult } from "../anchor.js";

/**
 * Anchor function type passed to consistency strategies.
 */
export type AnchorFunction = (record: SignedRecord) => Promise<AnchorResult>;

/**
 * Status update function for async status tracking.
 */
export type StatusUpdateFunction = (
  hash: string,
  status: AnchorStatus
) => Promise<void>;

/**
 * Consistency strategy interface.
 *
 * Each consistency mode implements this interface to define
 * how anchoring relates to method execution.
 */
export interface ConsistencyStrategy {
  /** The consistency mode this strategy implements */
  readonly mode: ConsistencyMode;

  /**
   * Handle the completion of an action.
   *
   * Called after a method is intercepted and a signed record is created.
   * The strategy decides when/how to anchor the record.
   *
   * @param record - The signed record to anchor
   * @param anchorFn - Function to submit the record to the blockchain
   * @param updateStatus - Function to update the record's anchor status
   * @throws Error in sync mode if anchoring fails
   */
  onActionComplete(
    record: SignedRecord,
    anchorFn: AnchorFunction,
    updateStatus: StatusUpdateFunction
  ): Promise<void>;

  /**
   * Flush any pending records (for cache mode).
   *
   * No-op for non-cache modes.
   */
  flush?(): Promise<void>;

  /**
   * Stop the strategy and clean up resources.
   *
   * Should flush any pending records and cancel timers.
   */
  stop(): Promise<void>;
}

/**
 * Configuration for consistency strategies.
 */
export interface ConsistencyStrategyConfig {
  /** Maximum retry attempts for failed anchors */
  maxRetries: number;
  /** Flush interval for cache mode (ms) */
  cacheFlushInterval: number;
  /** Lifecycle callbacks */
  callbacks?: CallbackConfig;
}
