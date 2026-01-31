/**
 * SDK Identity Tests
 *
 * Tests for EIP-712 identity signature creation and verification
 */

import { describe, it, expect } from "vitest";
import { Wallet } from "ethers";
import {
  createIdentitySignature,
  verifyIdentitySignature,
  isValidIdentitySignature,
} from "../src/identity.js";

// Test wallet with known private key (for testing only)
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("Identity Module", () => {
  const testWallet = new Wallet(TEST_PRIVATE_KEY);
  const testParams = {
    traceHash: "0x" + "a".repeat(64), // Valid bytes32
    anchorTimestamp: 1706000000,
    chainId: 31337,
    contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  };

  describe("T013: createIdentitySignature", () => {
    it("should produce a valid EIP-712 signature", async () => {
      const result = await createIdentitySignature(testWallet, testParams);

      // Signature should be 65 bytes (130 hex chars + 0x prefix = 132 chars)
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    it("should include correct signer address", async () => {
      const result = await createIdentitySignature(testWallet, testParams);

      expect(result.signer).toBe(testWallet.address);
    });

    it("should use default purpose when not specified", async () => {
      const result = await createIdentitySignature(testWallet, testParams);

      expect(result.signedData.purpose).toBe("code-authorship");
    });

    it("should use custom purpose when specified", async () => {
      const result = await createIdentitySignature(testWallet, {
        ...testParams,
        purpose: "audit-trail",
      });

      expect(result.signedData.purpose).toBe("audit-trail");
    });

    it("should include correct signed data", async () => {
      const result = await createIdentitySignature(testWallet, testParams);

      expect(result.signedData.traceHash).toBe(testParams.traceHash);
      expect(result.signedData.initiator).toBe(testWallet.address);
      expect(result.signedData.timestamp).toBe(BigInt(testParams.anchorTimestamp));
    });

    it("should produce different signatures for different trace hashes", async () => {
      const result1 = await createIdentitySignature(testWallet, testParams);
      const result2 = await createIdentitySignature(testWallet, {
        ...testParams,
        traceHash: "0x" + "b".repeat(64),
      });

      expect(result1.signature).not.toBe(result2.signature);
    });

    it("should produce different signatures for different timestamps", async () => {
      const result1 = await createIdentitySignature(testWallet, testParams);
      const result2 = await createIdentitySignature(testWallet, {
        ...testParams,
        anchorTimestamp: 1706000001,
      });

      expect(result1.signature).not.toBe(result2.signature);
    });

    it("should produce different signatures for different chain IDs", async () => {
      const result1 = await createIdentitySignature(testWallet, testParams);
      const result2 = await createIdentitySignature(testWallet, {
        ...testParams,
        chainId: 1,
      });

      expect(result1.signature).not.toBe(result2.signature);
    });

    it("should produce different signatures for different contract addresses", async () => {
      const result1 = await createIdentitySignature(testWallet, testParams);
      const result2 = await createIdentitySignature(testWallet, {
        ...testParams,
        contractAddress: "0x" + "1".repeat(40),
      });

      expect(result1.signature).not.toBe(result2.signature);
    });
  });

  describe("T014: verifyIdentitySignature", () => {
    it("should return correct signer address for valid signature", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const recoveredAddress = verifyIdentitySignature(signature, {
        traceHash: signedData.traceHash,
        initiator: signedData.initiator,
        timestamp: signedData.timestamp,
        purpose: signedData.purpose as "code-authorship",
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(recoveredAddress.toLowerCase()).toBe(testWallet.address.toLowerCase());
    });

    it("should return different address when traceHash is tampered", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const recoveredAddress = verifyIdentitySignature(signature, {
        traceHash: "0x" + "c".repeat(64), // Different traceHash
        initiator: signedData.initiator,
        timestamp: signedData.timestamp,
        purpose: signedData.purpose as "code-authorship",
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(recoveredAddress.toLowerCase()).not.toBe(testWallet.address.toLowerCase());
    });

    it("should return different address when timestamp is tampered", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const recoveredAddress = verifyIdentitySignature(signature, {
        traceHash: signedData.traceHash,
        initiator: signedData.initiator,
        timestamp: 9999999999, // Different timestamp
        purpose: signedData.purpose as "code-authorship",
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(recoveredAddress.toLowerCase()).not.toBe(testWallet.address.toLowerCase());
    });

    it("should return different address when purpose is tampered", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const recoveredAddress = verifyIdentitySignature(signature, {
        traceHash: signedData.traceHash,
        initiator: signedData.initiator,
        timestamp: signedData.timestamp,
        purpose: "compliance", // Different purpose
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(recoveredAddress.toLowerCase()).not.toBe(testWallet.address.toLowerCase());
    });
  });

  describe("isValidIdentitySignature", () => {
    it("should return true for valid signature from expected signer", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const isValid = isValidIdentitySignature(signature, testWallet.address, {
        traceHash: signedData.traceHash,
        initiator: signedData.initiator,
        timestamp: signedData.timestamp,
        purpose: signedData.purpose as "code-authorship",
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(isValid).toBe(true);
    });

    it("should return false for different expected signer", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const isValid = isValidIdentitySignature(signature, "0x" + "1".repeat(40), {
        traceHash: signedData.traceHash,
        initiator: signedData.initiator,
        timestamp: signedData.timestamp,
        purpose: signedData.purpose as "code-authorship",
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(isValid).toBe(false);
    });

    it("should return false for invalid signature format", () => {
      const isValid = isValidIdentitySignature("0xinvalid", testWallet.address, {
        traceHash: testParams.traceHash,
        initiator: testWallet.address,
        timestamp: testParams.anchorTimestamp,
        chainId: testParams.chainId,
        contractAddress: testParams.contractAddress,
      });

      expect(isValid).toBe(false);
    });

    it("should handle case-insensitive address comparison", async () => {
      const { signature, signedData } = await createIdentitySignature(testWallet, testParams);

      const isValid = isValidIdentitySignature(
        signature,
        testWallet.address.toUpperCase(), // Uppercase address
        {
          traceHash: signedData.traceHash,
          initiator: signedData.initiator,
          timestamp: signedData.timestamp,
          purpose: signedData.purpose as "code-authorship",
          chainId: testParams.chainId,
          contractAddress: testParams.contractAddress,
        }
      );

      expect(isValid).toBe(true);
    });
  });

  describe("Signature determinism", () => {
    it("should produce same signature for same inputs", async () => {
      const result1 = await createIdentitySignature(testWallet, testParams);
      const result2 = await createIdentitySignature(testWallet, testParams);

      expect(result1.signature).toBe(result2.signature);
    });
  });

  describe("Edge cases", () => {
    it("should handle BigInt timestamps", async () => {
      const result = await createIdentitySignature(testWallet, {
        ...testParams,
        anchorTimestamp: BigInt(testParams.anchorTimestamp),
      });

      expect(result.signedData.timestamp).toBe(BigInt(testParams.anchorTimestamp));
    });

    it("should handle BigInt chainId", async () => {
      const result = await createIdentitySignature(testWallet, {
        ...testParams,
        chainId: BigInt(testParams.chainId),
      });

      // Should still produce a valid signature
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });
  });
});
