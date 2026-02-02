/**
 * SDK ClientV2 Integration Tests
 *
 * T060: SDK test for anchorTraceV2() with full options object
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgentAnchorClientV2,
  hashTrace,
  validateContribution,
  createContributionRatio,
  DeclarationType,
  Granularity,
} from "../src/index.js";
import type { AgentTrace, AnchorOptionsV2 } from "../src/types.js";

// Mock ethers for unit testing
vi.mock("ethers", async () => {
  const actual = await vi.importActual("ethers");

  const mockContract = {
    getAddress: vi.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
    getFunction: vi.fn().mockImplementation((name: string) => {
      const mockFn = vi.fn();

      if (name === "anchorTrace") {
        mockFn.mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: "0xabc123",
            blockNumber: 12345,
            gasUsed: BigInt(100000),
          }),
        });
        mockFn.estimateGas = vi.fn().mockResolvedValue(BigInt(100000));
      } else if (name === "bindIdentity") {
        mockFn.mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: "0xbind123",
          }),
        });
      } else if (name === "setGitMetadata") {
        mockFn.mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: "0xgit123",
          }),
        });
      } else if (name === "declareAuthorship") {
        mockFn.mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: "0xauth123",
          }),
        });
      } else if (name === "setContribution") {
        mockFn.mockResolvedValue({
          wait: vi.fn().mockResolvedValue({
            hash: "0xcontrib123",
          }),
        });
      } else if (name === "getAnchor") {
        mockFn.mockResolvedValue({
          traceHash: "0x1234",
          ipfsUri: "ipfs://Qm123",
          agentId: "0x5678",
          granularity: 0,
          creator: "0x0000000000000000000000000000000000000001",
          timestamp: BigInt(1700000000),
          blockNumber: BigInt(12345),
        });
      } else if (name === "verifyTrace") {
        mockFn.mockResolvedValue([true, "ipfs://Qm123", "0x0001", BigInt(1700000000)]);
      } else if (name === "verifyIdentity") {
        mockFn.mockResolvedValue([true, "0x0000000000000000000000000000000000000001"]);
      } else if (name === "getIdentityBinding") {
        mockFn.mockResolvedValue({
          signer: "0x0000000000000000000000000000000000000001",
          bindingTimestamp: BigInt(1700000000),
          signatureType: 0,
          verified: true,
        });
      } else if (name === "getGitMetadata") {
        mockFn.mockResolvedValue([
          "0x0000000000000000000000000000000000000000000000000000000000001234",
          true,
        ]);
      } else if (name === "getAuthorship") {
        mockFn.mockResolvedValue([
          "0x0000000000000000000000000000000000000001",
          0,
          BigInt(1700000000),
          true,
        ]);
      } else if (name === "getContribution") {
        mockFn.mockResolvedValue([70, 30, true]);
      } else if (name === "getOwnershipRecord") {
        mockFn.mockResolvedValue({
          traceHash: "0x1234",
          creator: "0x0000000000000000000000000000000000000001",
          anchorTimestamp: BigInt(1700000000),
          identitySigner: "0x0000000000000000000000000000000000000001",
          identityVerified: true,
          claimant: "0x0000000000000000000000000000000000000001",
          declarationType: 0,
          humanPercent: 70,
          aiPercent: 30,
          commitSha: "0x0000000000000000000000000000000000000000000000000000000000001234",
          hasIdentity: true,
          hasOwnership: true,
          hasGitMetadata: true,
        });
      }

      return mockFn;
    }),
    target: "0x1234567890123456789012345678901234567890",
  };

  const mockSigner = {
    getAddress: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000001"),
    signTypedData: vi.fn().mockResolvedValue("0xsignature123"),
  };

  return {
    ...actual,
    Contract: vi.fn().mockImplementation(() => mockContract),
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: BigInt(1000000000),
      }),
    })),
    Wallet: vi.fn().mockImplementation(() => ({
      ...mockSigner,
      provider: {},
    })),
  };
});

// Mock contract address for testing
const MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";

describe("AgentAnchorClientV2 Integration", () => {
  const mockTrace: AgentTrace = {
    version: "1.0.0",
    traceId: "test-trace-id",
    agentId: "test-agent-id",
    sessionId: "test-session-id",
    timestamp: new Date().toISOString(),
    granularity: Granularity.Session,
    content: [
      {
        timestamp: new Date().toISOString(),
        type: "code_generation",
        input: "test input",
        output: "test output",
      },
    ],
    metadata: {
      model: "test-model",
      version: "1.0.0",
    },
  };

  describe("T060: anchorTraceV2() with full options object", () => {
    it("should anchor trace with default options", async () => {
      const client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
        mockIpfs: true,
      });

      const result = await client.anchorTrace(mockTrace);

      expect(result.success).toBe(true);
      expect(result.traceHash).toBeDefined();
      expect(result.ipfsUri).toBeDefined();
      expect(result.transactionHash).toBeDefined();
    });

    it("should anchor trace with custom IPFS URI", async () => {
      const client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
        mockIpfs: true,
      });

      // Use a valid CIDv0 format (Qm + 44 base58 chars)
      const customIpfsUri = "ipfs://QmYwAPJzv5CZsnAzt8auVZRVyTM9q9J1xsNQ8bqPw9kDzS";
      const result = await client.anchorTrace(mockTrace, {
        ipfsUri: customIpfsUri,
      });

      expect(result.success).toBe(true);
      expect(result.ipfsUri).toBe(customIpfsUri);
    });

    it("should perform dry run without submitting transaction", async () => {
      const client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
        mockIpfs: true,
      });

      const result = await client.anchorTrace(mockTrace, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe("0x" + "0".repeat(64));
      expect(result.blockNumber).toBe(0);
    });

    it("should validate trace before anchoring", async () => {
      const client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
        mockIpfs: true,
      });

      // Create invalid trace by omitting required content field
      const invalidTrace = {
        version: "1.0.0",
        traceId: "test-id",
        agentId: "test-agent",
        timestamp: new Date().toISOString(),
        granularity: Granularity.Session,
        // Missing content field
      } as AgentTrace;

      await expect(client.anchorTrace(invalidTrace)).rejects.toThrow("Invalid trace");
    });
  });

  describe("V2 Ownership Operations", () => {
    let client: AgentAnchorClientV2;

    beforeEach(() => {
      client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
        mockIpfs: true,
      });
    });

    it("should verify identity binding", async () => {
      const result = await client.verifyIdentity("0x1234");

      expect(result.verified).toBe(true);
      expect(result.signer).toBeDefined();
    });

    it("should get identity binding", async () => {
      const binding = await client.getIdentityBinding("0x1234");

      expect(binding.verified).toBe(true);
      expect(binding.signer).toBeDefined();
      expect(binding.bindingTimestamp).toBeGreaterThan(0);
    });

    it("should get git metadata", async () => {
      const result = await client.getGitMetadata("0x1234");

      expect(result.hasMetadata).toBe(true);
      expect(result.commitSha).toBeDefined();
    });

    it("should get authorship", async () => {
      const result = await client.getAuthorship("0x1234");

      expect(result.hasClaim).toBe(true);
      expect(result.claimant).toBeDefined();
      expect(result.declarationType).toBeDefined();
    });

    it("should get contribution", async () => {
      const result = await client.getContribution("0x1234");

      expect(result.hasContribution).toBe(true);
      expect(result.humanPercent).toBe(70);
      expect(result.aiPercent).toBe(30);
    });

    it("should get complete ownership record", async () => {
      const record = await client.getOwnershipRecord("0x1234");

      expect(record.traceHash).toBeDefined();
      expect(record.creator).toBeDefined();
      expect(record.hasIdentity).toBe(true);
      expect(record.hasOwnership).toBe(true);
      expect(record.hasGitMetadata).toBe(true);
      expect(record.humanPercent).toBe(70);
      expect(record.aiPercent).toBe(30);
    });
  });

  describe("Contribution Validation", () => {
    it("should validate correct contributions", () => {
      expect(validateContribution(70, 30)).toEqual({ valid: true });
      expect(validateContribution(0, 100)).toEqual({ valid: true });
      expect(validateContribution(100, 0)).toEqual({ valid: true });
    });

    it("should reject invalid contributions", () => {
      const result = validateContribution(70, 40);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("sum to 100");
    });

    it("should create contribution ratio", () => {
      const ratio = createContributionRatio(80, 20, "Primary developer");

      expect(ratio.humanPercent).toBe(80);
      expect(ratio.aiPercent).toBe(20);
      expect(ratio.notes).toBe("Primary developer");
    });
  });

  describe("Client Configuration", () => {
    it("should use correct network configuration", () => {
      const client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
      });

      expect(client.getNetwork()).toBe("polygon-testnet");
    });

    it("should get chain ID", () => {
      const client = new AgentAnchorClientV2({
        network: "polygon-testnet",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        contractAddress: MOCK_CONTRACT_ADDRESS,
      });

      const chainId = client.getChainId();
      expect(chainId).toBeDefined();
    });

    it("should throw for unknown network", () => {
      expect(() => {
        new AgentAnchorClientV2({
          network: "unknown-network" as any,
          privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
        });
      }).toThrow("Unknown network");
    });

    it("should require private key for write operations", async () => {
      const readOnlyClient = new AgentAnchorClientV2({
        network: "polygon-testnet",
        contractAddress: MOCK_CONTRACT_ADDRESS,
      });

      await expect(readOnlyClient.anchorTrace(mockTrace)).rejects.toThrow(
        "Signer required"
      );
    });
  });

  describe("Hash Utilities", () => {
    it("should produce consistent trace hashes", () => {
      const hash1 = hashTrace(mockTrace);
      const hash2 = hashTrace(mockTrace);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should produce different hashes for different traces", () => {
      const trace2 = { ...mockTrace, traceId: "different-id" };

      const hash1 = hashTrace(mockTrace);
      const hash2 = hashTrace(trace2);

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe("Full V2 Flow Simulation", () => {
  it("should simulate complete ownership flow", async () => {
    const client = new AgentAnchorClientV2({
      network: "polygon-testnet",
      privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      contractAddress: MOCK_CONTRACT_ADDRESS,
      mockIpfs: true,
    });

    const trace: AgentTrace = {
      version: "1.0.0",
      traceId: "flow-test-trace",
      agentId: "flow-test-agent",
      sessionId: "flow-test-session",
      timestamp: new Date().toISOString(),
      granularity: Granularity.Session,
      content: [
        {
          timestamp: new Date().toISOString(),
          type: "code_generation",
          input: "test",
          output: "result",
        },
      ],
      metadata: {
        model: "test-model",
        version: "1.0.0",
      },
    };

    // Step 1: Anchor trace
    const anchorResult = await client.anchorTrace(trace);
    expect(anchorResult.success).toBe(true);
    const traceHash = anchorResult.traceHash;

    // Step 2: Verify trace
    const verifyResult = await client.verifyTrace(traceHash);
    expect(verifyResult.exists).toBe(true);

    // Step 3: Get ownership record
    const record = await client.getOwnershipRecord(traceHash);
    expect(record).toBeDefined();
    expect(record.creator).toBeDefined();
  });
});
