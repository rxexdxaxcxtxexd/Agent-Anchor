/**
 * Asynchronous consistency strategy.
 *
 * Signs locally and returns immediately. Anchoring happens in the background.
 */

import type { SignedRecord } from "../types.js";
import type {
  ConsistencyStrategy,
  ConsistencyStrategyConfig,
  AnchorFunction,
  StatusUpdateFunction,
} from "./interface.js";

/**
 * Asynchronous anchoring strategy.
 *
 * - Returns immediately after signing
 * - Anchors in background without blocking
 * - Failures are logged via callbacks, not thrown
 */
export class AsyncStrategy implements ConsistencyStrategy {
  readonly mode = "async" as const;
  private config: ConsistencyStrategyConfig;
  private pendingAnchors: Promise<void>[] = [];

  constructor(config: ConsistencyStrategyConfig) {
    this.config = config;
  }

  async onActionComplete(
    record: SignedRecord,
    anchorFn: AnchorFunction,
    updateStatus: StatusUpdateFunction
  ): Promise<void> {
    // Start background anchoring
    const anchorPromise = this.anchorInBackground(
      record,
      anchorFn,
      updateStatus
    );

    // Track pending anchors for cleanup
    this.pendingAnchors.push(anchorPromise);

    // Clean up completed promises periodically
    this.pendingAnchors = this.pendingAnchors.filter(
      (p) =>
        p !==
        anchorPromise.then(() => {
          const idx = this.pendingAnchors.indexOf(anchorPromise);
          if (idx > -1) this.pendingAnchors.splice(idx, 1);
        })
    );

    // Return immediately - don't await
  }

  private async anchorInBackground(
    record: SignedRecord,
    anchorFn: AnchorFunction,
    updateStatus: StatusUpdateFunction
  ): Promise<void> {
    try {
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
        // Fire failed callback (but don't throw)
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
      }
    } catch (error) {
      // Update status to failed
      await updateStatus(record.hash, {
        status: "failed",
        retryCount: 0,
        lastError: error instanceof Error ? error.message : String(error),
      });

      // Fire failed callback
      if (this.config.callbacks?.onAnchorFailed) {
        try {
          this.config.callbacks.onAnchorFailed(
            record,
            error instanceof Error ? error : new Error(String(error))
          );
        } catch {
          // Ignore callback errors
        }
      }
    }
  }

  async stop(): Promise<void> {
    // Wait for all pending anchors to complete
    await Promise.allSettled(this.pendingAnchors);
    this.pendingAnchors = [];
  }
}
