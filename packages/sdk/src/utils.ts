/**
 * Utility functions for Agent Anchor SDK
 */

import { keccak256, toUtf8Bytes, hexlify, zeroPadValue } from "ethers";
import type { AgentTrace, Granularity } from "./types.js";

/**
 * Compute keccak256 hash of trace content
 * @param trace - The trace data to hash
 * @returns bytes32 hash string
 */
export function hashTrace(trace: AgentTrace): string {
  const canonical = JSON.stringify(trace, Object.keys(trace).sort());
  return keccak256(toUtf8Bytes(canonical));
}

/**
 * Validate trace data structure
 * @param trace - The trace to validate
 * @returns validation result with optional error message
 */
export function validateTrace(trace: unknown): { valid: boolean; error?: string } {
  if (!trace || typeof trace !== "object") {
    return { valid: false, error: "Trace must be an object" };
  }

  const t = trace as Record<string, unknown>;

  if (typeof t.version !== "string") {
    return { valid: false, error: "Missing or invalid version field" };
  }

  if (typeof t.traceId !== "string") {
    return { valid: false, error: "Missing or invalid traceId field" };
  }

  if (typeof t.agentId !== "string") {
    return { valid: false, error: "Missing or invalid agentId field" };
  }

  if (typeof t.timestamp !== "string") {
    return { valid: false, error: "Missing or invalid timestamp field" };
  }

  if (typeof t.granularity !== "number" || t.granularity < 0 || t.granularity > 2) {
    return { valid: false, error: "Missing or invalid granularity field (must be 0, 1, or 2)" };
  }

  if (t.content === undefined) {
    return { valid: false, error: "Missing content field" };
  }

  return { valid: true };
}

/**
 * Convert string to bytes32
 * @param str - String to convert
 * @returns bytes32 hex string
 */
export function stringToBytes32(str: string): string {
  const bytes = toUtf8Bytes(str);
  if (bytes.length > 32) {
    // Hash if too long
    return keccak256(bytes);
  }
  return zeroPadValue(hexlify(bytes), 32);
}

/**
 * Parse IPFS URI to CID
 * @param uri - IPFS URI (ipfs://... or gateway URL)
 * @returns IPFS CID
 */
export function parseIpfsUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.slice(7);
  }
  // Handle gateway URLs
  const match = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error(`Invalid IPFS URI: ${uri}`);
}

/**
 * Format IPFS CID to URI
 * @param cid - IPFS CID
 * @returns IPFS URI
 */
export function formatIpfsUri(cid: string): string {
  return `ipfs://${cid}`;
}

/**
 * Get granularity label
 * @param granularity - Granularity enum value
 * @returns Human-readable label
 */
export function getGranularityLabel(granularity: Granularity): string {
  switch (granularity) {
    case 0:
      return "Session";
    case 1:
      return "Task";
    case 2:
      return "Step";
    default:
      return "Unknown";
  }
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in ms
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
