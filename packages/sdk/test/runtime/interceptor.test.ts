/**
 * Tests for method interception and TraceEntry creation.
 *
 * T014: Test sync method calls intercepted and traced
 * T015: Test async method calls intercepted and traced
 * T016: Test TraceEntry captures method, args, result, timestamp, duration
 * T017: Test nested calls tracked with parentId
 * T018: Test errors captured with ErrorInfo
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TraceEntry, ErrorInfo } from "../../src/runtime/types.js";

// Mock interceptor for testing before actual implementation
interface MockInterceptorContext {
  traces: TraceEntry[];
  callStack: string[];
}

function createMockInterceptor() {
  const context: MockInterceptorContext = {
    traces: [],
    callStack: [],
  };

  const intercept = <T extends (...args: unknown[]) => unknown>(
    methodName: string,
    method: T,
    thisArg: unknown
  ): T => {
    return ((...args: unknown[]) => {
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const parentId = context.callStack[context.callStack.length - 1];
      const startTime = Date.now();

      context.callStack.push(traceId);

      try {
        const result = method.apply(thisArg, args);

        // Handle promises (async methods)
        if (result instanceof Promise) {
          return result
            .then((resolvedResult) => {
              const duration = Date.now() - startTime;
              context.traces.push({
                id: traceId,
                method: methodName,
                args: [...args],
                result: resolvedResult,
                timestamp: startTime,
                duration,
                parentId,
              });
              context.callStack.pop();
              return resolvedResult;
            })
            .catch((error) => {
              const duration = Date.now() - startTime;
              context.traces.push({
                id: traceId,
                method: methodName,
                args: [...args],
                error: {
                  name: error.name || "Error",
                  message: error.message || String(error),
                  stack: error.stack,
                },
                timestamp: startTime,
                duration,
                parentId,
              });
              context.callStack.pop();
              throw error;
            });
        }

        // Sync method
        const duration = Date.now() - startTime;
        context.traces.push({
          id: traceId,
          method: methodName,
          args: [...args],
          result,
          timestamp: startTime,
          duration,
          parentId,
        });
        context.callStack.pop();
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const err = error as Error;
        context.traces.push({
          id: traceId,
          method: methodName,
          args: [...args],
          error: {
            name: err.name || "Error",
            message: err.message || String(err),
            stack: err.stack,
          },
          timestamp: startTime,
          duration,
          parentId,
        });
        context.callStack.pop();
        throw error;
      }
    }) as T;
  };

  return { context, intercept };
}

describe("Interceptor - Sync method interception", () => {
  it("should intercept sync method calls", () => {
    const { context, intercept } = createMockInterceptor();

    const original = (x: number) => x * 2;
    const intercepted = intercept("multiply", original, null);

    const result = intercepted(5);

    expect(result).toBe(10);
    expect(context.traces).toHaveLength(1);
    expect(context.traces[0].method).toBe("multiply");
  });

  it("should capture arguments for sync methods", () => {
    const { context, intercept } = createMockInterceptor();

    const original = (a: string, b: number) => `${a}-${b}`;
    const intercepted = intercept("format", original, null);

    intercepted("test", 42);

    expect(context.traces[0].args).toEqual(["test", 42]);
  });

  it("should capture return value for sync methods", () => {
    const { context, intercept } = createMockInterceptor();

    const original = () => ({ status: "ok", count: 5 });
    const intercepted = intercept("getStatus", original, null);

    intercepted();

    expect(context.traces[0].result).toEqual({ status: "ok", count: 5 });
  });
});

describe("Interceptor - Async method interception", () => {
  it("should intercept async method calls", async () => {
    const { context, intercept } = createMockInterceptor();

    const original = async (x: number) => {
      await new Promise((r) => setTimeout(r, 10));
      return x * 2;
    };
    const intercepted = intercept("asyncMultiply", original, null);

    const result = await intercepted(5);

    expect(result).toBe(10);
    expect(context.traces).toHaveLength(1);
    expect(context.traces[0].method).toBe("asyncMultiply");
  });

  it("should capture arguments for async methods", async () => {
    const { context, intercept } = createMockInterceptor();

    const original = async (name: string, age: number) => ({ name, age });
    const intercepted = intercept("createUser", original, null);

    await intercepted("Alice", 30);

    expect(context.traces[0].args).toEqual(["Alice", 30]);
  });

  it("should capture resolved value for async methods", async () => {
    const { context, intercept } = createMockInterceptor();

    const original = async () => {
      await Promise.resolve();
      return { data: [1, 2, 3] };
    };
    const intercepted = intercept("fetchData", original, null);

    await intercepted();

    expect(context.traces[0].result).toEqual({ data: [1, 2, 3] });
  });
});

describe("Interceptor - TraceEntry fields", () => {
  it("should capture timestamp when call started", () => {
    const { context, intercept } = createMockInterceptor();
    const beforeCall = Date.now();

    const original = () => "result";
    const intercepted = intercept("test", original, null);
    intercepted();

    const afterCall = Date.now();

    expect(context.traces[0].timestamp).toBeGreaterThanOrEqual(beforeCall);
    expect(context.traces[0].timestamp).toBeLessThanOrEqual(afterCall);
  });

  it("should capture execution duration", async () => {
    const { context, intercept } = createMockInterceptor();

    const delay = 50;
    const original = async () => {
      await new Promise((r) => setTimeout(r, delay));
      return "done";
    };
    const intercepted = intercept("slowMethod", original, null);

    await intercepted();

    // Duration should be at least the delay time
    expect(context.traces[0].duration).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
  });

  it("should generate unique trace IDs", () => {
    const { context, intercept } = createMockInterceptor();

    const original = () => "result";
    const intercepted = intercept("test", original, null);

    intercepted();
    intercepted();
    intercepted();

    const ids = context.traces.map((t) => t.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });

  it("should capture method name correctly", () => {
    const { context, intercept } = createMockInterceptor();

    const method1 = intercept("processPayment", () => true, null);
    const method2 = intercept("validateInput", () => true, null);

    method1();
    method2();

    expect(context.traces[0].method).toBe("processPayment");
    expect(context.traces[1].method).toBe("validateInput");
  });
});

describe("Interceptor - Nested calls with parentId", () => {
  it("should track parent-child relationship for nested calls", () => {
    const { context, intercept } = createMockInterceptor();

    // Simulate nested call scenario
    const innerMethod = intercept("innerMethod", () => "inner result", null);
    const outerMethod = intercept(
      "outerMethod",
      () => {
        return innerMethod();
      },
      null
    );

    outerMethod();

    expect(context.traces).toHaveLength(2);

    // Find outer and inner traces
    const outerTrace = context.traces.find((t) => t.method === "outerMethod");
    const innerTrace = context.traces.find((t) => t.method === "innerMethod");

    expect(outerTrace).toBeDefined();
    expect(innerTrace).toBeDefined();

    // Inner should have outer as parent
    expect(innerTrace!.parentId).toBe(outerTrace!.id);

    // Outer should have no parent (root call)
    expect(outerTrace!.parentId).toBeUndefined();
  });

  it("should handle deeply nested calls", () => {
    const { context, intercept } = createMockInterceptor();

    const level3 = intercept("level3", () => "deep", null);
    const level2 = intercept("level2", () => level3(), null);
    const level1 = intercept("level1", () => level2(), null);

    level1();

    expect(context.traces).toHaveLength(3);

    const t1 = context.traces.find((t) => t.method === "level1")!;
    const t2 = context.traces.find((t) => t.method === "level2")!;
    const t3 = context.traces.find((t) => t.method === "level3")!;

    expect(t1.parentId).toBeUndefined();
    expect(t2.parentId).toBe(t1.id);
    expect(t3.parentId).toBe(t2.id);
  });

  it("should handle async nested calls", async () => {
    const { context, intercept } = createMockInterceptor();

    const asyncInner = intercept(
      "asyncInner",
      async () => {
        await Promise.resolve();
        return "async inner";
      },
      null
    );

    const asyncOuter = intercept(
      "asyncOuter",
      async () => {
        return await asyncInner();
      },
      null
    );

    await asyncOuter();

    expect(context.traces).toHaveLength(2);

    const outer = context.traces.find((t) => t.method === "asyncOuter")!;
    const inner = context.traces.find((t) => t.method === "asyncInner")!;

    expect(inner.parentId).toBe(outer.id);
  });
});

describe("Interceptor - Error handling", () => {
  it("should capture sync errors with ErrorInfo", () => {
    const { context, intercept } = createMockInterceptor();

    const failingMethod = intercept(
      "failingSync",
      () => {
        throw new Error("Sync error occurred");
      },
      null
    );

    expect(() => failingMethod()).toThrow("Sync error occurred");

    expect(context.traces).toHaveLength(1);
    expect(context.traces[0].error).toBeDefined();
    expect(context.traces[0].error!.name).toBe("Error");
    expect(context.traces[0].error!.message).toBe("Sync error occurred");
    expect(context.traces[0].result).toBeUndefined();
  });

  it("should capture async errors with ErrorInfo", async () => {
    const { context, intercept } = createMockInterceptor();

    const failingMethod = intercept(
      "failingAsync",
      async () => {
        await Promise.resolve();
        throw new Error("Async error occurred");
      },
      null
    );

    await expect(failingMethod()).rejects.toThrow("Async error occurred");

    expect(context.traces).toHaveLength(1);
    expect(context.traces[0].error).toBeDefined();
    expect(context.traces[0].error!.name).toBe("Error");
    expect(context.traces[0].error!.message).toBe("Async error occurred");
  });

  it("should capture custom error types", () => {
    const { context, intercept } = createMockInterceptor();

    class ValidationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "ValidationError";
      }
    }

    const failingMethod = intercept(
      "validate",
      () => {
        throw new ValidationError("Invalid input");
      },
      null
    );

    expect(() => failingMethod()).toThrow("Invalid input");

    expect(context.traces[0].error!.name).toBe("ValidationError");
    expect(context.traces[0].error!.message).toBe("Invalid input");
  });

  it("should include stack trace in ErrorInfo", () => {
    const { context, intercept } = createMockInterceptor();

    const failingMethod = intercept(
      "withStack",
      () => {
        throw new Error("With stack");
      },
      null
    );

    expect(() => failingMethod()).toThrow();

    expect(context.traces[0].error!.stack).toBeDefined();
    expect(context.traces[0].error!.stack).toContain("Error");
  });

  it("should still record duration for failed calls", async () => {
    const { context, intercept } = createMockInterceptor();

    const delay = 30;
    const failingMethod = intercept(
      "slowFail",
      async () => {
        await new Promise((r) => setTimeout(r, delay));
        throw new Error("Delayed failure");
      },
      null
    );

    await expect(failingMethod()).rejects.toThrow();

    expect(context.traces[0].duration).toBeGreaterThanOrEqual(delay - 10);
  });

  it("should propagate errors after capturing", () => {
    const { context, intercept } = createMockInterceptor();

    const error = new Error("Original error");
    const failingMethod = intercept(
      "propagate",
      () => {
        throw error;
      },
      null
    );

    try {
      failingMethod();
    } catch (e) {
      expect(e).toBe(error); // Same error instance
    }

    expect(context.traces).toHaveLength(1);
  });
});
