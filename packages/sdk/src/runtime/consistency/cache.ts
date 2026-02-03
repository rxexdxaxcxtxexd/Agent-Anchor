/**
 * Cache consistency strategy.
 *
 * Signs and caches locally. Batch anchors on interval.
 */

import type { SignedRecord } from "../types.js";
import type {
  ConsistencyStrategy,
  ConsistencyStrategyConfig,
  AnchorFunction,
  StatusUpdateFunction,
} from "./interface.js";

/**
 * Cache-based anchoring strategy.
 *
 * - Signs locally and caches records
 * - Flushes to blockchain on configurable interval
 * - Batches multiple records into single flush for efficiency
 */
export class CacheStrategy implements ConsistencyStrategy {
  readonly mode = "cache" as const;
  private config: ConsistencyStrategyConfig;
  private cache: SignedRecord[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private anchorFn: AnchorFunction | null = null;
  private updateStatusFn: StatusUpdateFunction | null = null;
  private isFlushing = false;

  constructor(config: ConsistencyStrategyConfig) {
    this.config = config;
  }

  async onActionComplete(
    record: SignedRecord,
    anchorFn: AnchorFunction,
    updateStatus: StatusUpdateFunction
  ): Promise<void> {
    // Store anchor function for later use
    this.anchorFn = anchorFn;
    this.updateStatusFn = updateStatus;

    // Add to cache
    this.cache.push(record);

    // Start flush timer if not already running
    if (!this.flushTimer) {
      this.startFlushTimer();
    }

    // Return immediately - anchoring will happen on flush
  }

  /**
   * Flush all cached records to blockchain.
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.cache.length === 0) {
      return;
    }

    if (!this.anchorFn || !this.updateStatusFn) {
      return;
    }

    this.isFlushing = true;

    try {
      // Get records to flush
      const recordsToFlush = [...this.cache];
      this.cache = [];

      // Anchor each record
      for (const record of recordsToFlush) {
        try {
          // Update status to submitted
          await this.updateStatusFn(record.hash, {
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
          const result = await this.anchorFn(record);

          // Update status
          await this.updateStatusFn(record.hash, result.status);

          if (result.success) {
            if (this.config.callbacks?.onAnchorConfirmed && result.receipt) {
              try {
                this.config.callbacks.onAnchorConfirmed(record, result.receipt);
              } catch {
                // Ignore callback errors
              }
            }
          } else {
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
          await this.updateStatusFn(record.hash, {
            status: "failed",
            retryCount: 0,
            lastError: error instanceof Error ? error.message : String(error),
          });

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
    } finally {
      this.isFlushing = false;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Ignore flush errors in timer
      });
    }, this.config.cacheFlushInterval);
  }

  async stop(): Promise<void> {
    // Stop timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining records
    await this.flush();
  }

  /**
   * Get the number of cached (unflushed) records.
   */
  getCacheSize(): number {
    return this.cache.length;
  }
}
