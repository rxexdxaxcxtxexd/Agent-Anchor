/**
 * Two-phase consistency strategy.
 *
 * Phase 1: Sign locally and return immediately (with local record)
 * Phase 2: Anchor asynchronously and update status
 */

import type { SignedRecord } from "../types.js";
import type {
  ConsistencyStrategy,
  ConsistencyStrategyConfig,
  AnchorFunction,
  StatusUpdateFunction,
} from "./interface.js";

/**
 * Two-phase commit anchoring strategy.
 *
 * Combines the benefits of sync (local evidence) and async (fast return):
 * - Phase 1: Local signing creates tamper-evident record immediately
 * - Phase 2: Background anchoring updates status asynchronously
 *
 * Best for: Applications needing fast response with eventual chain confirmation
 */
export class TwoPhaseStrategy implements ConsistencyStrategy {
  readonly mode = "two-phase" as const;
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
    // Phase 1: Record is already signed (happens before this method)
    // Set initial status to pending
    await updateStatus(record.hash, {
      status: "pending",
      retryCount: 0,
    });

    // Phase 2: Start async anchoring with status tracking
    const anchorPromise = this.anchorWithStatusTracking(
      record,
      anchorFn,
      updateStatus
    );

    // Track for cleanup
    this.pendingAnchors.push(anchorPromise);

    // Return immediately - Phase 1 complete (local signed record exists)
  }

  private async anchorWithStatusTracking(
    record: SignedRecord,
    anchorFn: AnchorFunction,
    updateStatus: StatusUpdateFunction
  ): Promise<void> {
    try {
      // Update to submitted
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
        // Fire failed callback (status already updated to failed)
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
    } finally {
      // Remove from pending
      const idx = this.pendingAnchors.indexOf(
        this.anchorWithStatusTracking as unknown as Promise<void>
      );
      if (idx > -1) {
        this.pendingAnchors.splice(idx, 1);
      }
    }
  }

  async stop(): Promise<void> {
    // Wait for all pending anchors
    await Promise.allSettled(this.pendingAnchors);
    this.pendingAnchors = [];
  }
}
