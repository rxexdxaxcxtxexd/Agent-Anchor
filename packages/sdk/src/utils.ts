/**
 * Utility functions for Agent Anchor SDK
 */

import { keccak256, toUtf8Bytes, hexlify, zeroPadValue } from "ethers";
import type { AgentTrace, Granularity } from "./types.js";

/**
 * Recursively sort object keys for canonical JSON representation
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute keccak256 hash of trace content
 * @param trace - The trace data to hash
 * @returns bytes32 hash string
 */
export function hashTrace(trace: AgentTrace): string {
  // Deep sort all keys for canonical representation
  const canonical = JSON.stringify(sortObjectKeys(trace));
  return keccak256(toUtf8Bytes(canonical));
}

/**
 * Maximum content size for validation (10MB)
 */
export const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

/**
 * ISO 8601 timestamp regex pattern
 */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

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

  // QA-004: Validate timestamp format (ISO 8601)
  if (!ISO_8601_REGEX.test(t.timestamp as string)) {
    return { valid: false, error: "Invalid timestamp format (expected ISO 8601)" };
  }

  if (typeof t.granularity !== "number" || t.granularity < 0 || t.granularity > 2) {
    return { valid: false, error: "Missing or invalid granularity field (must be 0, 1, or 2)" };
  }

  if (t.content === undefined) {
    return { valid: false, error: "Missing content field" };
  }

  // QA-004: Validate content size
  const contentStr = JSON.stringify(t.content);
  if (contentStr.length > MAX_CONTENT_SIZE) {
    return {
      valid: false,
      error: `Content too large: ${contentStr.length} bytes (max: ${MAX_CONTENT_SIZE})`,
    };
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
 * CID format validation patterns
 * CIDv0: Starts with "Qm" followed by 44 base58 characters
 * CIDv1: Starts with "b" followed by base32 characters (typically 58+ chars)
 */
const CID_V0_REGEX = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1_REGEX = /^b[a-z2-7]{58,}$/;

/**
 * Validate IPFS CID format
 * @param cid - IPFS CID to validate
 * @returns True if CID format is valid (CIDv0 or CIDv1)
 */
export function isValidCid(cid: string): boolean {
  return CID_V0_REGEX.test(cid) || CID_V1_REGEX.test(cid);
}

/**
 * Parse IPFS URI to CID
 * @param uri - IPFS URI (ipfs://... or gateway URL)
 * @returns IPFS CID
 * @throws Error if URI format or CID format is invalid
 */
export function parseIpfsUri(uri: string): string {
  let cid: string;

  if (uri.startsWith("ipfs://")) {
    cid = uri.slice(7);
  } else {
    // Handle gateway URLs
    const match = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (!match?.[1]) {
      throw new Error(`Invalid IPFS URI: ${uri}`);
    }
    cid = match[1];
  }

  if (!isValidCid(cid)) {
    throw new Error(`Invalid CID format: ${cid}`);
  }

  return cid;
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
