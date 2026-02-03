/**
 * Performance tests for the runtime wrapper.
 *
 * T099-T100: Verify signing overhead and 100+ actions/minute async
 *
 * Note: Thresholds are set for CI environments with variable performance.
 * Real-world sustained performance is typically much better than these thresholds.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  SigningContext,
  signTraceEntry,
  hashTraceEntry,
} from "../../src/runtime/index.js";
import type { TraceEntry } from "../../src/runtime/types.js";

// Valid test private key (DO NOT USE IN PRODUCTION)
const TEST_PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// Test helpers
function createTestEntry(id: string): TraceEntry {
  return {
    id,
    method: "testMethod",
    args: ["arg1", "arg2", { nested: "data" }],
    result: { success: true, value: 42 },
    timestamp: Date.now(),
    duration: 100,
  };
}

describe("Performance - Signing overhead", () => {
  // Warmup the cryptographic library before all tests in this suite
  beforeAll(async () => {
    await signTraceEntry(createTestEntry("global-warmup"), TEST_PRIVATE_KEY);
  });

  it("should hash a trace entry quickly", () => {
    const entry = createTestEntry("hash-perf-1");

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      hashTraceEntry(entry);
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`  Average hash time: ${avgTime.toFixed(3)}ms`);
    // Allow up to 3ms for CI variance; typical is <1ms
    expect(avgTime).toBeLessThan(3);
  });

  it("should sign a single entry efficiently", async () => {
    const entry = createTestEntry("sign-perf-1");

    const start = performance.now();
    await signTraceEntry(entry, TEST_PRIVATE_KEY);
    const elapsed = performance.now() - start;

    console.log(`  Single sign time: ${elapsed.toFixed(3)}ms`);
    // Allow 50ms for CI environments with high variance; typical is <10ms
    // The "average" tests below are more reliable indicators of real performance
    expect(elapsed).toBeLessThan(50);
  });

  it("should average reasonable time for multiple signatures", async () => {
    const iterations = 20;
    const entries = Array.from({ length: iterations }, (_, i) =>
      createTestEntry(`sign-multi-${i}`)
    );

    const start = performance.now();

    for (const entry of entries) {
      await signTraceEntry(entry, TEST_PRIVATE_KEY);
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`  Average sign time over ${iterations} entries: ${avgTime.toFixed(3)}ms`);
    // Allow 20ms average for CI environments; typical is <10ms
    expect(avgTime).toBeLessThan(20);
  });

  it("should sign with SigningContext maintaining chain state efficiently", async () => {
    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const iterations = 20;

    const entries = Array.from({ length: iterations }, (_, i) =>
      createTestEntry(`context-sign-${i}`)
    );

    const start = performance.now();

    for (const entry of entries) {
      await signingContext.sign(entry);
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`  Average SigningContext.sign time: ${avgTime.toFixed(3)}ms`);
    // Allow 35ms for CI environments with high variance; typical is <10ms
    expect(avgTime).toBeLessThan(35);
  });

  it("should hash complex entries within performance target", () => {
    // Create a more complex entry with larger args/result
    const complexEntry: TraceEntry = {
      id: "complex-perf-1",
      method: "processLargeData",
      args: [
        Array.from({ length: 100 }, (_, i) => ({ index: i, value: `item-${i}` })),
        { config: { nested: { deeply: { value: "test" } } } },
        "string argument with some length to it",
      ],
      result: {
        success: true,
        data: Array.from({ length: 50 }, (_, i) => ({ id: i, processed: true })),
        metadata: { processedAt: Date.now(), count: 50 },
      },
      timestamp: Date.now(),
      duration: 500,
    };

    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      hashTraceEntry(complexEntry);
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`  Average complex entry hash time: ${avgTime.toFixed(3)}ms`);
    // Allow 10ms for complex entries in CI; typical is <5ms
    expect(avgTime).toBeLessThan(10);
  });
});

describe("Performance - High throughput async mode", () => {
  // Warmup before throughput tests
  beforeAll(async () => {
    const ctx = new SigningContext(TEST_PRIVATE_KEY);
    await ctx.sign(createTestEntry("throughput-warmup"));
  });

  it("should handle 100+ actions per minute in async signing", async () => {
    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const targetActionsPerMinute = 100;
    const testDurationMs = 5000; // 5 second test
    const targetActions = Math.ceil((targetActionsPerMinute / 60) * (testDurationMs / 1000));

    console.log(`  Target: ${targetActions} actions in ${testDurationMs / 1000}s`);

    const entries = Array.from({ length: targetActions }, (_, i) =>
      createTestEntry(`async-throughput-${i}`)
    );

    const start = performance.now();

    // Sign all entries as fast as possible
    const promises = entries.map((entry) => signingContext.sign(entry));
    await Promise.all(promises);

    const elapsed = performance.now() - start;
    const actionsPerMinute = (targetActions / elapsed) * 60000;

    console.log(`  Completed ${targetActions} actions in ${elapsed.toFixed(0)}ms`);
    console.log(`  Rate: ${actionsPerMinute.toFixed(0)} actions/minute`);

    // Core requirement: must exceed 100 actions/minute
    expect(actionsPerMinute).toBeGreaterThan(targetActionsPerMinute);
  });

  it("should maintain reasonable latency under sustained load", async () => {
    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const iterations = 50;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const entry = createTestEntry(`sustained-${i}`);
      const start = performance.now();
      await signingContext.sign(entry);
      const elapsed = performance.now() - start;
      latencies.push(elapsed);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

    console.log(`  Average latency: ${avgLatency.toFixed(3)}ms`);
    console.log(`  P95 latency: ${p95Latency.toFixed(3)}ms`);
    console.log(`  Max latency: ${maxLatency.toFixed(3)}ms`);

    // Allow higher thresholds for CI environments
    expect(avgLatency).toBeLessThan(20); // Average < 20ms
    expect(p95Latency).toBeLessThan(30); // P95 < 30ms
  });

  it("should handle burst of concurrent sign requests", async () => {
    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const burstSize = 20;

    const entries = Array.from({ length: burstSize }, (_, i) =>
      createTestEntry(`burst-${i}`)
    );

    const start = performance.now();

    // All at once
    const results = await Promise.all(
      entries.map((entry) => signingContext.sign(entry))
    );

    const elapsed = performance.now() - start;
    const avgTimePerEntry = elapsed / burstSize;

    console.log(`  Burst of ${burstSize} completed in ${elapsed.toFixed(0)}ms`);
    console.log(`  Average time per entry: ${avgTimePerEntry.toFixed(3)}ms`);

    expect(results.length).toBe(burstSize);
    // Allow 20ms per entry under concurrent load in CI
    expect(avgTimePerEntry).toBeLessThan(20);
  });

  it("should scale linearly with number of entries", async () => {
    const signingContext = new SigningContext(TEST_PRIVATE_KEY);
    const sizes = [10, 20, 40];
    const timings: { size: number; time: number }[] = [];

    for (const size of sizes) {
      const entries = Array.from({ length: size }, (_, i) =>
        createTestEntry(`scale-${size}-${i}`)
      );

      const start = performance.now();
      for (const entry of entries) {
        await signingContext.sign(entry);
      }
      const elapsed = performance.now() - start;

      timings.push({ size, time: elapsed });
      console.log(`  ${size} entries: ${elapsed.toFixed(0)}ms (${(elapsed / size).toFixed(3)}ms/entry)`);
    }

    // Check that doubling entries roughly doubles time (allowing for some overhead)
    const ratio1to2 = timings[1].time / timings[0].time;
    const ratio2to3 = timings[2].time / timings[1].time;

    console.log(`  Scaling ratios: ${ratio1to2.toFixed(2)}x, ${ratio2to3.toFixed(2)}x`);

    // Should scale roughly linearly (between 1.3x and 3.5x when doubling)
    // Wider range to account for CI variance
    expect(ratio1to2).toBeGreaterThan(1.3);
    expect(ratio1to2).toBeLessThan(3.5);
    expect(ratio2to3).toBeGreaterThan(1.3);
    expect(ratio2to3).toBeLessThan(3.5);
  });
});

describe("Performance - Memory efficiency", () => {
  it("should not accumulate memory with many sign operations", async () => {
    const iterations = 100;

    // Take initial memory reading if available
    const initialMemory = (process as any).memoryUsage?.().heapUsed ?? 0;

    for (let i = 0; i < iterations; i++) {
      // Create new context each time to avoid chain state accumulation
      const signingContext = new SigningContext(TEST_PRIVATE_KEY);
      const entry = createTestEntry(`memory-${i}`);
      await signingContext.sign(entry);
    }

    // Take final memory reading if available
    const finalMemory = (process as any).memoryUsage?.().heapUsed ?? 0;

    if (initialMemory && finalMemory) {
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB over ${iterations} operations`);

      // Should not grow more than 50MB for 100 operations
      expect(memoryIncrease).toBeLessThan(50);
    }
  });
});
