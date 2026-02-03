/**
 * Filesystem JSON storage backend for Node.js environments.
 *
 * Stores signed records as JSON files on disk.
 */

import type {
  SignedRecord,
  AnchorState,
  AnchorStatus,
  StorageStats,
} from "../types.js";
import type { CacheStorage, StorageConfig } from "./interface.js";

/**
 * In-memory cache with filesystem persistence for Node.js.
 *
 * Records are kept in memory for fast access and periodically
 * flushed to disk. On initialization, records are loaded from disk.
 */
export class FilesystemStorage implements CacheStorage {
  private records: Map<string, SignedRecord> = new Map();
  private config: StorageConfig;
  private filePath: string;
  private isDirty = false;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  // Filesystem API (dynamically imported)
  private fs: typeof import("fs/promises") | null = null;
  private path: typeof import("path") | null = null;

  constructor(config: StorageConfig) {
    this.config = config;
    this.filePath = config.name.endsWith(".json")
      ? config.name
      : `${config.name}.json`;
  }

  async initialize(): Promise<void> {
    // Dynamic import for Node.js modules
    this.fs = await import("fs/promises");
    this.path = await import("path");

    // Ensure directory exists
    const dir = this.path.dirname(this.filePath);
    try {
      await this.fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    // Load existing records
    try {
      const data = await this.fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed)) {
        for (const record of parsed) {
          this.records.set(record.hash, record);
        }
      }
    } catch {
      // File doesn't exist or is invalid - start fresh
      this.records = new Map();
    }
  }

  async close(): Promise<void> {
    // Flush any pending changes
    if (this.isDirty) {
      await this.flush();
    }

    // Clear flush timeout
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private async flush(): Promise<void> {
    if (!this.fs) {
      throw new Error("Filesystem not initialized. Call initialize() first.");
    }

    const records = Array.from(this.records.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );

    await this.fs.writeFile(
      this.filePath,
      JSON.stringify(records, null, 2),
      "utf-8"
    );

    this.isDirty = false;
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) {
      return; // Already scheduled
    }

    this.flushTimeout = setTimeout(async () => {
      this.flushTimeout = null;
      if (this.isDirty) {
        await this.flush();
      }
    }, 1000); // Flush after 1 second of inactivity
  }

  async append(record: SignedRecord): Promise<void> {
    // Check storage limit
    if (this.records.size >= this.config.limit) {
      throw new Error(
        `Storage limit exceeded: ${this.records.size} records (limit: ${this.config.limit})`
      );
    }

    // Ensure record has default anchor status if not set
    const recordToStore: SignedRecord = {
      ...record,
      anchorStatus: record.anchorStatus ?? {
        status: "pending",
        retryCount: 0,
      },
    };

    this.records.set(record.hash, recordToStore);
    this.isDirty = true;
    this.scheduleFlush();
  }

  async getAll(): Promise<SignedRecord[]> {
    return Array.from(this.records.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }

  async getByStatus(status: AnchorState): Promise<SignedRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.anchorStatus?.status === status)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateStatus(hash: string, status: AnchorStatus): Promise<void> {
    const record = this.records.get(hash);
    if (!record) {
      throw new Error(`Record not found: ${hash}`);
    }

    const updated: SignedRecord = {
      ...record,
      anchorStatus: status,
    };

    this.records.set(hash, updated);
    this.isDirty = true;
    this.scheduleFlush();
  }

  async get(hash: string): Promise<SignedRecord | null> {
    return this.records.get(hash) ?? null;
  }

  async getStats(): Promise<StorageStats> {
    let pendingCount = 0;
    let confirmedCount = 0;
    let storageBytes = 0;

    for (const record of this.records.values()) {
      const status = record.anchorStatus?.status ?? "pending";
      if (status === "pending" || status === "submitted" || status === "failed") {
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
    this.isDirty = true;
    await this.flush();
  }
}

/**
 * Check if filesystem storage is available (Node.js environment).
 */
export function isFilesystemAvailable(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    typeof process.versions.node !== "undefined"
  );
}
