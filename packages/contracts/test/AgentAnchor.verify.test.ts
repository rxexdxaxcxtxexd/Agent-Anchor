import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchor } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchor - Verify Tests", function () {
  async function deployWithAnchorFixture() {
    const [owner, user1] = await ethers.getSigners();

    const AgentAnchorFactory = await ethers.getContractFactory("AgentAnchor");
    const agentAnchor = await AgentAnchorFactory.deploy();

    const traceHash = ethers.keccak256(ethers.toUtf8Bytes("test-trace"));
    const ipfsUri = "ipfs://QmTestVerify123";
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("verify-agent"));
    const granularity = 1; // Task

    // Create an anchor
    await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);

    return { agentAnchor, owner, user1, traceHash, ipfsUri, agentId, granularity };
  }

  describe("verifyTrace", function () {
    it("should return true and data for existing anchor", async function () {
      const { agentAnchor, owner, traceHash, ipfsUri } =
        await loadFixture(deployWithAnchorFixture);

      const [exists, returnedUri, creator, timestamp] = await agentAnchor.verifyTrace(traceHash);

      expect(exists).to.be.true;
      expect(returnedUri).to.equal(ipfsUri);
      expect(creator).to.equal(owner.address);
      expect(timestamp).to.be.gt(0);
    });

    it("should return false for non-existent anchor", async function () {
      const { agentAnchor } = await loadFixture(deployWithAnchorFixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const [exists, ipfsUri, creator, timestamp] = await agentAnchor.verifyTrace(nonExistentHash);

      expect(exists).to.be.false;
      expect(ipfsUri).to.equal("");
      expect(creator).to.equal(ethers.ZeroAddress);
      expect(timestamp).to.equal(0);
    });
  });

  describe("anchorExists", function () {
    it("should return true for existing anchor", async function () {
      const { agentAnchor, traceHash } = await loadFixture(deployWithAnchorFixture);

      expect(await agentAnchor.anchorExists(traceHash)).to.be.true;
    });

    it("should return false for non-existent anchor", async function () {
      const { agentAnchor } = await loadFixture(deployWithAnchorFixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("missing"));
      expect(await agentAnchor.anchorExists(nonExistentHash)).to.be.false;
    });
  });

  describe("getAnchor", function () {
    it("should return full anchor data", async function () {
      const { agentAnchor, owner, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployWithAnchorFixture);

      const anchor = await agentAnchor.getAnchor(traceHash);

      expect(anchor.traceHash).to.equal(traceHash);
      expect(anchor.ipfsUri).to.equal(ipfsUri);
      expect(anchor.agentId).to.equal(agentId);
      expect(anchor.granularity).to.equal(granularity);
      expect(anchor.creator).to.equal(owner.address);
      expect(anchor.timestamp).to.be.gt(0);
      expect(anchor.blockNumber).to.be.gt(0);
    });

    it("should revert for non-existent anchor", async function () {
      const { agentAnchor } = await loadFixture(deployWithAnchorFixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("not-found"));

      await expect(agentAnchor.getAnchor(nonExistentHash))
        .to.be.revertedWithCustomError(agentAnchor, "AnchorNotFound")
        .withArgs(nonExistentHash);
    });
  });

  describe("Query Functions", function () {
    it("getTracesByAgent should return empty array for unknown agent", async function () {
      const { agentAnchor } = await loadFixture(deployWithAnchorFixture);

      const unknownAgent = ethers.keccak256(ethers.toUtf8Bytes("unknown-agent"));
      const traces = await agentAnchor.getTracesByAgent(unknownAgent);

      expect(traces).to.have.lengthOf(0);
    });

    it("getTracesByCreator should return empty array for unknown creator", async function () {
      const { agentAnchor, user1 } = await loadFixture(deployWithAnchorFixture);

      const traces = await agentAnchor.getTracesByCreator(user1.address);
      expect(traces).to.have.lengthOf(0);
    });

    it("getAgentTraceCount should return 0 for unknown agent", async function () {
      const { agentAnchor } = await loadFixture(deployWithAnchorFixture);

      const unknownAgent = ethers.keccak256(ethers.toUtf8Bytes("no-traces"));
      const count = await agentAnchor.getAgentTraceCount(unknownAgent);

      expect(count).to.equal(0);
    });

    it("getCreatorTraceCount should return 0 for unknown creator", async function () {
      const { agentAnchor, user1 } = await loadFixture(deployWithAnchorFixture);

      const count = await agentAnchor.getCreatorTraceCount(user1.address);
      expect(count).to.equal(0);
    });
  });

  describe("Public Mappings", function () {
    it("anchors mapping should return anchor data", async function () {
      const { agentAnchor, traceHash, ipfsUri } = await loadFixture(deployWithAnchorFixture);

      const anchor = await agentAnchor.anchors(traceHash);
      expect(anchor.ipfsUri).to.equal(ipfsUri);
    });

    it("totalAnchors should be accessible", async function () {
      const { agentAnchor } = await loadFixture(deployWithAnchorFixture);

      const total = await agentAnchor.totalAnchors();
      expect(total).to.equal(1);
    });
  });
});
