/**
 * Storage factory with environment detection.
 *
 * Automatically selects the appropriate storage backend based on
 * the runtime environment (browser vs Node.js).
 */

import type { CacheStorage, StorageConfig } from "./interface.js";
import { IndexedDBStorage, isIndexedDBAvailable } from "./indexeddb.js";
import { FilesystemStorage, isFilesystemAvailable } from "./filesystem.js";

// Re-export interface types
export type { CacheStorage, StorageConfig } from "./interface.js";

/**
 * Storage backend type.
 */
export type StorageBackend = "indexeddb" | "filesystem" | "memory";

/**
 * In-memory storage for testing or ephemeral use.
 *
 * Data is lost when the process exits.
 */
export class MemoryStorage implements CacheStorage {
  private records: Map<string, import("../types.js").SignedRecord> = new Map();
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // No-op for memory storage
  }

  async close(): Promise<void> {
    // No-op for memory storage
  }

  async append(record: import("../types.js").SignedRecord): Promise<void> {
    if (this.records.size >= this.config.limit) {
      throw new Error(
        `Storage limit exceeded: ${this.records.size} records (limit: ${this.config.limit})`
      );
    }

    const recordToStore = {
      ...record,
      anchorStatus: record.anchorStatus ?? {
        status: "pending" as const,
        retryCount: 0,
      },
    };

    this.records.set(record.hash, recordToStore);
  }

  async getAll(): Promise<import("../types.js").SignedRecord[]> {
    return Array.from(this.records.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }

  async getByStatus(
    status: import("../types.js").AnchorState
  ): Promise<import("../types.js").SignedRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.anchorStatus?.status === status)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateStatus(
    hash: string,
    status: import("../types.js").AnchorStatus
  ): Promise<void> {
    const record = this.records.get(hash);
    if (!record) {
      throw new Error(`Record not found: ${hash}`);
    }

    this.records.set(hash, { ...record, anchorStatus: status });
  }

  async get(hash: string): Promise<import("../types.js").SignedRecord | null> {
    return this.records.get(hash) ?? null;
  }

  async getStats(): Promise<import("../types.js").StorageStats> {
    let pendingCount = 0;
    let confirmedCount = 0;
    let storageBytes = 0;

    for (const record of this.records.values()) {
      const status = record.anchorStatus?.status ?? "pending";
      if (
        status === "pending" ||
        status === "submitted" ||
        status === "failed"
      ) {
        pendingCount++;
      } else if (status === "confirmed" || status === "local-only") {
        confirmedCount++;
      }

      storageBytes += JSON.stringify(record).length * 2;
    }

    return {
      totalRecords: this.records.size,
      pendingRecords: pendingCount,
      confirmedRecords: confirmedCount,
      storageBytes,
      capacityPercent: (this.records.size / this.config.limit) * 100,
    };
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

/**
 * Detect the appropriate storage backend for the current environment.
 *
 * @returns The detected storage backend type
 */
export function detectStorageBackend(): StorageBackend {
  if (isIndexedDBAvailable()) {
    return "indexeddb";
  }
  if (isFilesystemAvailable()) {
    return "filesystem";
  }
  return "memory";
}

/**
 * Create a storage instance based on the backend type.
 *
 * @param backend - Storage backend type (or 'auto' for detection)
 * @param config - Storage configuration
 * @returns Storage instance (not yet initialized)
 */
export function createStorage(
  backend: StorageBackend | "auto",
  config: StorageConfig
): CacheStorage {
  const effectiveBackend = backend === "auto" ? detectStorageBackend() : backend;

  switch (effectiveBackend) {
    case "indexeddb":
      return new IndexedDBStorage(config);
    case "filesystem":
      return new FilesystemStorage(config);
    case "memory":
      return new MemoryStorage(config);
    default:
      throw new Error(`Unknown storage backend: ${effectiveBackend}`);
  }
}

/**
 * Create and initialize a storage instance.
 *
 * @param backend - Storage backend type (or 'auto' for detection)
 * @param config - Storage configuration
 * @returns Initialized storage instance
 */
export async function createAndInitializeStorage(
  backend: StorageBackend | "auto",
  config: StorageConfig
): Promise<CacheStorage> {
  const storage = createStorage(backend, config);
  await storage.initialize();
  return storage;
}

/**
 * Get default storage configuration.
 *
 * @param name - Optional storage name/path
 * @param limit - Optional record limit
 * @returns Storage configuration with defaults
 */
export function getDefaultStorageConfig(
  name = "agent-anchor-cache",
  limit = 10000
): StorageConfig {
  // For filesystem, use a platform-appropriate path
  let storagePath = name;

  if (isFilesystemAvailable()) {
    // In Node.js, use a path in the user's home directory or current directory
    const homeDir =
      process.env.HOME || process.env.USERPROFILE || process.cwd();
    storagePath = `${homeDir}/.agent-anchor/${name}.json`;
  }

  return {
    name: storagePath,
    limit,
  };
}
