/**
 * Trace Lineage Tests (T045-T049)
 *
 * Tests for the getTraceLineage helper function that traverses
 * from child traces up to root traces.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTraceLineage,
  validateMaxDepth,
  isRootTraceHelper,
  getRootTrace,
  getTraceDepth,
  DEFAULT_MAX_DEPTH,
  type TraceQueryClient,
} from "../src/linking.js";

/**
 * Create a mock client for testing lineage traversal
 */
function createMockClient(
  parentMap: Map<string, string | null>
): TraceQueryClient {
  return {
    getParentTrace: vi.fn().mockImplementation(async (traceHash: string) => {
      const parent = parentMap.get(traceHash);
      if (parent === null || parent === undefined) {
        // Root trace or unknown trace
        return {
          parentHash: "0x" + "0".repeat(64),
          hasParent: false,
        };
      }
      return {
        parentHash: parent,
        hasParent: true,
      };
    }),
  };
}

describe("Trace Lineage (T045-T049)", () => {
  describe("validateMaxDepth", () => {
    it("should accept valid maxDepth values", () => {
      expect(() => validateMaxDepth(1)).not.toThrow();
      expect(() => validateMaxDepth(100)).not.toThrow();
      expect(() => validateMaxDepth(10000)).not.toThrow();
    });

    it("should reject maxDepth less than 1", () => {
      expect(() => validateMaxDepth(0)).toThrow("maxDepth must be at least 1");
      expect(() => validateMaxDepth(-1)).toThrow("maxDepth must be at least 1");
    });

    it("should reject maxDepth greater than 10000", () => {
      expect(() => validateMaxDepth(10001)).toThrow(
        "maxDepth cannot exceed 10000"
      );
      expect(() => validateMaxDepth(100000)).toThrow(
        "maxDepth cannot exceed 10000"
      );
    });

    it("should reject non-integer maxDepth", () => {
      expect(() => validateMaxDepth(1.5)).toThrow("maxDepth must be an integer");
      expect(() => validateMaxDepth(10.1)).toThrow(
        "maxDepth must be an integer"
      );
    });

    it("should reject non-finite maxDepth", () => {
      expect(() => validateMaxDepth(Infinity)).toThrow(
        "maxDepth must be a finite number"
      );
      expect(() => validateMaxDepth(NaN)).toThrow(
        "maxDepth must be a finite number"
      );
    });
  });

  describe("getTraceLineage", () => {
    it("should return correct lineage for root trace", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null], // Root trace has no parent
      ]);

      const client = createMockClient(parentMap);
      const lineage = await getTraceLineage(client, rootHash);

      expect(lineage.traceHash).toBe(rootHash);
      expect(lineage.ancestors).toEqual([rootHash]);
      expect(lineage.depth).toBe(0);
      expect(lineage.root).toBe(rootHash);
    });

    it("should return correct lineage for trace with one parent", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const childHash = "0x" + "2".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null],
        [childHash, rootHash],
      ]);

      const client = createMockClient(parentMap);
      const lineage = await getTraceLineage(client, childHash);

      expect(lineage.traceHash).toBe(childHash);
      expect(lineage.ancestors).toEqual([childHash, rootHash]);
      expect(lineage.depth).toBe(1);
      expect(lineage.root).toBe(rootHash);
    });

    it("should return correct lineage for deep trace hierarchy", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const level1Hash = "0x" + "2".repeat(64);
      const level2Hash = "0x" + "3".repeat(64);
      const level3Hash = "0x" + "4".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null],
        [level1Hash, rootHash],
        [level2Hash, level1Hash],
        [level3Hash, level2Hash],
      ]);

      const client = createMockClient(parentMap);
      const lineage = await getTraceLineage(client, level3Hash);

      expect(lineage.traceHash).toBe(level3Hash);
      expect(lineage.ancestors).toEqual([
        level3Hash,
        level2Hash,
        level1Hash,
        rootHash,
      ]);
      expect(lineage.depth).toBe(3);
      expect(lineage.root).toBe(rootHash);
    });

    it("should use default maxDepth of 100", async () => {
      expect(DEFAULT_MAX_DEPTH).toBe(100);

      // Create a chain that doesn't exceed default depth
      const hashes: string[] = [];
      const parentMap = new Map<string, string | null>();

      for (let i = 0; i < 50; i++) {
        const hash = "0x" + i.toString().padStart(64, "0");
        hashes.push(hash);
        if (i === 0) {
          parentMap.set(hash, null);
        } else {
          parentMap.set(hash, hashes[i - 1] as string);
        }
      }

      const client = createMockClient(parentMap);
      const leafHash = hashes[hashes.length - 1] as string;
      const lineage = await getTraceLineage(client, leafHash);

      expect(lineage.depth).toBe(49);
      expect(lineage.root).toBe(hashes[0]);
    });

    it("should throw when maxDepth is exceeded", async () => {
      // Create a chain longer than maxDepth
      const hashes: string[] = [];
      const parentMap = new Map<string, string | null>();

      for (let i = 0; i < 15; i++) {
        const hash = "0x" + i.toString().padStart(64, "0");
        hashes.push(hash);
        if (i === 0) {
          parentMap.set(hash, null);
        } else {
          parentMap.set(hash, hashes[i - 1] as string);
        }
      }

      const client = createMockClient(parentMap);
      const leafHash = hashes[hashes.length - 1] as string;

      await expect(
        getTraceLineage(client, leafHash, { maxDepth: 5 })
      ).rejects.toThrow("Exceeded maxDepth (5)");
    });

    it("should respect custom maxDepth option", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const childHash = "0x" + "2".repeat(64);
      const grandchildHash = "0x" + "3".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null],
        [childHash, rootHash],
        [grandchildHash, childHash],
      ]);

      const client = createMockClient(parentMap);

      // Should work with maxDepth of 3 (allows traversing up to 3 levels)
      const lineage = await getTraceLineage(client, grandchildHash, {
        maxDepth: 3,
      });
      expect(lineage.depth).toBe(2);

      // maxDepth of 2 should fail because we need to traverse 2 parent links
      // and the check happens after incrementing depth
      await expect(
        getTraceLineage(client, grandchildHash, { maxDepth: 2 })
      ).rejects.toThrow("Exceeded maxDepth (2)");

      // maxDepth of 2 should work for child->root (only 1 parent link)
      const lineage3 = await getTraceLineage(client, childHash, {
        maxDepth: 2,
      });
      expect(lineage3.depth).toBe(1);
    });

    it("should validate maxDepth parameter", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const parentMap = new Map<string, string | null>([[rootHash, null]]);
      const client = createMockClient(parentMap);

      await expect(
        getTraceLineage(client, rootHash, { maxDepth: 0 })
      ).rejects.toThrow("maxDepth must be at least 1");

      await expect(
        getTraceLineage(client, rootHash, { maxDepth: -1 })
      ).rejects.toThrow("maxDepth must be at least 1");

      await expect(
        getTraceLineage(client, rootHash, { maxDepth: 1.5 })
      ).rejects.toThrow("maxDepth must be an integer");
    });
  });

  describe("isRootTraceHelper", () => {
    it("should return true for root traces", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const parentMap = new Map<string, string | null>([[rootHash, null]]);
      const client = createMockClient(parentMap);

      const isRoot = await isRootTraceHelper(client, rootHash);
      expect(isRoot).toBe(true);
    });

    it("should return false for non-root traces", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const childHash = "0x" + "2".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null],
        [childHash, rootHash],
      ]);
      const client = createMockClient(parentMap);

      const isRoot = await isRootTraceHelper(client, childHash);
      expect(isRoot).toBe(false);
    });
  });

  describe("getRootTrace", () => {
    it("should return the root hash for any trace in the lineage", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const childHash = "0x" + "2".repeat(64);
      const grandchildHash = "0x" + "3".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null],
        [childHash, rootHash],
        [grandchildHash, childHash],
      ]);
      const client = createMockClient(parentMap);

      expect(await getRootTrace(client, rootHash)).toBe(rootHash);
      expect(await getRootTrace(client, childHash)).toBe(rootHash);
      expect(await getRootTrace(client, grandchildHash)).toBe(rootHash);
    });
  });

  describe("getTraceDepth", () => {
    it("should return 0 for root traces", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const parentMap = new Map<string, string | null>([[rootHash, null]]);
      const client = createMockClient(parentMap);

      const depth = await getTraceDepth(client, rootHash);
      expect(depth).toBe(0);
    });

    it("should return correct depth for non-root traces", async () => {
      const rootHash = "0x" + "1".repeat(64);
      const level1Hash = "0x" + "2".repeat(64);
      const level2Hash = "0x" + "3".repeat(64);
      const level3Hash = "0x" + "4".repeat(64);
      const parentMap = new Map<string, string | null>([
        [rootHash, null],
        [level1Hash, rootHash],
        [level2Hash, level1Hash],
        [level3Hash, level2Hash],
      ]);
      const client = createMockClient(parentMap);

      expect(await getTraceDepth(client, rootHash)).toBe(0);
      expect(await getTraceDepth(client, level1Hash)).toBe(1);
      expect(await getTraceDepth(client, level2Hash)).toBe(2);
      expect(await getTraceDepth(client, level3Hash)).toBe(3);
    });
  });

  describe("Integration with AgentAnchorClient interface", () => {
    it("should work with client that implements TraceQueryClient", async () => {
      // This test verifies the interface compatibility
      interface MockClient {
        getParentTrace(
          traceHash: string
        ): Promise<{ parentHash: string; hasParent: boolean }>;
      }

      const mockClient: MockClient = {
        getParentTrace: vi.fn().mockResolvedValue({
          parentHash: "0x" + "0".repeat(64),
          hasParent: false,
        }),
      };

      // The mock client satisfies TraceQueryClient interface
      const lineage = await getTraceLineage(
        mockClient as TraceQueryClient,
        "0x" + "1".repeat(64)
      );

      expect(lineage.depth).toBe(0);
      expect(mockClient.getParentTrace).toHaveBeenCalled();
    });
  });
});
