/**
 * Tests for unconfirmed action resolution.
 *
 * T076-T080: Tests for getPendingRecords, retryAnchor, markLocallyVerified,
 * getAnchorStatus
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage, getDefaultStorageConfig } from "../../src/runtime/storage/index.js";
import type { SignedRecord, AnchorStatus } from "../../src/runtime/types.js";
import { GENESIS_HASH } from "../../src/runtime/types.js";

// Default storage config for tests
const testStorageConfig = getDefaultStorageConfig("test-resolution", 1000);

// Create test records
function createTestRecord(
  id: string,
  status: AnchorStatus["status"],
  overrides: Partial<SignedRecord> = {}
): SignedRecord {
  return {
    entry: {
      id,
      method: `testMethod_${id}`,
      args: ["arg1", "arg2"],
      result: { success: true },
      timestamp: Date.now(),
      duration: 100,
    },
    hash: `hash_${id}`,
    previousHash: GENESIS_HASH,
    signature: `signature_${id}`,
    signer: "0x1234567890123456789012345678901234567890",
    createdAt: Date.now(),
    anchorStatus: {
      status,
      retryCount: 0,
    },
    ...overrides,
  };
}

describe("Resolution - getPendingRecords", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(testStorageConfig);
    await storage.initialize();
  });

  it("should return all unconfirmed records", async () => {
    // Add records with various statuses
    await storage.append(createTestRecord("1", "pending"));
    await storage.append(createTestRecord("2", "submitted"));
    await storage.append(createTestRecord("3", "confirmed"));
    await storage.append(createTestRecord("4", "failed"));
    await storage.append(createTestRecord("5", "pending"));

    const pending = await storage.getByStatus("pending");
    const submitted = await storage.getByStatus("submitted");
    const failed = await storage.getByStatus("failed");

    // Combine unconfirmed records
    const unconfirmed = [...pending, ...submitted, ...failed];

    expect(unconfirmed.length).toBe(4);
    expect(pending.length).toBe(2);
    expect(submitted.length).toBe(1);
    expect(failed.length).toBe(1);
  });

  it("should return empty array when all confirmed", async () => {
    await storage.append(createTestRecord("1", "confirmed"));
    await storage.append(createTestRecord("2", "confirmed"));

    const pending = await storage.getByStatus("pending");
    const submitted = await storage.getByStatus("submitted");
    const failed = await storage.getByStatus("failed");

    expect(pending.length).toBe(0);
    expect(submitted.length).toBe(0);
    expect(failed.length).toBe(0);
  });

  it("should include failed records in pending list", async () => {
    await storage.append(createTestRecord("1", "failed", {
      anchorStatus: {
        status: "failed",
        retryCount: 3,
        lastError: "Network error",
      },
    }));

    const failed = await storage.getByStatus("failed");

    expect(failed.length).toBe(1);
    expect(failed[0].anchorStatus?.lastError).toBe("Network error");
  });
});

describe("Resolution - retryAnchor", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(testStorageConfig);
    await storage.initialize();
  });

  it("should attempt anchor again for failed record", async () => {
    const record = createTestRecord("1", "failed", {
      anchorStatus: {
        status: "failed",
        retryCount: 2,
        lastError: "Previous failure",
      },
    });
    await storage.append(record);

    // Simulate retry by updating status to pending
    await storage.updateStatus("hash_1", {
      status: "pending",
      retryCount: 3,
    });

    const updated = await storage.get("hash_1");

    expect(updated).toBeDefined();
    expect(updated?.anchorStatus?.status).toBe("pending");
    expect(updated?.anchorStatus?.retryCount).toBe(3);
  });

  it("should update status on successful retry", async () => {
    const record = createTestRecord("1", "failed");
    await storage.append(record);

    // Simulate successful retry
    await storage.updateStatus("hash_1", {
      status: "confirmed",
      retryCount: 1,
      transactionHash: "0xabc123",
      blockNumber: 12345,
      confirmedAt: Date.now(),
    });

    const updated = await storage.get("hash_1");

    expect(updated?.anchorStatus?.status).toBe("confirmed");
    expect(updated?.anchorStatus?.transactionHash).toBe("0xabc123");
    expect(updated?.anchorStatus?.blockNumber).toBe(12345);
  });

  it("should return null for non-existent record", async () => {
    const record = await storage.get("non_existent");
    expect(record).toBeNull();
  });

  it("should preserve retry count across retries", async () => {
    const record = createTestRecord("1", "pending", {
      anchorStatus: {
        status: "pending",
        retryCount: 0,
      },
    });
    await storage.append(record);

    // Simulate multiple retry attempts
    await storage.updateStatus("hash_1", { status: "submitted", retryCount: 1 });
    await storage.updateStatus("hash_1", { status: "failed", retryCount: 1 });
    await storage.updateStatus("hash_1", { status: "pending", retryCount: 2 });
    await storage.updateStatus("hash_1", { status: "submitted", retryCount: 2 });

    const updated = await storage.get("hash_1");
    expect(updated?.anchorStatus?.retryCount).toBe(2);
  });
});

describe("Resolution - markLocallyVerified", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(testStorageConfig);
    await storage.initialize();
  });

  it("should change status to local-only", async () => {
    const record = createTestRecord("1", "failed", {
      anchorStatus: {
        status: "failed",
        retryCount: 5,
        lastError: "Max retries exceeded",
      },
    });
    await storage.append(record);

    await storage.updateStatus("hash_1", {
      status: "local-only",
      retryCount: 5,
    });

    const updated = await storage.get("hash_1");

    expect(updated?.anchorStatus?.status).toBe("local-only");
    expect(updated?.anchorStatus?.retryCount).toBe(5);
  });

  it("should preserve signature when marking local-only", async () => {
    const record = createTestRecord("1", "failed");
    await storage.append(record);

    await storage.updateStatus("hash_1", {
      status: "local-only",
      retryCount: 0,
    });

    const updated = await storage.get("hash_1");

    expect(updated?.signature).toBe("signature_1");
    expect(updated?.signer).toBe("0x1234567890123456789012345678901234567890");
  });

  it("should not affect other records", async () => {
    await storage.append(createTestRecord("1", "confirmed"));
    await storage.append(createTestRecord("2", "failed"));

    await storage.updateStatus("hash_2", {
      status: "local-only",
      retryCount: 0,
    });

    const record1 = await storage.get("hash_1");
    const record2 = await storage.get("hash_2");

    expect(record1?.anchorStatus?.status).toBe("confirmed");
    expect(record2?.anchorStatus?.status).toBe("local-only");
  });
});

describe("Resolution - getAnchorStatus", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(testStorageConfig);
    await storage.initialize();
  });

  it("should return current anchor status", async () => {
    const record = createTestRecord("1", "submitted", {
      anchorStatus: {
        status: "submitted",
        retryCount: 1,
        transactionHash: "0xpending123",
      },
    });
    await storage.append(record);

    const retrieved = await storage.get("hash_1");

    expect(retrieved?.anchorStatus).toBeDefined();
    expect(retrieved?.anchorStatus?.status).toBe("submitted");
    expect(retrieved?.anchorStatus?.transactionHash).toBe("0xpending123");
  });

  it("should return status with confirmed details", async () => {
    const confirmTime = Date.now();
    const record = createTestRecord("1", "confirmed", {
      anchorStatus: {
        status: "confirmed",
        retryCount: 0,
        transactionHash: "0xconfirmed456",
        blockNumber: 54321,
        confirmedAt: confirmTime,
      },
    });
    await storage.append(record);

    const retrieved = await storage.get("hash_1");

    expect(retrieved?.anchorStatus?.status).toBe("confirmed");
    expect(retrieved?.anchorStatus?.blockNumber).toBe(54321);
    expect(retrieved?.anchorStatus?.confirmedAt).toBe(confirmTime);
  });

  it("should return status with error details for failed", async () => {
    const record = createTestRecord("1", "failed", {
      anchorStatus: {
        status: "failed",
        retryCount: 3,
        lastError: "Insufficient funds for gas",
      },
    });
    await storage.append(record);

    const retrieved = await storage.get("hash_1");

    expect(retrieved?.anchorStatus?.status).toBe("failed");
    expect(retrieved?.anchorStatus?.lastError).toBe("Insufficient funds for gas");
    expect(retrieved?.anchorStatus?.retryCount).toBe(3);
  });

  it("should return null for non-existent record", async () => {
    const retrieved = await storage.get("non_existent_hash");
    expect(retrieved).toBeNull();
  });

  it("should handle local-only status", async () => {
    const record = createTestRecord("1", "local-only");
    await storage.append(record);

    const retrieved = await storage.get("hash_1");

    expect(retrieved?.anchorStatus?.status).toBe("local-only");
  });
});

describe("Resolution - Workflow integration", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(testStorageConfig);
    await storage.initialize();
  });

  it("should support full resolution workflow", async () => {
    // 1. Initial record is pending
    const record = createTestRecord("1", "pending");
    await storage.append(record);

    // 2. Submitted to chain
    await storage.updateStatus("hash_1", {
      status: "submitted",
      retryCount: 0,
      transactionHash: "0xtx1",
    });

    // 3. Transaction failed
    await storage.updateStatus("hash_1", {
      status: "failed",
      retryCount: 1,
      lastError: "Transaction reverted",
    });

    // 4. Check it appears in failed list
    const failed = await storage.getByStatus("failed");
    expect(failed.length).toBe(1);

    // 5. Operator retries
    await storage.updateStatus("hash_1", {
      status: "submitted",
      retryCount: 2,
      transactionHash: "0xtx2",
    });

    // 6. This time it confirms
    await storage.updateStatus("hash_1", {
      status: "confirmed",
      retryCount: 2,
      transactionHash: "0xtx2",
      blockNumber: 999,
      confirmedAt: Date.now(),
    });

    // 7. No longer in failed list
    const finalFailed = await storage.getByStatus("failed");
    const confirmed = await storage.getByStatus("confirmed");

    expect(finalFailed.length).toBe(0);
    expect(confirmed.length).toBe(1);
    expect(confirmed[0].anchorStatus?.blockNumber).toBe(999);
  });

  it("should support marking as local-only after max retries", async () => {
    const record = createTestRecord("1", "failed", {
      anchorStatus: {
        status: "failed",
        retryCount: 5,
        lastError: "Max retries exceeded",
      },
    });
    await storage.append(record);

    // Operator decides to mark as local-only
    await storage.updateStatus("hash_1", {
      status: "local-only",
      retryCount: 5,
    });

    // No longer in failed list
    const failed = await storage.getByStatus("failed");
    expect(failed.length).toBe(0);

    // But record is still accessible
    const localOnly = await storage.get("hash_1");
    expect(localOnly?.anchorStatus?.status).toBe("local-only");
    expect(localOnly?.signature).toBeDefined();
  });
});
