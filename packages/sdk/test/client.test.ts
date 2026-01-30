/**
 * SDK Client Tests
 *
 * Tests for AgentAnchorClient functionality using mocks
 */

import { describe, it, expect } from "vitest";
import {
  hashTrace,
  validateTrace,
  stringToBytes32,
  parseIpfsUri,
  formatIpfsUri,
  getGranularityLabel,
} from "../src/utils.js";
import type { AgentTrace, Granularity } from "../src/types.js";

// Test trace fixture
const createTestTrace = (overrides: Partial<AgentTrace> = {}): AgentTrace => ({
  version: "1.0.0",
  traceId: "test-trace-123",
  agentId: "test-agent-001",
  sessionId: "session-456",
  timestamp: new Date().toISOString(),
  granularity: 0 as Granularity,
  content: {
    steps: [
      { action: "read", target: "file.txt" },
      { action: "write", target: "output.txt" },
    ],
  },
  metadata: {
    environment: "test",
  },
  ...overrides,
});

describe("Utils", () => {
  describe("hashTrace", () => {
    it("should produce consistent hash for same trace", () => {
      const trace = createTestTrace();
      const hash1 = hashTrace(trace);
      const hash2 = hashTrace(trace);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different traces", () => {
      const trace1 = createTestTrace({ traceId: "trace-1" });
      const trace2 = createTestTrace({ traceId: "trace-2" });

      const hash1 = hashTrace(trace1);
      const hash2 = hashTrace(trace2);

      expect(hash1).not.toBe(hash2);
    });

    it("should return a 66-character hex string (0x + 64 hex chars)", () => {
      const trace = createTestTrace();
      const hash = hashTrace(trace);

      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should be deterministic regardless of property order", () => {
      const trace1: AgentTrace = {
        version: "1.0.0",
        traceId: "test",
        agentId: "agent",
        timestamp: "2024-01-01",
        granularity: 0,
        content: {},
      };

      // Same properties, potentially different order in memory
      const trace2: AgentTrace = {
        granularity: 0,
        content: {},
        timestamp: "2024-01-01",
        agentId: "agent",
        traceId: "test",
        version: "1.0.0",
      };

      expect(hashTrace(trace1)).toBe(hashTrace(trace2));
    });
  });

  describe("validateTrace", () => {
    it("should validate a correct trace", () => {
      const trace = createTestTrace();
      const result = validateTrace(trace);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject non-object input", () => {
      expect(validateTrace(null).valid).toBe(false);
      expect(validateTrace(undefined).valid).toBe(false);
      expect(validateTrace("string").valid).toBe(false);
      expect(validateTrace(123).valid).toBe(false);
    });

    it("should reject missing version", () => {
      const trace = createTestTrace();
      delete (trace as Record<string, unknown>).version;

      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("version");
    });

    it("should reject missing traceId", () => {
      const trace = createTestTrace();
      delete (trace as Record<string, unknown>).traceId;

      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("traceId");
    });

    it("should reject missing agentId", () => {
      const trace = createTestTrace();
      delete (trace as Record<string, unknown>).agentId;

      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("agentId");
    });

    it("should reject missing timestamp", () => {
      const trace = createTestTrace();
      delete (trace as Record<string, unknown>).timestamp;

      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp");
    });

    it("should reject invalid granularity", () => {
      const trace = createTestTrace({ granularity: 5 as Granularity });

      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("granularity");
    });

    it("should reject missing content", () => {
      const trace = createTestTrace();
      delete (trace as Record<string, unknown>).content;

      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("content");
    });
  });

  describe("stringToBytes32", () => {
    it("should convert short strings to bytes32", () => {
      const result = stringToBytes32("test");

      expect(result).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should hash strings longer than 32 bytes", () => {
      const longString = "a".repeat(100);
      const result = stringToBytes32(longString);

      expect(result).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should produce different results for different strings", () => {
      const result1 = stringToBytes32("agent-1");
      const result2 = stringToBytes32("agent-2");

      expect(result1).not.toBe(result2);
    });

    it("should be consistent for same input", () => {
      const result1 = stringToBytes32("my-agent");
      const result2 = stringToBytes32("my-agent");

      expect(result1).toBe(result2);
    });
  });
});

describe("Trace Verification Logic", () => {
  it("should verify hash matches when trace is unchanged", () => {
    const trace = createTestTrace();
    const originalHash = hashTrace(trace);

    // Simulate fetching from IPFS (same trace - deep copy)
    const fetchedTrace = JSON.parse(JSON.stringify(trace)) as AgentTrace;
    const recomputedHash = hashTrace(fetchedTrace);

    expect(recomputedHash).toBe(originalHash);
  });

  it("should detect tampering when trace is modified", () => {
    const trace = createTestTrace();
    const originalHash = hashTrace(trace);

    // Simulate tampered trace - modify content
    const tamperedTrace: AgentTrace = {
      version: trace.version,
      traceId: trace.traceId,
      agentId: trace.agentId,
      timestamp: trace.timestamp,
      granularity: trace.granularity,
      content: { steps: [{ action: "malicious", target: "system" }] },
    };
    const recomputedHash = hashTrace(tamperedTrace);

    expect(recomputedHash).not.toBe(originalHash);
  });

  it("should detect metadata changes", () => {
    const trace = createTestTrace();
    const originalHash = hashTrace(trace);

    // Create new trace with different metadata
    const modifiedTrace: AgentTrace = {
      version: trace.version,
      traceId: trace.traceId,
      agentId: trace.agentId,
      timestamp: trace.timestamp,
      granularity: trace.granularity,
      content: trace.content,
      metadata: { environment: "test", modified: true },
    };
    const recomputedHash = hashTrace(modifiedTrace);

    expect(recomputedHash).not.toBe(originalHash);
  });
});

describe("IPFS URI Handling", () => {
  describe("parseIpfsUri", () => {
    it("should parse ipfs:// URI", () => {
      const cid = parseIpfsUri("ipfs://QmTest123");
      expect(cid).toBe("QmTest123");
    });

    it("should parse gateway URL", () => {
      const cid = parseIpfsUri("https://w3s.link/ipfs/QmTest456");
      expect(cid).toBe("QmTest456");
    });

    it("should throw for invalid URI", () => {
      expect(() => parseIpfsUri("http://example.com")).toThrow("Invalid IPFS URI");
    });
  });

  describe("formatIpfsUri", () => {
    it("should format CID to URI", () => {
      const uri = formatIpfsUri("QmTest789");
      expect(uri).toBe("ipfs://QmTest789");
    });
  });
});

describe("Granularity Labels", () => {
  it("should return Session for 0", () => {
    expect(getGranularityLabel(0)).toBe("Session");
  });

  it("should return Task for 1", () => {
    expect(getGranularityLabel(1)).toBe("Task");
  });

  it("should return Step for 2", () => {
    expect(getGranularityLabel(2)).toBe("Step");
  });

  it("should return Unknown for invalid values", () => {
    expect(getGranularityLabel(99 as Granularity)).toBe("Unknown");
  });
});
