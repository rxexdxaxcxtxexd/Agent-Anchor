/**
 * Core Proxy-based wrapper for agent objects.
 *
 * Wraps any JavaScript/TypeScript object with an ES6 Proxy that intercepts
 * method calls and creates TraceEntry records for each invocation.
 */

import type {
  RuntimeConfig,
  WrappedAgent,
  SignedRecord,
  AnchorStatus,
  StorageStats,
  TraceEntry,
  ChainId,
} from "./types.js";
import {
  InterceptorState,
  createSyncInterceptedMethod,
  isFunction,
  shouldIntercept,
} from "./interceptor.js";
import { validateConfig, applyDefaults, getPrivateKey } from "./config.js";
import type { CacheStorage } from "./storage/index.js";
import {
  createAndInitializeStorage,
  getDefaultStorageConfig,
} from "./storage/index.js";
import { getTransactionExplorerUrl } from "./chains.js";
import { createRedactionContext } from "./redaction.js";

/**
 * Internal wrapper state.
 */
interface WrapperState {
  /** Interceptor state for tracking calls */
  interceptorState: InterceptorState;
  /** Local cache storage */
  storage: CacheStorage;
  /** Runtime configuration with defaults applied */
  config: Required<RuntimeConfig>;
  /** Chain ID for explorer URLs */
  chainId: ChainId;
}

/**
 * Create a Proxy handler for intercepting method calls.
 *
 * @param target - The original object being wrapped
 * @param state - Wrapper state
 * @param onTrace - Callback when a trace is captured
 * @returns ProxyHandler for the target
 */
function createProxyHandler<T extends object>(
  target: T,
  state: WrapperState,
  onTrace?: (entry: TraceEntry) => void
): ProxyHandler<T> {
  // Cache of already-wrapped methods to avoid re-wrapping
  const methodCache = new Map<string | symbol, unknown>();

  return {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);

      // Return cached wrapped method if available
      if (methodCache.has(prop)) {
        return methodCache.get(prop);
      }

      // Only intercept functions that should be intercepted
      if (isFunction(value) && shouldIntercept(prop)) {
        const wrapped = createSyncInterceptedMethod(
          String(prop),
          value as (...args: unknown[]) => unknown,
          obj,
          state.interceptorState,
          onTrace
        );

        methodCache.set(prop, wrapped);
        return wrapped;
      }

      return value;
    },

    // Pass through other operations
    set(obj, prop, value, receiver) {
      return Reflect.set(obj, prop, value, receiver);
    },

    has(obj, prop) {
      return Reflect.has(obj, prop);
    },

    deleteProperty(obj, prop) {
      return Reflect.deleteProperty(obj, prop);
    },

    ownKeys(obj) {
      return Reflect.ownKeys(obj);
    },

    getOwnPropertyDescriptor(obj, prop) {
      return Reflect.getOwnPropertyDescriptor(obj, prop);
    },

    defineProperty(obj, prop, descriptor) {
      return Reflect.defineProperty(obj, prop, descriptor);
    },

    getPrototypeOf(obj) {
      return Reflect.getPrototypeOf(obj);
    },

    setPrototypeOf(obj, proto) {
      return Reflect.setPrototypeOf(obj, proto);
    },

    isExtensible(obj) {
      return Reflect.isExtensible(obj);
    },

    preventExtensions(obj) {
      return Reflect.preventExtensions(obj);
    },
  };
}

/**
 * Create a wrapped agent with all WrappedAgent interface methods.
 *
 * @param target - The original agent object
 * @param proxy - The proxied agent
 * @param state - Wrapper state
 * @returns WrappedAgent instance
 */
function createWrappedAgent<T extends object>(
  target: T,
  proxy: T,
  state: WrapperState
): WrappedAgent<T> {
  return {
    agent: proxy,

    async getPendingRecords(): Promise<SignedRecord[]> {
      const pending = await state.storage.getByStatus("pending");
      const submitted = await state.storage.getByStatus("submitted");
      const failed = await state.storage.getByStatus("failed");
      return [...pending, ...submitted, ...failed];
    },

    async retryAnchor(recordHash: string): Promise<AnchorStatus> {
      const record = await state.storage.get(recordHash);
      if (!record) {
        throw new Error(`Record not found: ${recordHash}`);
      }

      // In a full implementation, this would trigger the anchor service
      // For now, return the current status
      return (
        record.anchorStatus ?? {
          status: "pending",
          retryCount: 0,
        }
      );
    },

    async markLocallyVerified(recordHash: string): Promise<void> {
      const record = await state.storage.get(recordHash);
      if (!record) {
        throw new Error(`Record not found: ${recordHash}`);
      }

      await state.storage.updateStatus(recordHash, {
        status: "local-only",
        retryCount: record.anchorStatus?.retryCount ?? 0,
      });
    },

    async getStorageStats(): Promise<StorageStats> {
      return state.storage.getStats();
    },

    async flushCache(): Promise<void> {
      // In cache mode, this would trigger immediate flush
      // For now, this is a no-op placeholder
    },

    async getAnchorStatus(recordHash: string): Promise<AnchorStatus | null> {
      const record = await state.storage.get(recordHash);
      return record?.anchorStatus ?? null;
    },

    async getExplorerUrl(recordHash: string): Promise<string | null> {
      const record = await state.storage.get(recordHash);
      if (!record?.anchorStatus?.transactionHash) {
        return null;
      }

      return getTransactionExplorerUrl(
        state.chainId,
        record.anchorStatus.transactionHash
      );
    },
  };
}

