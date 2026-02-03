/**
 * Synchronous consistency strategy.
 *
 * Anchoring completes before method returns. Halts execution on failure.
 * This is the default mode for compliance-critical deployments.
 */

import type { SignedRecord, AnchorStatus } from "../types.js";
import type {
  ConsistencyStrategy,
  ConsistencyStrategyConfig,
  AnchorFunction,
  StatusUpdateFunction,
} from "./interface.js";

/**
 * Synchronous anchoring strategy.
 *
 * - Waits for anchor confirmation before returning
 * - Throws error if anchoring fails after all retries
 * - Guarantees on-chain confirmation for every action
 */
export class SyncStrategy implements ConsistencyStrategy {
  readonly mode = "sync" as const;
  private config: ConsistencyStrategyConfig;

  constructor(config: ConsistencyStrategyConfig) {
    this.config = config;
  }

  async onActionComplete(
    record: SignedRecord,
    anchorFn: AnchorFunction,
    updateStatus: StatusUpdateFunction
  ): Promise<void> {
    // Update status to submitted
    await updateStatus(record.hash, {
      status: "submitted",
      retryCount: 0,
    });

    // Fire pending callback
    if (this.config.callbacks?.onAnchorPending) {
      try {
        this.config.callbacks.onAnchorPending(record, "pending");
      } catch {
        // Ignore callback errors
      }
    }

    // Attempt anchoring
    const result = await anchorFn(record);

    // Update status based on result
    await updateStatus(record.hash, result.status);

    if (result.success) {
      // Fire confirmed callback
      if (this.config.callbacks?.onAnchorConfirmed && result.receipt) {
        try {
          this.config.callbacks.onAnchorConfirmed(record, result.receipt);
        } catch {
          // Ignore callback errors
        }
      }
    } else {
      // Fire failed callback
      if (this.config.callbacks?.onAnchorFailed) {
        try {
          this.config.callbacks.onAnchorFailed(
            record,
            new Error(result.error ?? "Anchor failed")
          );
        } catch {
          // Ignore callback errors
        }
      }

      // In sync mode, failure halts execution
      throw new Error(
        `Anchor failed after ${result.status.retryCount} retries: ${result.error ?? "Unknown error"}`
      );
    }
  }

  async stop(): Promise<void> {
    // No cleanup needed for sync mode
  }
}
