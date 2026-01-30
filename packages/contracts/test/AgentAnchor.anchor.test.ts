import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchor } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchor - Anchor Tests", function () {
  // Test fixtures
  async function deployAgentAnchorFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const AgentAnchorFactory = await ethers.getContractFactory("AgentAnchor");
    const agentAnchor = await AgentAnchorFactory.deploy();

    // Generate test data
    const traceHash = ethers.keccak256(ethers.toUtf8Bytes("test-trace-content"));
    const ipfsUri = "ipfs://QmTest123456789";
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-001"));
    const granularity = 0; // Session

    return { agentAnchor, owner, user1, user2, traceHash, ipfsUri, agentId, granularity };
  }

  describe("anchorTrace", function () {
    it("should anchor a trace successfully", async function () {
      const { agentAnchor, owner, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const tx = await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      await tx.wait();

      // Verify anchor exists
      const exists = await agentAnchor.anchorExists(traceHash);
      expect(exists).to.be.true;

      // Verify anchor data
      const anchor = await agentAnchor.getAnchor(traceHash);
      expect(anchor.traceHash).to.equal(traceHash);
      expect(anchor.ipfsUri).to.equal(ipfsUri);
      expect(anchor.agentId).to.equal(agentId);
      expect(anchor.granularity).to.equal(granularity);
      expect(anchor.creator).to.equal(owner.address);
      expect(anchor.timestamp).to.be.gt(0);
      expect(anchor.blockNumber).to.be.gt(0);
    });

    it("should emit TraceAnchored event with correct parameters", async function () {
      const { agentAnchor, owner, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      await expect(agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity))
        .to.emit(agentAnchor, "TraceAnchored")
        .withArgs(
          traceHash,
          agentId,
          owner.address,
          ipfsUri,
          granularity,
          (timestamp: bigint) => timestamp > 0n
        );
    });

    it("should update agentAnchors mapping", async function () {
      const { agentAnchor, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      const traces = await agentAnchor.getTracesByAgent(agentId);
      expect(traces).to.have.lengthOf(1);
      expect(traces[0]).to.equal(traceHash);
    });

    it("should update creatorAnchors mapping", async function () {
      const { agentAnchor, owner, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      const traces = await agentAnchor.getTracesByCreator(owner.address);
      expect(traces).to.have.lengthOf(1);
      expect(traces[0]).to.equal(traceHash);
    });

    it("should increment totalAnchors", async function () {
      const { agentAnchor, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const before = await agentAnchor.totalAnchors();
      await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      const after = await agentAnchor.totalAnchors();

      expect(after).to.equal(before + 1n);
    });

    it("should return true on success", async function () {
      const { agentAnchor, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      // Use staticCall to get return value without modifying state
      const result = await agentAnchor.anchorTrace.staticCall(
        traceHash,
        ipfsUri,
        agentId,
        granularity
      );
      expect(result).to.be.true;
    });

    describe("Granularity levels", function () {
      it("should accept Session granularity (0)", async function () {
        const { agentAnchor, traceHash, ipfsUri, agentId } =
          await loadFixture(deployAgentAnchorFixture);

        await expect(agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, 0)).to.not.be.reverted;
      });

      it("should accept Task granularity (1)", async function () {
        const { agentAnchor, ipfsUri, agentId } = await loadFixture(deployAgentAnchorFixture);
        const traceHash = ethers.keccak256(ethers.toUtf8Bytes("task-trace"));

        await expect(agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, 1)).to.not.be.reverted;

        const anchor = await agentAnchor.getAnchor(traceHash);
        expect(anchor.granularity).to.equal(1);
      });

      it("should accept Step granularity (2)", async function () {
        const { agentAnchor, ipfsUri, agentId } = await loadFixture(deployAgentAnchorFixture);
        const traceHash = ethers.keccak256(ethers.toUtf8Bytes("step-trace"));

        await expect(agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, 2)).to.not.be.reverted;

        const anchor = await agentAnchor.getAnchor(traceHash);
        expect(anchor.granularity).to.equal(2);
      });
    });
  });

  describe("Input Validation", function () {
    it("should revert with InvalidTraceHash for zero hash", async function () {
      const { agentAnchor, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const zeroHash = ethers.ZeroHash;

      await expect(agentAnchor.anchorTrace(zeroHash, ipfsUri, agentId, granularity))
        .to.be.revertedWithCustomError(agentAnchor, "InvalidTraceHash");
    });

    it("should revert with InvalidIpfsUri for empty URI", async function () {
      const { agentAnchor, traceHash, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      await expect(agentAnchor.anchorTrace(traceHash, "", agentId, granularity))
        .to.be.revertedWithCustomError(agentAnchor, "InvalidIpfsUri");
    });

    it("should revert with InvalidAgentId for zero agent ID", async function () {
      const { agentAnchor, traceHash, ipfsUri, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const zeroAgentId = ethers.ZeroHash;

      await expect(agentAnchor.anchorTrace(traceHash, ipfsUri, zeroAgentId, granularity))
        .to.be.revertedWithCustomError(agentAnchor, "InvalidAgentId");
    });
  });

  describe("Duplicate Prevention", function () {
    it("should revert with AnchorAlreadyExists for duplicate trace hash", async function () {
      const { agentAnchor, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      // First anchor
      await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      // Attempt duplicate
      await expect(agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity))
        .to.be.revertedWithCustomError(agentAnchor, "AnchorAlreadyExists")
        .withArgs(traceHash);
    });

    it("should allow same IPFS URI for different trace hashes", async function () {
      const { agentAnchor, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("trace-1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("trace-2"));

      await agentAnchor.anchorTrace(hash1, ipfsUri, agentId, granularity);
      await expect(agentAnchor.anchorTrace(hash2, ipfsUri, agentId, granularity)).to.not.be
        .reverted;
    });
  });

  describe("Multiple Anchors", function () {
    it("should handle multiple anchors from same agent", async function () {
      const { agentAnchor, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const hashes = [
        ethers.keccak256(ethers.toUtf8Bytes("trace-1")),
        ethers.keccak256(ethers.toUtf8Bytes("trace-2")),
        ethers.keccak256(ethers.toUtf8Bytes("trace-3")),
      ];

      for (const hash of hashes) {
        await agentAnchor.anchorTrace(hash, ipfsUri, agentId, granularity);
      }

      const traces = await agentAnchor.getTracesByAgent(agentId);
      expect(traces).to.have.lengthOf(3);

      const count = await agentAnchor.getAgentTraceCount(agentId);
      expect(count).to.equal(3n);
    });

    it("should handle multiple anchors from same creator", async function () {
      const { agentAnchor, owner, ipfsUri, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const agents = [
        ethers.keccak256(ethers.toUtf8Bytes("agent-1")),
        ethers.keccak256(ethers.toUtf8Bytes("agent-2")),
      ];

      const hashes = [
        ethers.keccak256(ethers.toUtf8Bytes("trace-a")),
        ethers.keccak256(ethers.toUtf8Bytes("trace-b")),
      ];

      await agentAnchor.anchorTrace(hashes[0], ipfsUri, agents[0], granularity);
      await agentAnchor.anchorTrace(hashes[1], ipfsUri, agents[1], granularity);

      const traces = await agentAnchor.getTracesByCreator(owner.address);
      expect(traces).to.have.lengthOf(2);

      const count = await agentAnchor.getCreatorTraceCount(owner.address);
      expect(count).to.equal(2n);
    });

    it("should handle anchors from different creators", async function () {
      const { agentAnchor, user1, user2, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("trace-user1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("trace-user2"));

      await agentAnchor.connect(user1).anchorTrace(hash1, ipfsUri, agentId, granularity);
      await agentAnchor.connect(user2).anchorTrace(hash2, ipfsUri, agentId, granularity);

      const anchor1 = await agentAnchor.getAnchor(hash1);
      const anchor2 = await agentAnchor.getAnchor(hash2);

      expect(anchor1.creator).to.equal(user1.address);
      expect(anchor2.creator).to.equal(user2.address);

      // Both should be under same agent
      const agentTraces = await agentAnchor.getTracesByAgent(agentId);
      expect(agentTraces).to.have.lengthOf(2);
    });
  });

  describe("Gas Usage", function () {
    it("should use reasonable gas for anchoring", async function () {
      const { agentAnchor, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const tx = await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      const receipt = await tx.wait();

      // Should use less than 300k gas (includes string storage for IPFS URI)
      expect(receipt!.gasUsed).to.be.lt(300000n);
    });
  });
});
