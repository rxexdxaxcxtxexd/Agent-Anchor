/**
 * Storage interface abstraction for local cache.
 *
 * Defines the contract that all storage backends must implement.
 */

import type {
  SignedRecord,
  AnchorState,
  AnchorStatus,
  StorageStats,
} from "../types.js";

/**
 * Storage backend interface for local cache.
 *
 * Implementations must be thread-safe and support atomic operations
 * where possible to prevent data corruption.
 */
export interface CacheStorage {
  /**
   * Append a signed record to storage.
   *
   * @param record - The signed record to store
   * @throws Error if storage limit exceeded or write fails
   */
  append(record: SignedRecord): Promise<void>;

  /**
   * Get all records from storage.
   *
   * @returns Array of all signed records, ordered by createdAt
   */
  getAll(): Promise<SignedRecord[]>;

  /**
   * Get records filtered by anchor status.
   *
   * @param status - The anchor state to filter by
   * @returns Array of matching signed records
   */
  getByStatus(status: AnchorState): Promise<SignedRecord[]>;

  /**
   * Update a record's anchor status.
   *
   * @param hash - The record hash to update
   * @param status - The new anchor status
   * @throws Error if record not found
   */
  updateStatus(hash: string, status: AnchorStatus): Promise<void>;

  /**
   * Get a single record by its hash.
   *
   * @param hash - The record hash to look up
   * @returns The record if found, null otherwise
   */
  get(hash: string): Promise<SignedRecord | null>;

  /**
   * Get storage statistics.
   *
   * @returns Current storage statistics
   */
  getStats(): Promise<StorageStats>;

  /**
   * Clear all records from storage.
   *
   * Use with caution - this permanently deletes all data.
   */
  clear(): Promise<void>;

  /**
   * Initialize the storage backend.
   *
   * Called once before any other operations. Implementations should
   * set up any required resources (database connections, file handles, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Close the storage backend and release resources.
   *
   * Called when the runtime is shutting down.
   */
  close(): Promise<void>;
}

/**
 * Storage configuration options.
 */
export interface StorageConfig {
  /** Maximum number of records before warning (default: 10000) */
  limit: number;
  /** Storage name/path identifier */
  name: string;
}

/**
 * Storage event types for monitoring.
 */
export type StorageEventType =
  | "record_added"
  | "status_updated"
  | "storage_warning"
  | "storage_cleared";

/**
 * Storage event payload.
 */
export interface StorageEvent {
  type: StorageEventType;
  timestamp: number;
  data?: unknown;
}

/**
 * Storage event listener callback.
 */
export type StorageEventListener = (event: StorageEvent) => void;
