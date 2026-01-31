import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchorV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchorV2 - Identity Binding (US1)", function () {
  // Test fixtures
  async function deployAgentAnchorV2Fixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const AgentAnchorV2Factory = await ethers.getContractFactory("AgentAnchorV2");
    const agentAnchorV2 = await AgentAnchorV2Factory.deploy();

    // Generate test data
    const traceHash = ethers.keccak256(ethers.toUtf8Bytes("test-trace-content"));
    const ipfsUri = "ipfs://QmTest123456789";
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-001"));
    const granularity = 0; // Session

    return { agentAnchorV2, owner, user1, user2, traceHash, ipfsUri, agentId, granularity };
  }

  // Helper to create an anchor first (required for identity binding)
  async function deployWithAnchorFixture() {
    const fixture = await deployAgentAnchorV2Fixture();
    const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } = fixture;

    await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

    return fixture;
  }

  // Helper to create EIP-712 signature
  async function createIdentitySignature(
    signer: SignerWithAddress,
    contractAddress: string,
    traceHash: string,
    chainId: bigint,
    timestamp: bigint
  ): Promise<string> {
    const domain = {
      name: "AgentAnchor",
      version: "2",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      TraceIdentity: [
        { name: "traceHash", type: "bytes32" },
        { name: "initiator", type: "address" },
        { name: "timestamp", type: "uint256" },
        { name: "purpose", type: "string" },
      ],
    };

    const value = {
      traceHash: traceHash,
      initiator: signer.address,
      timestamp: timestamp,
      purpose: "code-authorship",
    };

    return signer.signTypedData(domain, types, value);
  }

  // Helper to get anchor timestamp
  async function getAnchorTimestamp(
    contract: AgentAnchorV2,
    traceHash: string
  ): Promise<bigint> {
    const anchor = await contract.getAnchor(traceHash);
    return anchor.timestamp;
  }

  describe("T009: bindIdentity stores signer and emits event", function () {
    it("should store signer address when valid signature is provided", async function () {
      const { agentAnchorV2, owner, traceHash } =
        await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      await agentAnchorV2.bindIdentity(traceHash, signature);

      const binding = await agentAnchorV2.getIdentityBinding(traceHash);
      expect(binding.signer).to.equal(owner.address);
      expect(binding.verified).to.be.true;
      expect(binding.signatureType).to.equal(0); // EIP-712
    });

    it("should emit IdentityBound event with correct parameters", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      await expect(agentAnchorV2.bindIdentity(traceHash, signature))
        .to.emit(agentAnchorV2, "IdentityBound")
        .withArgs(traceHash, owner.address, (timestamp: bigint) => timestamp > 0n);
    });

    it("should emit IdentityBoundWithSignature event with full signature", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      await expect(agentAnchorV2.bindIdentity(traceHash, signature))
        .to.emit(agentAnchorV2, "IdentityBoundWithSignature");
    });
  });

  describe("T010: verifyIdentity returns true for valid binding", function () {
    it("should return true and signer address after binding", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      await agentAnchorV2.bindIdentity(traceHash, signature);

      const [verified, signer] = await agentAnchorV2.verifyIdentity(traceHash);
      expect(verified).to.be.true;
      expect(signer).to.equal(owner.address);
    });

    it("should return false and zero address before binding", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const [verified, signer] = await agentAnchorV2.verifyIdentity(traceHash);
      expect(verified).to.be.false;
      expect(signer).to.equal(ethers.ZeroAddress);
    });
  });

  describe("T011: Invalid signature reverts with InvalidSignature error", function () {
    it("should revert with InvalidSignature for malformed signature", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      // Invalid signature (wrong length)
      const invalidSignature = "0x1234567890";

      await expect(agentAnchorV2.bindIdentity(traceHash, invalidSignature))
        .to.be.reverted; // ECDSA will revert on invalid signature
    });

    it("should revert for signature with wrong v value", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      // Create valid signature then corrupt the v value
      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      // Corrupt the signature
      const corruptedSig = signature.slice(0, -2) + "00";

      await expect(agentAnchorV2.bindIdentity(traceHash, corruptedSig))
        .to.be.reverted;
    });
  });

  describe("T012: Signature replay attack fails", function () {
    it("should reject same signature for different trace", async function () {
      const { agentAnchorV2, owner, ipfsUri, agentId, granularity } =
        await loadFixture(deployWithAnchorFixture);

      const traceHash1 = ethers.keccak256(ethers.toUtf8Bytes("trace-1"));
      const traceHash2 = ethers.keccak256(ethers.toUtf8Bytes("trace-2"));

      // Create anchors for both traces
      await agentAnchorV2.anchorTrace(traceHash1, ipfsUri, agentId, granularity);
      await agentAnchorV2.anchorTrace(traceHash2, ipfsUri, agentId, granularity);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchor1Timestamp = await getAnchorTimestamp(agentAnchorV2, traceHash1);

      // Create signature for traceHash1
      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash1,
        chainId,
        anchor1Timestamp
      );

      // Bind to trace1 successfully
      await agentAnchorV2.bindIdentity(traceHash1, signature);

      // Try to use same signature for trace2 - should fail because signature is for different trace
      // The recovered address will be different from msg.sender
      await expect(agentAnchorV2.bindIdentity(traceHash2, signature))
        .to.be.revertedWithCustomError(agentAnchorV2, "InvalidSignature");
    });

    it("should reject binding same trace twice", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      // First binding succeeds
      await agentAnchorV2.bindIdentity(traceHash, signature);

      // Second binding fails
      await expect(agentAnchorV2.bindIdentity(traceHash, signature))
        .to.be.revertedWithCustomError(agentAnchorV2, "IdentityAlreadyBound");
    });
  });

  describe("Edge Cases", function () {
    it("should revert if trace does not exist", async function () {
      const { agentAnchorV2, owner } = await loadFixture(deployAgentAnchorV2Fixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();

      // Use a dummy timestamp since the trace doesn't exist
      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        nonExistentHash,
        chainId,
        BigInt(Math.floor(Date.now() / 1000))
      );

      await expect(agentAnchorV2.bindIdentity(nonExistentHash, signature))
        .to.be.revertedWithCustomError(agentAnchorV2, "TraceNotFound");
    });

    it("should allow different user to bind identity", async function () {
      const { agentAnchorV2, user1, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      // User1 (not the anchor creator) binds their identity
      const signature = await createIdentitySignature(
        user1,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      await agentAnchorV2.connect(user1).bindIdentity(traceHash, signature);

      const binding = await agentAnchorV2.getIdentityBinding(traceHash);
      expect(binding.signer).to.equal(user1.address);
    });

    it("should record binding timestamp", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      const txResponse = await agentAnchorV2.bindIdentity(traceHash, signature);
      const block = await txResponse.getBlock();

      const binding = await agentAnchorV2.getIdentityBinding(traceHash);
      expect(binding.bindingTimestamp).to.equal(block!.timestamp);
    });
  });

  describe("Integration with getOwnershipRecord", function () {
    it("should include identity in ownership record", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await agentAnchorV2.getAddress();
      const anchorTimestamp = await getAnchorTimestamp(agentAnchorV2, traceHash);

      const signature = await createIdentitySignature(
        owner,
        contractAddress,
        traceHash,
        chainId,
        anchorTimestamp
      );

      await agentAnchorV2.bindIdentity(traceHash, signature);

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.hasIdentity).to.be.true;
      expect(record.identitySigner).to.equal(owner.address);
      expect(record.identityVerified).to.be.true;
    });
  });
});
