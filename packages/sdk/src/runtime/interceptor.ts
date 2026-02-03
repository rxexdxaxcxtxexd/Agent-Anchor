/**
 * Method interception and TraceEntry creation.
 *
 * Implements the core logic for intercepting method calls on wrapped agents,
 * creating TraceEntry records, and tracking nested call relationships.
 */

import type {
  TraceEntry,
  ErrorInfo,
  InterceptionContext,
  CallbackConfig,
  RedactionConfig,
} from "./types.js";

/**
 * Generate a unique trace ID.
 */
function generateTraceId(): string {
  // UUID v4 format
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant bits
  // Non-null assertions are safe here since we just created a 16-byte array
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Create ErrorInfo from an error object.
 */
function createErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}

/**
 * Interceptor configuration.
 */
export interface InterceptorConfig {
  /** Redaction configuration */
  redaction?: RedactionConfig;
  /** Callback configuration */
  callbacks?: CallbackConfig;
}

/**
 * Interceptor state for tracking call context.
 */
export class InterceptorState {
  /** Current call stack for nested call tracking */
  private callStack: string[] = [];

  /** All captured traces */
  private traces: TraceEntry[] = [];

  /** Callbacks for lifecycle events */
  private callbacks?: CallbackConfig;

  constructor(callbacks?: CallbackConfig) {
    this.callbacks = callbacks;
  }

  /**
   * Get the current parent trace ID (top of call stack).
   */
  getCurrentParentId(): string | undefined {
    return this.callStack[this.callStack.length - 1];
  }

  /**
   * Push a trace ID onto the call stack.
   */
  pushCall(traceId: string): void {
    this.callStack.push(traceId);
  }

  /**
   * Pop a trace ID from the call stack.
   */
  popCall(): void {
    this.callStack.pop();
  }

  /**
   * Add a completed trace entry.
   */
  addTrace(entry: TraceEntry): void {
    this.traces.push(entry);

    // Fire callback if configured
    if (this.callbacks?.onActionCaptured) {
      try {
        this.callbacks.onActionCaptured(entry);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Get all captured traces.
   */
  getTraces(): TraceEntry[] {
    return [...this.traces];
  }

  /**
   * Clear all traces.
   */
  clearTraces(): void {
    this.traces = [];
  }

  /**
   * Get the most recent trace.
   */
  getLastTrace(): TraceEntry | undefined {
    return this.traces[this.traces.length - 1];
  }
}

/**
 * Create an intercepted method that captures trace entries.
 *
 * @param methodName - Name of the method being intercepted
 * @param method - The original method function
 * @param thisArg - The 'this' context for the method
 * @param state - Interceptor state for tracking calls
 * @param onTrace - Callback when a trace is captured
 * @returns Wrapped method that captures traces
 */
export function createInterceptedMethod<T extends (...args: unknown[]) => unknown>(
  methodName: string,
  method: T,
  thisArg: unknown,
  state: InterceptorState,
  onTrace?: (entry: TraceEntry) => void | Promise<void>
): T {
  return (async function (...args: unknown[]): Promise<unknown> {
    const traceId = generateTraceId();
    const parentId = state.getCurrentParentId();
    const startTime = Date.now();

    // Push onto call stack for nested call tracking
    state.pushCall(traceId);

    let result: unknown;
    let error: ErrorInfo | undefined;

    try {
      // Call the original method
      result = method.apply(thisArg, args);

      // Handle promises (async methods)
      if (result instanceof Promise) {
        result = await result;
      }
    } catch (e) {
      error = createErrorInfo(e);
      // Re-throw after capturing
      const duration = Date.now() - startTime;
      state.popCall();

      const entry: TraceEntry = {
        id: traceId,
        method: methodName,
        args: [...args],
        error,
        timestamp: startTime,
        duration,
        parentId,
      };

      state.addTrace(entry);

      if (onTrace) {
        try {
          await onTrace(entry);
        } catch {
          // Ignore onTrace errors
        }
      }

      throw e;
    }

    const duration = Date.now() - startTime;
    state.popCall();

    const entry: TraceEntry = {
      id: traceId,
      method: methodName,
      args: [...args],
      result,
      timestamp: startTime,
      duration,
      parentId,
    };

    state.addTrace(entry);

    if (onTrace) {
      try {
        await onTrace(entry);
      } catch {
        // Ignore onTrace errors
      }
    }

    return result;
  }) as unknown as T;
}

/**
 * Create a synchronous intercepted method (for sync-only use cases).
 *
 * This version does not convert the method to async, preserving
 * synchronous behavior for methods that must remain sync.
 */
export function createSyncInterceptedMethod<T extends (...args: unknown[]) => unknown>(
  methodName: string,
  method: T,
  thisArg: unknown,
  state: InterceptorState,
  onTrace?: (entry: TraceEntry) => void
): T {
  return (function (...args: unknown[]): unknown {
    const traceId = generateTraceId();
    const parentId = state.getCurrentParentId();
    const startTime = Date.now();

    state.pushCall(traceId);

    let result: unknown;
    let error: ErrorInfo | undefined;

    try {
      result = method.apply(thisArg, args);

      // If result is a promise, wrap it to capture async completion
      if (result instanceof Promise) {
        return result
          .then((resolvedResult) => {
            const duration = Date.now() - startTime;
            state.popCall();

            const entry: TraceEntry = {
              id: traceId,
              method: methodName,
              args: [...args],
              result: resolvedResult,
              timestamp: startTime,
              duration,
              parentId,
            };

            state.addTrace(entry);
            onTrace?.(entry);

            return resolvedResult;
          })
          .catch((e) => {
            const duration = Date.now() - startTime;
            state.popCall();

            const entry: TraceEntry = {
              id: traceId,
              method: methodName,
              args: [...args],
              error: createErrorInfo(e),
              timestamp: startTime,
              duration,
              parentId,
            };

            state.addTrace(entry);
            onTrace?.(entry);

            throw e;
          });
      }

      // Sync completion
      const duration = Date.now() - startTime;
      state.popCall();

      const entry: TraceEntry = {
        id: traceId,
        method: methodName,
        args: [...args],
        result,
        timestamp: startTime,
        duration,
        parentId,
      };

      state.addTrace(entry);
      onTrace?.(entry);

      return result;
    } catch (e) {
      const duration = Date.now() - startTime;
      state.popCall();

      const entry: TraceEntry = {
        id: traceId,
        method: methodName,
        args: [...args],
        error: createErrorInfo(e),
        timestamp: startTime,
        duration,
        parentId,
      };

      state.addTrace(entry);
      onTrace?.(entry);

      throw e;
    }
  }) as T;
}

/**
 * Check if a value is a function.
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

/**
 * Check if a property should be intercepted.
 *
 * Some properties should not be intercepted (constructors, symbols, etc.)
 */
export function shouldIntercept(prop: string | symbol): boolean {
  // Don't intercept symbols
  if (typeof prop === "symbol") {
    return false;
  }

  // Don't intercept constructor
  if (prop === "constructor") {
    return false;
  }

  // Don't intercept private properties (convention: starts with _)
  if (prop.startsWith("_")) {
    return false;
  }

  // Don't intercept common non-method properties
  const skipProps = ["prototype", "length", "name", "caller", "arguments"];
  if (skipProps.includes(prop)) {
    return false;
  }

  return true;
}
