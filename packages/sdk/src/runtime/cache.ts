/**
 * Local cache management for signed records.
 *
 * Provides a high-level interface for storing and retrieving
 * signed records with lifecycle management and callback support.
 */

import type {
  SignedRecord,
  AnchorStatus,
  AnchorState,
  StorageStats,
  CallbackConfig,
} from "./types.js";
import type { CacheStorage } from "./storage/index.js";

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Storage backend */
  storage: CacheStorage;
  /** Maximum number of records before warning */
  limit?: number;
  /** Percentage at which to trigger warning (default: 0.8 = 80%) */
  warningThreshold?: number;
  /** Lifecycle callbacks */
  callbacks?: CallbackConfig;
}

/**
 * Cache manager for signed records.
 *
 * Wraps a storage backend with additional functionality
 * for lifecycle management and monitoring.
 */
export class CacheManager {
  private storage: CacheStorage;
  private callbacks?: CallbackConfig;
  private warningThreshold: number;
  private warningTriggered = false;
  private limit: number;

  constructor(config: CacheConfig) {
    this.storage = config.storage;
    this.callbacks = config.callbacks;
    this.warningThreshold = config.warningThreshold ?? 0.8;
    this.limit = config.limit ?? 1000;
  }

  /**
   * Add a signed record to the cache.
   *
   * @param record - The signed record to store
   */
  async addRecord(record: SignedRecord): Promise<void> {
    await this.storage.append(record);

    // Fire onRecordSigned callback
    if (this.callbacks?.onRecordSigned) {
      try {
        this.callbacks.onRecordSigned(record);
      } catch {
        // Ignore callback errors
      }
    }

    // Check if we should warn about capacity
    await this.checkCapacity();
  }

  /**
   * Add a signed record (alias for addRecord).
   */
  async add(record: SignedRecord): Promise<void> {
    return this.addRecord(record);
  }

  /**
   * Get all signed records.
   */
  async getAll(): Promise<SignedRecord[]> {
    return this.storage.getAll();
  }

  /**
   * Get records by anchor status.
   */
  async getByStatus(status: AnchorState): Promise<SignedRecord[]> {
    return this.storage.getByStatus(status);
  }

  /**
   * Get all pending (not yet confirmed) records.
   *
   * Includes: pending, submitted, failed
   */
  async getPending(): Promise<SignedRecord[]> {
    const pending = await this.storage.getByStatus("pending");
    const submitted = await this.storage.getByStatus("submitted");
    const failed = await this.storage.getByStatus("failed");
    return [...pending, ...submitted, ...failed];
  }

  /**
   * Get a single record by hash.
   */
  async get(hash: string): Promise<SignedRecord | null> {
    return this.storage.get(hash);
  }

  /**
   * Update a record's anchor status with callback support.
   */
  async updateStatus(hash: string, status: AnchorStatus): Promise<void> {
    const record = await this.storage.get(hash);
    if (!record) {
      throw new Error(`Record not found: ${hash}`);
    }

    await this.storage.updateStatus(hash, status);

    // Fire appropriate callback based on status
    try {
      if (status.status === "submitted" && this.callbacks?.onAnchorPending && status.transactionHash) {
        this.callbacks.onAnchorPending(record, status.transactionHash);
      } else if (status.status === "confirmed" && this.callbacks?.onAnchorConfirmed && status.transactionHash) {
        // Create a TxReceipt from the available status data
        const receipt = {
          blockNumber: status.blockNumber ?? 0,
          blockHash: status.transactionHash, // Use txHash as placeholder
          transactionHash: status.transactionHash,
          gasUsed: BigInt(0),
          effectiveGasPrice: BigInt(0),
        };
        this.callbacks.onAnchorConfirmed(record, receipt);
      } else if (status.status === "failed" && this.callbacks?.onAnchorFailed) {
        const error = new Error("Anchor failed after maximum retries");
        this.callbacks.onAnchorFailed(record, error);
      }
    } catch {
      // Ignore callback errors
    }
  }

  /**
   * Mark a record as locally verified.
   *
   * This indicates the operator has acknowledged the local record
   * as sufficient evidence, even without on-chain confirmation.
   */
  async markLocallyVerified(hash: string): Promise<void> {
    const record = await this.storage.get(hash);
    if (!record) {
      throw new Error(`Record not found: ${hash}`);
    }

    await this.storage.updateStatus(hash, {
      status: "local-only",
      retryCount: record.anchorStatus?.retryCount ?? 0,
    });
  }

  /**
   * Get storage statistics.
   */
  async getStats(): Promise<StorageStats> {
    return this.storage.getStats();
  }

  /**
   * Get the most recent record (for chain continuation).
   */
  async getLatest(): Promise<SignedRecord | null> {
    const all = await this.storage.getAll();
    if (all.length === 0) {
      return null;
    }
    return all[all.length - 1] ?? null;
  }

  /**
   * Clear all records.
   */
  async clear(): Promise<void> {
    await this.storage.clear();
    this.warningTriggered = false;
  }

  /**
   * Check capacity and trigger warning if needed.
   */
  private async checkCapacity(): Promise<void> {
    const stats = await this.storage.getStats();
    const capacityRatio = stats.totalRecords / this.limit;

    if (capacityRatio >= this.warningThreshold && !this.warningTriggered) {
      this.warningTriggered = true;

      if (this.callbacks?.onStorageWarning) {
        try {
          this.callbacks.onStorageWarning(stats);
        } catch {
          // Ignore callback errors
        }
      }
    }
  }

  /**
   * Get records that need retry (failed status).
   */
  async getRetryable(): Promise<SignedRecord[]> {
    return this.storage.getByStatus("failed");
  }

  /**
   * Get count of records by status.
   */
  async getStatusCounts(): Promise<Record<AnchorState, number>> {
    const all = await this.storage.getAll();

    const counts: Record<AnchorState, number> = {
      pending: 0,
      submitted: 0,
      confirmed: 0,
      failed: 0,
      rejected: 0,
      "local-only": 0,
    };

    for (const record of all) {
      const status = record.anchorStatus?.status ?? "pending";
      counts[status]++;
    }

    return counts;
  }
}

/**
 * Create a cache manager with the given configuration.
 *
 * @param config - Cache configuration including storage and callbacks
 * @returns Configured cache manager
 */
export function createCacheManager(config: CacheConfig): CacheManager {
  return new CacheManager(config);
}
