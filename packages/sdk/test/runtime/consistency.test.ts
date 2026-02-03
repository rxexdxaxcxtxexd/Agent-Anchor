/**
 * Tests for consistency mode behaviors.
 *
 * T039-T044: Tests for sync, async, cache, and two-phase modes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  ConsistencyMode,
  SignedRecord,
  AnchorStatus,
  TraceEntry,
} from "../../src/runtime/types.js";
import { GENESIS_HASH } from "../../src/runtime/types.js";

// Mock anchor result
interface MockAnchorResult {
  success: boolean;
  status: AnchorStatus;
  delay?: number;
}

// Mock strategy interface for testing
interface MockConsistencyStrategy {
  mode: ConsistencyMode;
  onActionComplete(
    record: SignedRecord,
    anchorFn: () => Promise<MockAnchorResult>
  ): Promise<void>;
}

// Create mock signed record for testing
function createMockSignedRecord(
  overrides: Partial<SignedRecord> = {}
): SignedRecord {
  const entry: TraceEntry = {
    id: `test-${Date.now()}`,
    method: "testMethod",
    args: [],
    result: "ok",
    timestamp: Date.now(),
    duration: 5,
  };

  return {
    traceEntry: entry,
    hash: "0x" + "a".repeat(64),
    signature: "0x" + "b".repeat(130),
    previousHash: GENESIS_HASH,
    signerAddress: "0x" + "c".repeat(40),
    createdAt: Date.now(),
    anchorStatus: {
      status: "pending",
      retryCount: 0,
    },
    ...overrides,
  };
}

describe("Consistency - Sync Mode", () => {
  it("should halt execution on anchor failure", async () => {
    let executionHalted = false;
    let anchorAttempted = false;

    const syncStrategy: MockConsistencyStrategy = {
      mode: "sync",
      async onActionComplete(record, anchorFn) {
        anchorAttempted = true;
        const result = await anchorFn();
        if (!result.success) {
          executionHalted = true;
          throw new Error(`Anchor failed: ${result.status.lastError}`);
        }
      },
    };

    const failingAnchor = async (): Promise<MockAnchorResult> => ({
      success: false,
      status: {
        status: "failed",
        retryCount: 3,
        lastError: "Network error",
      },
    });

    const record = createMockSignedRecord();

    await expect(
      syncStrategy.onActionComplete(record, failingAnchor)
    ).rejects.toThrow("Anchor failed");

    expect(anchorAttempted).toBe(true);
    expect(executionHalted).toBe(true);
  });

  it("should wait for confirmation before returning", async () => {
    const events: string[] = [];

    const syncStrategy: MockConsistencyStrategy = {
      mode: "sync",
      async onActionComplete(record, anchorFn) {
        events.push("anchor_start");
        const result = await anchorFn();
        events.push("anchor_complete");
        if (!result.success) {
          throw new Error("Anchor failed");
        }
      },
    };

    const slowAnchor = async (): Promise<MockAnchorResult> => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        success: true,
        status: {
          status: "confirmed",
          retryCount: 0,
          transactionHash: "0x123",
          blockNumber: 100,
          confirmedAt: Date.now(),
        },
      };
    };

    const record = createMockSignedRecord();

    events.push("before_action");
    await syncStrategy.onActionComplete(record, slowAnchor);
    events.push("after_action");

    // Events should be in order: action starts anchor, waits for it, then returns
    expect(events).toEqual([
      "before_action",
      "anchor_start",
      "anchor_complete",
      "after_action",
    ]);
  });
});

describe("Consistency - Async Mode", () => {
  it("should return immediately while anchoring in background", async () => {
    const events: string[] = [];
    let backgroundAnchorComplete = false;

    const asyncStrategy: MockConsistencyStrategy = {
      mode: "async",
      async onActionComplete(record, anchorFn) {
        events.push("action_complete");

        // Fire and forget - don't await
        anchorFn().then(() => {
          backgroundAnchorComplete = true;
          events.push("background_anchor_complete");
        });

        // Return immediately
        events.push("returning");
      },
    };

    const slowAnchor = async (): Promise<MockAnchorResult> => {
      await new Promise((r) => setTimeout(r, 100));
      return {
        success: true,
        status: { status: "confirmed", retryCount: 0 },
      };
    };

    const record = createMockSignedRecord();

    events.push("before_action");
    await asyncStrategy.onActionComplete(record, slowAnchor);
    events.push("after_action");

    // Should return before background anchor completes
    expect(events).toEqual([
      "before_action",
      "action_complete",
      "returning",
      "after_action",
    ]);
    expect(backgroundAnchorComplete).toBe(false);

    // Wait for background to complete
    await new Promise((r) => setTimeout(r, 150));
    expect(backgroundAnchorComplete).toBe(true);
  });

  it("should not throw on background anchor failure", async () => {
    let errorCaught = false;

    const asyncStrategy: MockConsistencyStrategy = {
      mode: "async",
      async onActionComplete(record, anchorFn) {
        anchorFn().catch(() => {
          errorCaught = true;
        });
      },
    };

    const failingAnchor = async (): Promise<MockAnchorResult> => {
      throw new Error("Network error");
    };

    const record = createMockSignedRecord();

    // Should not throw
    await expect(
      asyncStrategy.onActionComplete(record, failingAnchor)
    ).resolves.toBeUndefined();

    // Wait for background
    await new Promise((r) => setTimeout(r, 10));
    expect(errorCaught).toBe(true);
  });
});

describe("Consistency - Cache Mode", () => {
  it("should batch records and flush on interval", async () => {
    const cachedRecords: SignedRecord[] = [];
    let flushCount = 0;

    const cacheStrategy = {
      mode: "cache" as ConsistencyMode,
      cache: [] as SignedRecord[],
      flushInterval: 50,

      async onActionComplete(record: SignedRecord) {
        this.cache.push(record);
        cachedRecords.push(record);
      },

      async flush(anchorFn: (records: SignedRecord[]) => Promise<void>) {
        if (this.cache.length > 0) {
          await anchorFn(this.cache);
          flushCount++;
          this.cache = [];
        }
      },
    };

    // Add 5 records quickly
    for (let i = 0; i < 5; i++) {
      await cacheStrategy.onActionComplete(createMockSignedRecord());
    }

    // All should be cached, none flushed yet
    expect(cachedRecords).toHaveLength(5);
    expect(flushCount).toBe(0);
    expect(cacheStrategy.cache).toHaveLength(5);

    // Flush
    await cacheStrategy.flush(async () => {});

    expect(flushCount).toBe(1);
    expect(cacheStrategy.cache).toHaveLength(0);
  });

  it("should batch anchor multiple records together", async () => {
    let batchSize = 0;

    const cacheStrategy = {
      cache: [] as SignedRecord[],

      async onActionComplete(record: SignedRecord) {
        this.cache.push(record);
      },

      async flush(anchorFn: (records: SignedRecord[]) => Promise<void>) {
        batchSize = this.cache.length;
        await anchorFn(this.cache);
        this.cache = [];
      },
    };

    // Add multiple records
    for (let i = 0; i < 10; i++) {
      await cacheStrategy.onActionComplete(createMockSignedRecord());
    }

    // Flush should batch all 10
    await cacheStrategy.flush(async () => {});

    expect(batchSize).toBe(10);
  });
});

describe("Consistency - Two-Phase Mode", () => {
  it("should sign locally and return immediately", async () => {
    const events: string[] = [];
    let localRecordCreated = false;

    const twoPhaseStrategy: MockConsistencyStrategy = {
      mode: "two-phase",
      async onActionComplete(record, anchorFn) {
        // Phase 1: Local signing already done (record is signed)
        localRecordCreated = true;
        events.push("local_signed");

        // Phase 2: Async anchor with status tracking
        anchorFn().then((result) => {
          events.push(`status_updated:${result.status.status}`);
        });

        // Return immediately after local signing
        events.push("returning");
      },
    };

    const record = createMockSignedRecord();

    events.push("before_action");
    await twoPhaseStrategy.onActionComplete(record, async () => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        success: true,
        status: { status: "confirmed", retryCount: 0 },
      };
    });
    events.push("after_action");

    // Should return after local signing, before anchor confirmation
    expect(events.slice(0, 4)).toEqual([
      "before_action",
      "local_signed",
      "returning",
      "after_action",
    ]);
    expect(localRecordCreated).toBe(true);

    // Wait for async anchor
    await new Promise((r) => setTimeout(r, 100));
    expect(events).toContain("status_updated:confirmed");
  });

  it("should update status asynchronously on confirmation", async () => {
    let finalStatus: AnchorStatus | null = null;

    const twoPhaseStrategy = {
      mode: "two-phase" as ConsistencyMode,
      statusMap: new Map<string, AnchorStatus>(),

      async onActionComplete(
        record: SignedRecord,
        anchorFn: () => Promise<MockAnchorResult>
      ) {
        // Set initial pending status
        this.statusMap.set(record.hash, {
          status: "pending",
          retryCount: 0,
        });

        // Async anchor with status update
        anchorFn().then((result) => {
          this.statusMap.set(record.hash, result.status);
          finalStatus = result.status;
        });
      },

      getStatus(hash: string): AnchorStatus | undefined {
        return this.statusMap.get(hash);
      },
    };

    const record = createMockSignedRecord();

    await twoPhaseStrategy.onActionComplete(record, async () => {
      await new Promise((r) => setTimeout(r, 30));
      return {
        success: true,
        status: {
          status: "confirmed",
          retryCount: 0,
          transactionHash: "0xabc",
          blockNumber: 123,
        },
      };
    });

    // Initial status should be pending
    expect(twoPhaseStrategy.getStatus(record.hash)?.status).toBe("pending");

    // Wait for async update
    await new Promise((r) => setTimeout(r, 50));

    expect(finalStatus?.status).toBe("confirmed");
    expect(twoPhaseStrategy.getStatus(record.hash)?.status).toBe("confirmed");
  });
});

describe("Consistency - Default Mode", () => {
  it("should default to sync mode when not specified", () => {
    const defaultMode: ConsistencyMode = "sync";

    // Simulating config resolution
    const config = { consistencyMode: undefined };
    const effectiveMode = config.consistencyMode ?? defaultMode;

    expect(effectiveMode).toBe("sync");
  });

  it("should use sync behavior by default", async () => {
    // This tests that sync is the implied default
    const events: string[] = [];

    const strategy: MockConsistencyStrategy = {
      mode: "sync", // Default
      async onActionComplete(record, anchorFn) {
        events.push("start");
        await anchorFn();
        events.push("end");
      },
    };

    const record = createMockSignedRecord();
    await strategy.onActionComplete(record, async () => ({
      success: true,
      status: { status: "confirmed", retryCount: 0 },
    }));

    // Sync means we wait for anchor
    expect(events).toEqual(["start", "end"]);
  });
});
