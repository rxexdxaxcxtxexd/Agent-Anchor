/**
 * Integration tests for the runtime wrapper.
 *
 * T097-T098: Full wrap→trace→sign→anchor flow and edge cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  InterceptorState,
  SigningContext,
  createRedactionContext,
  MemoryStorage,
  getDefaultStorageConfig,
  createCacheManager,
  verifySignature,
  verifyChainIntegrity,
  hashTraceEntry,
  signTraceEntry,
  GENESIS_HASH,
} from "../../src/runtime/index.js";
import type { SignedRecord, TraceEntry, CallbackConfig } from "../../src/runtime/types.js";

// Test helpers
function createTestEntry(id: string, method: string, args: unknown[], result?: unknown): TraceEntry {
  return {
    id,
    method,
    args,
    result,
    timestamp: Date.now(),
    duration: 100,
  };
}

// Valid test private key (DO NOT USE IN PRODUCTION)
const TEST_PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Integration - Full trace flow", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(getDefaultStorageConfig("test-integration", 1000));
    await storage.initialize();
  });

  it("should sign a trace entry and verify signature", async () => {
    const entry = createTestEntry("1", "greet", ["World"], "Hello, World!");

    const signed = await signTraceEntry(entry, TEST_PRIVATE_KEY, GENESIS_HASH);

    expect(signed.traceEntry).toEqual(entry);
    expect(signed.signature).toBeDefined();
    expect(signed.hash).toBeDefined();
    expect(signed.previousHash).toBe(GENESIS_HASH);
    expect(verifySignature(signed)).toBe(true);
  });

  it("should maintain chain integrity across multiple records", async () => {
    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const records: SignedRecord[] = [];

    // Sign three entries
    const entry1 = createTestEntry("1", "method1", ["a"], "result1");
    const signed1 = await signingContext.sign(entry1);
    records.push(signed1);

    const entry2 = createTestEntry("2", "method2", ["b"], "result2");
    const signed2 = await signingContext.sign(entry2);
    records.push(signed2);

    const entry3 = createTestEntry("3", "method3", ["c"], "result3");
    const signed3 = await signingContext.sign(entry3);
    records.push(signed3);

    // Verify chain integrity
    expect(verifyChainIntegrity(records)).toBe(true);

    // First record links to GENESIS_HASH
    expect(records[0].previousHash).toBe(GENESIS_HASH);

    // Subsequent records link to previous
    expect(records[1].previousHash).toBe(records[0].hash);
    expect(records[2].previousHash).toBe(records[1].hash);
  });

  it("should capture errors in trace entries", async () => {
    const entry: TraceEntry = {
      id: "error-1",
      method: "throwError",
      args: [],
      error: {
        name: "Error",
        message: "Test error",
        stack: "Error: Test error\n    at test.ts:1:1",
      },
      timestamp: Date.now(),
      duration: 50,
    };

    const signed = await signTraceEntry(entry, TEST_PRIVATE_KEY);

    expect(signed.traceEntry.error).toBeDefined();
    expect(signed.traceEntry.error?.name).toBe("Error");
    expect(signed.traceEntry.error?.message).toBe("Test error");
    expect(verifySignature(signed)).toBe(true);
  });

  it("should redact sensitive data before signing", async () => {
    const redactionContext = createRedactionContext({ enabled: true, builtins: true });

    const entry = createTestEntry(
      "redact-1",
      "processUser",
      ["user@example.com", "123-45-6789"],
      { email: "user@example.com", ssn: "123-45-6789" }
    );

    // Redact before signing
    const redactedEntry: TraceEntry = {
      ...entry,
      args: redactionContext.redactArgs(entry.args),
      result: redactionContext.redactResult(entry.result),
    };

    const signed = await signTraceEntry(redactedEntry, TEST_PRIVATE_KEY);

    // Verify redaction worked
    expect(signed.traceEntry.args[0]).toBe("[REDACTED]"); // email
    expect(signed.traceEntry.args[1]).toBe("[REDACTED]"); // SSN
    expect((signed.traceEntry.result as any).email).toBe("[REDACTED]");
    expect((signed.traceEntry.result as any).ssn).toBe("[REDACTED]");

    // Signature should still be valid
    expect(verifySignature(signed)).toBe(true);
  });

  it("should store and retrieve records from cache", async () => {
    const cacheManager = createCacheManager({
      storage,
      limit: 1000,
    });

    const signingContext = new SigningContext(TEST_PRIVATE_KEY);

    // Add multiple records
    for (let i = 0; i < 5; i++) {
      const entry = createTestEntry(`id_${i}`, `method_${i}`, [i], i * 2);
      const signed = await signingContext.sign(entry);
      await cacheManager.addRecord(signed);
    }

    // Retrieve all records
    const allRecords = await cacheManager.getAll();
    expect(allRecords.length).toBe(5);

    // Retrieve by status (all should be pending by default)
    const pending = await cacheManager.getByStatus("pending");
    expect(pending.length).toBe(5);
  });
});

describe("Integration - Edge cases", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage(getDefaultStorageConfig("test-edge", 1000));
    await storage.initialize();
  });

  it("should handle trace entries with parentId", async () => {
    const parentEntry = createTestEntry("parent-1", "outerMethod", ["data"]);
    const childEntry: TraceEntry = {
      ...createTestEntry("child-1", "innerMethod", ["nested"]),
      parentId: "parent-1",
    };

    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const parentSigned = await signingContext.sign(parentEntry);
    const childSigned = await signingContext.sign(childEntry);

    expect(childSigned.traceEntry.parentId).toBe("parent-1");
    expect(verifySignature(parentSigned)).toBe(true);
    expect(verifySignature(childSigned)).toBe(true);
  });

  it("should handle complex arguments and results", async () => {
    const complexArgs = [
      { nested: { deeply: { value: "test" } } },
      [1, 2, 3, [4, 5]],
      null,
      undefined,
      true,
      3.14159,
    ];

    const complexResult = {
      success: true,
      data: complexArgs,
      metadata: {
        timestamp: Date.now(),
        count: 42,
      },
    };

    const entry = createTestEntry("complex-1", "complexMethod", complexArgs, complexResult);
    const signed = await signTraceEntry(entry, TEST_PRIVATE_KEY);

    expect(signed.traceEntry.args).toEqual(complexArgs);
    expect(signed.traceEntry.result).toEqual(complexResult);
    expect(verifySignature(signed)).toBe(true);
  });

  it("should handle storage capacity warnings", async () => {
    const onStorageWarning = vi.fn();
    const callbacks: CallbackConfig = { onStorageWarning };

    const smallStorage = new MemoryStorage(getDefaultStorageConfig("small-test", 5));
    await smallStorage.initialize();

    const cacheManager = createCacheManager({
      storage: smallStorage,
      callbacks,
      limit: 5,
      warningThreshold: 0.6,
    });

    const signingContext = new SigningContext(TEST_PRIVATE_KEY);

    // Add records until warning triggers
    for (let i = 0; i < 4; i++) {
      const entry = createTestEntry(`id_${i}`, "test", [], null);
      const signed = await signingContext.sign(entry);
      await cacheManager.addRecord(signed);
    }

    expect(onStorageWarning).toHaveBeenCalled();
  });

  it("should detect tampering via hash verification", async () => {
    const entry = createTestEntry("tamper-1", "sensitiveMethod", ["secret"], "result");
    const signed = await signTraceEntry(entry, TEST_PRIVATE_KEY);

    // Original hash should match
    const originalHash = hashTraceEntry(entry);
    expect(signed.hash).toBe(originalHash);

    // Tampering changes the hash
    const tamperedEntry = { ...entry, result: "TAMPERED" };
    const tamperedHash = hashTraceEntry(tamperedEntry);
    expect(tamperedHash).not.toBe(originalHash);
  });

  it("should track interceptor call state", () => {
    const state = new InterceptorState();

    // Initially no parent
    expect(state.getCurrentParentId()).toBeUndefined();

    // Push a call
    state.pushCall("call-1");
    expect(state.getCurrentParentId()).toBe("call-1");

    // Push nested call
    state.pushCall("call-2");
    expect(state.getCurrentParentId()).toBe("call-2");

    // Pop back to parent
    state.popCall();
    expect(state.getCurrentParentId()).toBe("call-1");

    // Pop to empty
    state.popCall();
    expect(state.getCurrentParentId()).toBeUndefined();
  });

  it("should fire callbacks on trace capture", () => {
    const onActionCaptured = vi.fn();
    const callbacks: CallbackConfig = { onActionCaptured };

    const state = new InterceptorState(callbacks);

    const entry = createTestEntry("callback-1", "testMethod", ["arg"]);
    state.addTrace(entry);

    expect(onActionCaptured).toHaveBeenCalledTimes(1);
    expect(onActionCaptured).toHaveBeenCalledWith(entry);
  });

  it("should handle multiple signers with different keys", async () => {
    const key1 = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const key2 = "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

    const entry = createTestEntry("multi-1", "sharedMethod", [], "result");

    const signed1 = await signTraceEntry(entry, key1);
    const signed2 = await signTraceEntry(entry, key2);

    // Same entry produces same hash
    expect(signed1.hash).toBe(signed2.hash);

    // Different keys produce different signatures
    expect(signed1.signature).not.toBe(signed2.signature);

    // Both signatures are valid
    expect(verifySignature(signed1)).toBe(true);
    expect(verifySignature(signed2)).toBe(true);

    // Different signers
    expect(signed1.signerAddress).not.toBe(signed2.signerAddress);
  });

  it("should update anchor status through lifecycle", async () => {
    const cacheManager = createCacheManager({
      storage,
      limit: 1000,
    });

    const entry = createTestEntry("lifecycle-1", "test", [], null);
    const signed = await signTraceEntry(entry, TEST_PRIVATE_KEY);
    await cacheManager.addRecord(signed);

    // Initial status is pending
    let record = await cacheManager.get(signed.hash);
    expect(record?.anchorStatus?.status).toBe("pending");

    // Update to submitted
    await cacheManager.updateStatus(signed.hash, {
      status: "submitted",
      retryCount: 0,
      transactionHash: "0xtx123",
    });
    record = await cacheManager.get(signed.hash);
    expect(record?.anchorStatus?.status).toBe("submitted");

    // Update to confirmed
    await cacheManager.updateStatus(signed.hash, {
      status: "confirmed",
      retryCount: 0,
      transactionHash: "0xtx123",
      blockNumber: 12345,
      confirmedAt: Date.now(),
    });
    record = await cacheManager.get(signed.hash);
    expect(record?.anchorStatus?.status).toBe("confirmed");
  });
});
