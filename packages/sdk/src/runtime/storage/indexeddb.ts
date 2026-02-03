/**
 * IndexedDB storage backend for browser environments.
 *
 * Uses the idb library for a promise-based IndexedDB API.
 */

import type { IDBPDatabase } from "idb";
import type {
  SignedRecord,
  AnchorState,
  AnchorStatus,
  StorageStats,
} from "../types.js";
import type { CacheStorage, StorageConfig } from "./interface.js";

const DB_NAME = "agent-anchor-runtime";
const DB_VERSION = 1;
const STORE_NAME = "signed-records";

/**
 * IndexedDB-based storage for browser environments.
 */
export class IndexedDBStorage implements CacheStorage {
  private db: IDBPDatabase | null = null;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Dynamic import to avoid issues in Node.js
    const { openDB } = await import("idb");

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create the object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "hash" });
          // Indexes for efficient queries
          store.createIndex("byStatus", "anchorStatus.status");
          store.createIndex("byCreatedAt", "createdAt");
          store.createIndex("byParentId", "traceEntry.parentId");
        }
      },
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensureDb(): IDBPDatabase {
    if (!this.db) {
      throw new Error("IndexedDB not initialized. Call initialize() first.");
    }
    return this.db;
  }

  async append(record: SignedRecord): Promise<void> {
    const db = this.ensureDb();

    // Check storage limit
    const count = await db.count(STORE_NAME);
    if (count >= this.config.limit) {
      throw new Error(
        `Storage limit exceeded: ${count} records (limit: ${this.config.limit})`
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

    await db.add(STORE_NAME, recordToStore);
  }

  async getAll(): Promise<SignedRecord[]> {
    const db = this.ensureDb();
    const records = await db.getAllFromIndex(STORE_NAME, "byCreatedAt");
    return records as SignedRecord[];
  }

  async getByStatus(status: AnchorState): Promise<SignedRecord[]> {
    const db = this.ensureDb();
    const records = await db.getAllFromIndex(STORE_NAME, "byStatus", status);
    return records as SignedRecord[];
  }

  async updateStatus(hash: string, status: AnchorStatus): Promise<void> {
    const db = this.ensureDb();

    const record = await db.get(STORE_NAME, hash);
    if (!record) {
      throw new Error(`Record not found: ${hash}`);
    }

    const updated: SignedRecord = {
      ...(record as SignedRecord),
      anchorStatus: status,
    };

    await db.put(STORE_NAME, updated);
  }

  async get(hash: string): Promise<SignedRecord | null> {
    const db = this.ensureDb();
    const record = await db.get(STORE_NAME, hash);
    return (record as SignedRecord) ?? null;
  }

  async getStats(): Promise<StorageStats> {
    const db = this.ensureDb();

    const allRecords = await db.getAll(STORE_NAME);
    const records = allRecords as SignedRecord[];

    let pendingCount = 0;
    let confirmedCount = 0;
    let storageBytes = 0;

    for (const record of records) {
      // Count by status
      const status = record.anchorStatus?.status ?? "pending";
      if (status === "pending" || status === "submitted" || status === "failed") {
        pendingCount++;
      } else if (status === "confirmed" || status === "local-only") {
        confirmedCount++;
      }

      // Estimate storage size (rough approximation)
      storageBytes += JSON.stringify(record).length * 2; // UTF-16 encoding
    }

    return {
      totalRecords: records.length,
      pendingRecords: pendingCount,
      confirmedRecords: confirmedCount,
      storageBytes,
      capacityPercent: (records.length / this.config.limit) * 100,
    };
  }

  async clear(): Promise<void> {
    const db = this.ensureDb();
    await db.clear(STORE_NAME);
  }
}

/**
 * Check if IndexedDB is available in the current environment.
 */
export function isIndexedDBAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined"
  );
}
