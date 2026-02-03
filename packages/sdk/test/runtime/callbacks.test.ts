/**
 * Tests for lifecycle callbacks.
 *
 * T086-T091: Tests for onActionCaptured, onRecordSigned, onAnchorPending,
 * onAnchorConfirmed, onAnchorFailed, onStorageWarning
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { InterceptorState } from "../../src/runtime/interceptor.js";
import { CacheManager, createCacheManager } from "../../src/runtime/cache.js";
import { MemoryStorage, getDefaultStorageConfig } from "../../src/runtime/storage/index.js";
import type { TraceEntry, SignedRecord, AnchorStatus, CallbackConfig } from "../../src/runtime/types.js";
import { GENESIS_HASH } from "../../src/runtime/types.js";

// Test helpers
function createTestEntry(id: string): TraceEntry {
  return {
    id,
    method: "testMethod",
    args: ["arg1", "arg2"],
    result: { success: true },
    timestamp: Date.now(),
    duration: 100,
  };
}

function createTestRecord(id: string): SignedRecord {
  return {
    entry: createTestEntry(id),
    hash: `hash_${id}`,
    previousHash: GENESIS_HASH,
    signature: `sig_${id}`,
    signer: "0x1234567890123456789012345678901234567890",
    createdAt: Date.now(),
    anchorStatus: {
      status: "pending",
      retryCount: 0,
    },
  };
}

describe("Callbacks - onActionCaptured", () => {
  it("should fire when method is intercepted", () => {
    const onActionCaptured = vi.fn();
    const callbacks: CallbackConfig = { onActionCaptured };

    const state = new InterceptorState(callbacks);
    const entry = createTestEntry("1");

    state.addTrace(entry);

    expect(onActionCaptured).toHaveBeenCalledTimes(1);
    expect(onActionCaptured).toHaveBeenCalledWith(entry);
  });

  it("should receive complete TraceEntry", () => {
    const onActionCaptured = vi.fn();
    const callbacks: CallbackConfig = { onActionCaptured };

    const state = new InterceptorState(callbacks);
    const entry: TraceEntry = {
      id: "test-id",
      method: "complexMethod",
      args: [{ nested: "data" }, [1, 2, 3]],
      result: { status: "ok", data: [1, 2, 3] },
      timestamp: 1234567890,
      duration: 250,
      parentId: "parent-id",
    };

    state.addTrace(entry);

    expect(onActionCaptured).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-id",
        method: "complexMethod",
        parentId: "parent-id",
      })
    );
  });

  it("should not throw if callback throws", () => {
    const onActionCaptured = vi.fn().mockImplementation(() => {
      throw new Error("Callback error");
    });
    const callbacks: CallbackConfig = { onActionCaptured };

    const state = new InterceptorState(callbacks);
    const entry = createTestEntry("1");

    // Should not throw
    expect(() => state.addTrace(entry)).not.toThrow();

    // Callback was still called
    expect(onActionCaptured).toHaveBeenCalled();
  });

  it("should fire for multiple traces", () => {
    const onActionCaptured = vi.fn();
    const callbacks: CallbackConfig = { onActionCaptured };

    const state = new InterceptorState(callbacks);

    state.addTrace(createTestEntry("1"));
    state.addTrace(createTestEntry("2"));
    state.addTrace(createTestEntry("3"));

    expect(onActionCaptured).toHaveBeenCalledTimes(3);
  });
});

describe("Callbacks - onRecordSigned", () => {
  it("should fire after signing", async () => {
    const onRecordSigned = vi.fn();
    const callbacks: CallbackConfig = { onRecordSigned };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("1");
    await cacheManager.addRecord(record);

    // onRecordSigned should be called
    expect(onRecordSigned).toHaveBeenCalledTimes(1);
    expect(onRecordSigned).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: "hash_1",
        signature: "sig_1",
      })
    );
  });

  it("should receive full SignedRecord", async () => {
    const onRecordSigned = vi.fn();
    const callbacks: CallbackConfig = { onRecordSigned };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("test");
    await cacheManager.addRecord(record);

    const calledWith = onRecordSigned.mock.calls[0][0];
    expect(calledWith.entry).toBeDefined();
    expect(calledWith.hash).toBeDefined();
    expect(calledWith.previousHash).toBeDefined();
    expect(calledWith.signature).toBeDefined();
    expect(calledWith.signer).toBeDefined();
  });
});

describe("Callbacks - onAnchorPending", () => {
  it("should fire when transaction is submitted", async () => {
    const onAnchorPending = vi.fn();
    const callbacks: CallbackConfig = { onAnchorPending };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("1");
    await cacheManager.addRecord(record);

    // Simulate status update to submitted
    await cacheManager.updateStatus("hash_1", {
      status: "submitted",
      retryCount: 0,
      transactionHash: "0xtx123",
    });

    expect(onAnchorPending).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: "hash_1",
      }),
      "0xtx123" // txHash string as per types.ts
    );
  });
});

describe("Callbacks - onAnchorConfirmed", () => {
  it("should fire with receipt on confirmation", async () => {
    const onAnchorConfirmed = vi.fn();
    const callbacks: CallbackConfig = { onAnchorConfirmed };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("1");
    await cacheManager.addRecord(record);

    // Simulate confirmation
    await cacheManager.updateStatus("hash_1", {
      status: "confirmed",
      retryCount: 0,
      transactionHash: "0xconfirmed456",
      blockNumber: 12345,
      confirmedAt: Date.now(),
    });

    expect(onAnchorConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: "hash_1",
      }),
      expect.objectContaining({
        transactionHash: "0xconfirmed456",
        blockNumber: 12345,
      })
    );
  });

  it("should include block number in confirmation", async () => {
    const onAnchorConfirmed = vi.fn();
    const callbacks: CallbackConfig = { onAnchorConfirmed };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("1");
    await cacheManager.addRecord(record);

    const confirmTime = Date.now();
    await cacheManager.updateStatus("hash_1", {
      status: "confirmed",
      retryCount: 1,
      transactionHash: "0xabc",
      blockNumber: 999999,
      confirmedAt: confirmTime,
    });

    // Receipt is the second argument - check TxReceipt fields
    const receiptArg = onAnchorConfirmed.mock.calls[0][1];
    expect(receiptArg.blockNumber).toBe(999999);
    expect(receiptArg.transactionHash).toBe("0xabc");
  });
});

describe("Callbacks - onAnchorFailed", () => {
  it("should fire with error after retries exhausted", async () => {
    const onAnchorFailed = vi.fn();
    const callbacks: CallbackConfig = { onAnchorFailed };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("1");
    await cacheManager.addRecord(record);

    // Simulate failure after retries
    await cacheManager.updateStatus("hash_1", {
      status: "failed",
      retryCount: 3,
      lastError: "Network timeout after 3 retries",
    });

    // onAnchorFailed receives (record, error: Error)
    expect(onAnchorFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: "hash_1",
      }),
      expect.any(Error)
    );
    
    // Verify error message
    const errorArg = onAnchorFailed.mock.calls[0][1] as Error;
    expect(errorArg.message).toBe("Anchor failed after maximum retries");
  });

  it("should pass an Error instance", async () => {
    const onAnchorFailed = vi.fn();
    const callbacks: CallbackConfig = { onAnchorFailed };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    const record = createTestRecord("1");
    await cacheManager.addRecord(record);

    await cacheManager.updateStatus("hash_1", {
      status: "failed",
      retryCount: 5,
    });

    const errorArg = onAnchorFailed.mock.calls[0][1];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe("Anchor failed after maximum retries");
  });
});

describe("Callbacks - onStorageWarning", () => {
  it("should fire at 80% capacity", async () => {
    const onStorageWarning = vi.fn();
    const callbacks: CallbackConfig = { onStorageWarning };

    // Create storage with limit of 10
    const storage = new MemoryStorage(getDefaultStorageConfig("test", 10));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
      limit: 10, // Match storage limit
      warningThreshold: 0.8, // 80%
    });

    // Add 7 records (70%)
    for (let i = 0; i < 7; i++) {
      const record = createTestRecord(`${i}`);
      record.hash = `hash_${i}`;
      await cacheManager.addRecord(record);
    }

    // No warning yet
    expect(onStorageWarning).not.toHaveBeenCalled();

    // Add 8th record (80% threshold crossed)
    const record8 = createTestRecord("8");
    record8.hash = "hash_8";
    await cacheManager.addRecord(record8);

    expect(onStorageWarning).toHaveBeenCalled();
  });

  it("should include current usage stats", async () => {
    const onStorageWarning = vi.fn();
    const callbacks: CallbackConfig = { onStorageWarning };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 10));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
      limit: 10, // Match storage limit
      warningThreshold: 0.5, // 50% for easier testing
    });

    // Add 5 records (50%)
    for (let i = 0; i < 5; i++) {
      const record = createTestRecord(`${i}`);
      record.hash = `hash_${i}`;
      await cacheManager.addRecord(record);
    }

    // Add 6th to cross threshold
    const record6 = createTestRecord("6");
    record6.hash = "hash_6";
    await cacheManager.addRecord(record6);

    // StorageStats includes totalRecords but not limit (limit is on CacheManager)
    expect(onStorageWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        totalRecords: expect.any(Number),
      })
    );
  });

  it("should not fire multiple times without reset", async () => {
    const onStorageWarning = vi.fn();
    const callbacks: CallbackConfig = { onStorageWarning };

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 10));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
      limit: 10, // Match storage limit
      warningThreshold: 0.5,
    });

    // Add records past threshold
    for (let i = 0; i < 8; i++) {
      const record = createTestRecord(`${i}`);
      record.hash = `hash_${i}`;
      await cacheManager.addRecord(record);
    }

    // Should only fire once when threshold first crossed
    expect(onStorageWarning).toHaveBeenCalledTimes(1);
  });
});

describe("Callbacks - Multiple callbacks", () => {
  it("should support multiple callbacks simultaneously", async () => {
    const onActionCaptured = vi.fn();
    const onRecordSigned = vi.fn();

    const callbacks: CallbackConfig = {
      onActionCaptured,
      onRecordSigned,
    };

    // Test onActionCaptured
    const state = new InterceptorState(callbacks);
    state.addTrace(createTestEntry("1"));
    expect(onActionCaptured).toHaveBeenCalled();

    // Test onRecordSigned
    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
      callbacks,
    });

    await cacheManager.addRecord(createTestRecord("1"));
    expect(onRecordSigned).toHaveBeenCalled();
  });

  it("should work without any callbacks configured", async () => {
    const state = new InterceptorState();

    // Should not throw when no callbacks
    expect(() => {
      state.addTrace(createTestEntry("1"));
    }).not.toThrow();

    const storage = new MemoryStorage(getDefaultStorageConfig("test", 100));
    await storage.initialize();

    const cacheManager = createCacheManager({
      storage,
    });

    // Should not throw
    await expect(cacheManager.addRecord(createTestRecord("1"))).resolves.not.toThrow();
  });
});
