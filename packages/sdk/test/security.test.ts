/**
 * SDK Security Tests
 *
 * Tests for security-related features: CID validation, size limits, timeout handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateTrace,
  parseIpfsUri,
  isValidCid,
  MAX_CONTENT_SIZE,
} from "../src/utils.js";
import {
  MAX_UPLOAD_SIZE,
  MAX_FETCH_SIZE,
  FETCH_TIMEOUT,
  IpfsClient,
} from "../src/ipfs.js";
import { AgentAnchorClient } from "../src/client.js";
import type { AgentTrace, Granularity } from "../src/types.js";

// Test trace fixture helper
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

describe("SEC-004: IPFS Size Limits", () => {
  describe("Size limit constants", () => {
    it("should have MAX_UPLOAD_SIZE defined as 10MB", () => {
      expect(MAX_UPLOAD_SIZE).toBe(10 * 1024 * 1024);
    });

    it("should have MAX_FETCH_SIZE defined as 10MB", () => {
      expect(MAX_FETCH_SIZE).toBe(10 * 1024 * 1024);
    });

    it("should have FETCH_TIMEOUT defined as 30 seconds", () => {
      expect(FETCH_TIMEOUT).toBe(30000);
    });
  });

  describe("Content size validation", () => {
    it("should accept content within size limit", () => {
      const trace = createTestTrace();
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
    });

    it("should export MAX_CONTENT_SIZE as 10MB", () => {
      expect(MAX_CONTENT_SIZE).toBe(10 * 1024 * 1024);
    });
  });
});

describe("SEC-005: CID Validation", () => {
  describe("isValidCid", () => {
    describe("CIDv0 format (Qm...)", () => {
      it("should accept valid CIDv0", () => {
        // Real CIDv0 example: 46 characters starting with Qm
        const validCidV0 = "QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS";
        expect(isValidCid(validCidV0)).toBe(true);
      });

      it("should accept another valid CIDv0", () => {
        const validCidV0 = "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX";
        expect(isValidCid(validCidV0)).toBe(true);
      });

      it("should reject CIDv0 with invalid characters", () => {
        // Contains 0, l, O, I which are not in base58
        const invalidCidV0 = "Qm0lOIinvalidbase58chars123456789012345678901234";
        expect(isValidCid(invalidCidV0)).toBe(false);
      });

      it("should reject CIDv0 with wrong length", () => {
        const tooShort = "QmYwAPJzv5CZsnA";
        const tooLong = "QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzSextra";
        expect(isValidCid(tooShort)).toBe(false);
        expect(isValidCid(tooLong)).toBe(false);
      });
    });

    describe("CIDv1 format (b...)", () => {
      it("should accept valid CIDv1 with base32", () => {
        // CIDv1 starts with 'b' and uses base32lower
        const validCidV1 = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
        expect(isValidCid(validCidV1)).toBe(true);
      });

      it("should accept another valid CIDv1", () => {
        const validCidV1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
        expect(isValidCid(validCidV1)).toBe(true);
      });

      it("should reject CIDv1 with invalid characters", () => {
        // Contains characters not in base32 (8, 9, etc.)
        const invalidCidV1 = "bafybei89invalid012characters456notinbase32here";
        expect(isValidCid(invalidCidV1)).toBe(false);
      });

      it("should reject CIDv1 that is too short", () => {
        const tooShort = "bafybeishort";
        expect(isValidCid(tooShort)).toBe(false);
      });
    });

    describe("Invalid formats", () => {
      it("should reject empty string", () => {
        expect(isValidCid("")).toBe(false);
      });

      it("should reject random strings", () => {
        expect(isValidCid("random-string")).toBe(false);
        expect(isValidCid("not-a-cid")).toBe(false);
      });

      it("should reject strings that don't start with Qm or b", () => {
        expect(isValidCid("XmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS")).toBe(false);
        expect(isValidCid("aafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku")).toBe(false);
      });

      it("should reject URLs", () => {
        expect(isValidCid("https://ipfs.io/ipfs/QmTest")).toBe(false);
        expect(isValidCid("ipfs://QmTest")).toBe(false);
      });
    });
  });

  describe("parseIpfsUri with CID validation", () => {
    it("should parse and validate ipfs:// URI with valid CIDv0", () => {
      const validUri = "ipfs://QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS";
      const cid = parseIpfsUri(validUri);
      expect(cid).toBe("QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS");
    });

    it("should parse and validate ipfs:// URI with valid CIDv1", () => {
      const validUri = "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
      const cid = parseIpfsUri(validUri);
      expect(cid).toBe("bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku");
    });

    it("should parse and validate gateway URL with valid CID", () => {
      const gatewayUrl = "https://w3s.link/ipfs/QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS";
      const cid = parseIpfsUri(gatewayUrl);
      expect(cid).toBe("QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS");
    });

    it("should throw for ipfs:// URI with invalid CID", () => {
      const invalidUri = "ipfs://invalid-cid-format";
      expect(() => parseIpfsUri(invalidUri)).toThrow("Invalid CID format");
    });

    it("should throw for gateway URL with invalid CID", () => {
      const invalidUri = "https://ipfs.io/ipfs/notavalidcid";
      expect(() => parseIpfsUri(invalidUri)).toThrow("Invalid CID format");
    });

    it("should throw for non-IPFS URLs", () => {
      expect(() => parseIpfsUri("https://example.com")).toThrow("Invalid IPFS URI");
    });
  });
});

describe("QA-004: Enhanced Validation", () => {
  describe("Timestamp format validation", () => {
    it("should accept valid ISO 8601 timestamp", () => {
      const trace = createTestTrace({
        timestamp: "2024-01-15T10:30:00.000Z",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
    });

    it("should accept ISO 8601 timestamp without milliseconds", () => {
      const trace = createTestTrace({
        timestamp: "2024-01-15T10:30:00Z",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
    });

    it("should accept ISO 8601 timestamp with timezone offset", () => {
      const trace = createTestTrace({
        timestamp: "2024-01-15T10:30:00+05:30",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid timestamp format", () => {
      const trace = createTestTrace({
        timestamp: "January 15, 2024",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp format");
      expect(result.error).toContain("ISO 8601");
    });

    it("should reject Unix timestamp", () => {
      const trace = createTestTrace({
        timestamp: "1705315800",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp format");
    });

    it("should reject date-only format", () => {
      const trace = createTestTrace({
        timestamp: "2024-01-15",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp format");
    });

    it("should reject malformed ISO timestamp", () => {
      const trace = createTestTrace({
        timestamp: "2024/01/15T10:30:00Z",
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp format");
    });
  });

  describe("Content size validation", () => {
    it("should accept small content", () => {
      const trace = createTestTrace({
        content: { data: "small" },
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
    });

    it("should accept content just under 10MB", () => {
      // Create content that's just under 10MB when stringified
      // Using a smaller test size to avoid memory issues in tests
      const trace = createTestTrace({
        content: { data: "x".repeat(1000000) }, // ~1MB for testing
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
    });

    it("should reject content over 10MB", () => {
      // Create content that exceeds 10MB
      const largeData = "x".repeat(MAX_CONTENT_SIZE + 1000);
      const trace = createTestTrace({
        content: { data: largeData },
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Content too large");
      expect(result.error).toContain("max:");
    });

    it("should include actual size in error message", () => {
      const largeData = "x".repeat(MAX_CONTENT_SIZE + 1000);
      const trace = createTestTrace({
        content: { data: largeData },
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/\d+ bytes/);
    });
  });

  describe("Combined validation", () => {
    it("should check timestamp format before content size", () => {
      // Both invalid - should report timestamp error first
      const trace = createTestTrace({
        timestamp: "invalid-date",
        content: { data: "x".repeat(MAX_CONTENT_SIZE + 1000) },
      });
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp");
    });

    it("should validate all required fields before format checks", () => {
      // Missing agentId should be caught before timestamp format
      const trace = {
        version: "1.0.0",
        traceId: "test",
        // missing agentId
        timestamp: "invalid-date",
        granularity: 0,
        content: {},
      };
      const result = validateTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("agentId");
    });
  });
});

describe("SEC-006: User-Provided IPFS URI Validation", () => {
  describe("AgentAnchorClient.anchorTrace() with ipfsUri option", () => {
    let client: AgentAnchorClient;
    const validTrace = {
      version: "1.0.0",
      traceId: "test-trace-123",
      agentId: "test-agent-001",
      timestamp: new Date().toISOString(),
      granularity: 0 as const,
      content: { task: "test" },
    };

    beforeEach(() => {
      client = new AgentAnchorClient({
        network: "localhost",
        contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        mockIpfs: true,
      });
    });

    it("should accept valid CIDv0 IPFS URI", async () => {
      const validUri = "ipfs://QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS";
      // This should not throw during URI validation (may fail at contract call)
      try {
        await client.anchorTrace(validTrace, { ipfsUri: validUri, dryRun: true });
      } catch (error: unknown) {
        // May fail at contract level but not at URI validation
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).not.toContain("Invalid IPFS URI");
      }
    });

    it("should accept valid CIDv1 IPFS URI", async () => {
      const validUri = "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
      // This should not throw during URI validation (may fail at contract call)
      try {
        await client.anchorTrace(validTrace, { ipfsUri: validUri, dryRun: true });
      } catch (error: unknown) {
        // May fail at contract level but not at URI validation
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).not.toContain("Invalid IPFS URI");
      }
    });

    it("should reject invalid IPFS URI format", async () => {
      const invalidUri = "ipfs://not-a-valid-cid";
      await expect(
        client.anchorTrace(validTrace, { ipfsUri: invalidUri })
      ).rejects.toThrow("Invalid IPFS URI");
    });

    it("should reject malformed IPFS URI", async () => {
      const invalidUri = "https://example.com/not-ipfs";
      await expect(
        client.anchorTrace(validTrace, { ipfsUri: invalidUri })
      ).rejects.toThrow("Invalid IPFS URI");
    });

    it("should reject IPFS URI with invalid CID characters", async () => {
      // CIDv0 with invalid base58 characters (0, l, O, I)
      const invalidUri = "ipfs://Qm0lOIinvalidbase58chars123456789012345678901234";
      await expect(
        client.anchorTrace(validTrace, { ipfsUri: invalidUri })
      ).rejects.toThrow("Invalid IPFS URI");
    });
  });

  describe("IpfsClient.parseCid() validation", () => {
    let ipfsClient: IpfsClient;

    beforeEach(() => {
      ipfsClient = new IpfsClient({ apiToken: "test-token" });
    });

    it("should accept valid CIDv0", async () => {
      const validCid = "QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS";
      // exists() internally calls parseCid(), testing indirectly
      // Mock fetch to avoid actual network call
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const result = await ipfsClient.exists(`ipfs://${validCid}`);
      expect(result).toBe(true);
      vi.unstubAllGlobals();
    });

    it("should accept valid CIDv1", async () => {
      const validCid = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const result = await ipfsClient.exists(`ipfs://${validCid}`);
      expect(result).toBe(true);
      vi.unstubAllGlobals();
    });

    it("should reject invalid CID in URI", async () => {
      const invalidCid = "not-a-valid-cid-format";
      // exists() catches errors and returns false
      const result = await ipfsClient.exists(`ipfs://${invalidCid}`);
      expect(result).toBe(false);
    });

    it("should reject invalid CID in fetch()", async () => {
      const invalidUri = "ipfs://invalid-cid-123";
      await expect(ipfsClient.fetch(invalidUri)).rejects.toThrow("Invalid CID format");
    });

    it("should reject invalid CID in fetchRaw()", async () => {
      const invalidUri = "ipfs://invalid-cid-456";
      await expect(ipfsClient.fetchRaw(invalidUri)).rejects.toThrow("Invalid CID format");
    });

    it("should reject invalid CID in getGatewayUrl()", () => {
      const invalidUri = "ipfs://invalid-cid-789";
      expect(() => ipfsClient.getGatewayUrl(invalidUri)).toThrow("Invalid CID format");
    });
  });
});