/**
 * Wrap an agent object for automatic trace capturing.
 *
 * This is the internal implementation. The public API is exposed
 * through AgentAnchorRuntime.wrap() in index.ts.
 *
 * @param target - The agent object to wrap
 * @param config - Runtime configuration
 * @returns WrappedAgent instance
 */
export async function wrapAgent<T extends object>(
  target: T,
  config: RuntimeConfig
): Promise<WrappedAgent<T>> {
  // Validate configuration
  validateConfig(config);

  // Apply defaults
  const fullConfig = applyDefaults(config);

  // Initialize storage
  const storageConfig = getDefaultStorageConfig(
    "agent-anchor-traces",
    fullConfig.localCacheLimit
  );
  const storage = await createAndInitializeStorage("auto", storageConfig);

  // Create interceptor state
  const interceptorState = new InterceptorState(fullConfig.callbacks);

  // Create redaction context
  const redactionContext = createRedactionContext(fullConfig.redaction);

  // Create wrapper state
  const state: WrapperState = {
    interceptorState,
    storage,
    config: fullConfig,
    chainId: fullConfig.chain,
  };

  // Callback for when traces are captured
  const onTrace = async (entry: TraceEntry): Promise<void> => {
    // Apply redaction to sensitive data before signing/anchoring
    // This ensures PII/credentials never persist in raw form
    if (redactionContext.isEnabled()) {
      entry.args = redactionContext.redactArgs(entry.args);
      if (entry.result !== undefined) {
        entry.result = redactionContext.redactResult(entry.result);
      }
      if (entry.error?.message) {
        entry.error.message = redactionContext.redactError(entry.error.message);
      }
      if (entry.error?.stack) {
        entry.error.stack = redactionContext.redactError(entry.error.stack);
      }
    }

    // In the full implementation, this is where signing and anchoring happens
    // For US1, we just capture the trace
    // Signing will be added in US3, anchoring in US2
  };

  // Create the proxy
  const handler = createProxyHandler(target, state, onTrace);
  const proxy = new Proxy(target, handler);

  // Create and return the wrapped agent
  return createWrappedAgent(target, proxy, state);
}

/**
 * Synchronous wrapper creation (for contexts where async is not possible).
 *
 * Note: This version uses memory storage and may not persist data.
 * For production use, prefer the async wrapAgent() function.
 */
export function wrapAgentSync<T extends object>(
  target: T,
  config: RuntimeConfig,
  storage?: CacheStorage
): WrappedAgent<T> {
  // Validate configuration
  validateConfig(config);

  // Apply defaults
  const fullConfig = applyDefaults(config);

  // Use provided storage or create a memory-only storage
  // Note: If storage not provided, this will throw in some operations
  const effectiveStorage = storage as CacheStorage;

  // Create interceptor state
  const interceptorState = new InterceptorState(fullConfig.callbacks);

  // Create redaction context
  const redactionContext = createRedactionContext(fullConfig.redaction);

  // Create wrapper state
  const state: WrapperState = {
    interceptorState,
    storage: effectiveStorage,
    config: fullConfig,
    chainId: fullConfig.chain,
  };

  // Callback for when traces are captured (sync version)
  const onTrace = (entry: TraceEntry): void => {
    // Apply redaction to sensitive data before signing/anchoring
    if (redactionContext.isEnabled()) {
      entry.args = redactionContext.redactArgs(entry.args);
      if (entry.result !== undefined) {
        entry.result = redactionContext.redactResult(entry.result);
      }
      if (entry.error?.message) {
        entry.error.message = redactionContext.redactError(entry.error.message);
      }
      if (entry.error?.stack) {
        entry.error.stack = redactionContext.redactError(entry.error.stack);
      }
    }
  };

  // Create the proxy
  const handler = createProxyHandler(target, state, onTrace);
  const proxy = new Proxy(target, handler);

  // Create and return the wrapped agent
  return createWrappedAgent(target, proxy, state);
}
