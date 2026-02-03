/**
 * Tests for the core Proxy-based wrapper functionality.
 *
 * T013: Test that Proxy wraps object without modifying original
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// These will be implemented - importing types for now
import type { RuntimeConfig, WrappedAgent } from "../../src/runtime/types.js";

// Mock implementation for testing before actual implementation exists
const createMockWrapper = <T extends object>(
  target: T,
  _config: RuntimeConfig
): WrappedAgent<T> => {
  const traces: unknown[] = [];

  const handler: ProxyHandler<T> = {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value === "function") {
        return function (this: unknown, ...args: unknown[]) {
          traces.push({ method: String(prop), args });
          return value.apply(this === receiver ? obj : this, args);
        };
      }
      return value;
    },
  };

  const proxy = new Proxy(target, handler);

  return {
    agent: proxy,
    getPendingRecords: async () => [],
    retryAnchor: async () => ({ status: "pending", retryCount: 0 }),
    markLocallyVerified: async () => {},
    getStorageStats: async () => ({
      totalRecords: 0,
      pendingRecords: 0,
      confirmedRecords: 0,
      storageBytes: 0,
      capacityPercent: 0,
    }),
    flushCache: async () => {},
    getAnchorStatus: async () => null,
    getExplorerUrl: async () => null,
  };
};

describe("Wrapper - Proxy wrapping", () => {
  // Test agent class
  class TestAgent {
    public callCount = 0;
    private internalState = "initial";

    syncMethod(value: string): string {
      this.callCount++;
      this.internalState = value;
      return `processed: ${value}`;
    }

    async asyncMethod(value: number): Promise<number> {
      this.callCount++;
      return value * 2;
    }

    getState(): string {
      return this.internalState;
    }
  }

  let originalAgent: TestAgent;
  let config: RuntimeConfig;

  beforeEach(() => {
    originalAgent = new TestAgent();
    config = {
      privateKey: "0x" + "a".repeat(64),
      consistencyMode: "async", // Use async to avoid blocking
    };
  });

  it("should wrap object without modifying the original", () => {
    const wrapped = createMockWrapper(originalAgent, config);

    // Original should still work
    expect(originalAgent.syncMethod("test")).toBe("processed: test");

    // Wrapped agent should be different object
    expect(wrapped.agent).not.toBe(originalAgent);

    // Original's prototype chain should be intact
    expect(originalAgent instanceof TestAgent).toBe(true);
  });

  it("should preserve original object's methods", () => {
    const wrapped = createMockWrapper(originalAgent, config);

    // All methods should be accessible
    expect(typeof wrapped.agent.syncMethod).toBe("function");
    expect(typeof wrapped.agent.asyncMethod).toBe("function");
    expect(typeof wrapped.agent.getState).toBe("function");
  });

  it("should preserve original object's properties", () => {
    const wrapped = createMockWrapper(originalAgent, config);

    // Properties should be accessible
    expect(wrapped.agent.callCount).toBe(0);
  });

  it("should call through to original methods", () => {
    const wrapped = createMockWrapper(originalAgent, config);

    const result = wrapped.agent.syncMethod("hello");

    expect(result).toBe("processed: hello");
    // The wrapped call should have updated the original's state
    expect(originalAgent.callCount).toBe(1);
  });

  it("should maintain this binding correctly", () => {
    const wrapped = createMockWrapper(originalAgent, config);

    wrapped.agent.syncMethod("updated");

    // Internal state should be updated via proper this binding
    expect(wrapped.agent.getState()).toBe("updated");
  });

  it("should work with plain objects (not just classes)", () => {
    const plainObj = {
      name: "test",
      getValue: () => 42,
      process: (x: number) => x * 2,
    };

    const wrapped = createMockWrapper(plainObj, config);

    expect(wrapped.agent.name).toBe("test");
    expect(wrapped.agent.getValue()).toBe(42);
    expect(wrapped.agent.process(5)).toBe(10);
  });

  it("should provide WrappedAgent interface methods", () => {
    const wrapped = createMockWrapper(originalAgent, config);

    // WrappedAgent interface methods should exist
    expect(typeof wrapped.getPendingRecords).toBe("function");
    expect(typeof wrapped.retryAnchor).toBe("function");
    expect(typeof wrapped.markLocallyVerified).toBe("function");
    expect(typeof wrapped.getStorageStats).toBe("function");
    expect(typeof wrapped.flushCache).toBe("function");
    expect(typeof wrapped.getAnchorStatus).toBe("function");
    expect(typeof wrapped.getExplorerUrl).toBe("function");
  });
});
