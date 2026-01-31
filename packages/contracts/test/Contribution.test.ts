import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchorV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchorV2 - Contribution (US4)", function () {
  // Test fixtures
  async function deployAgentAnchorV2Fixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const AgentAnchorV2Factory = await ethers.getContractFactory("AgentAnchorV2");
    const agentAnchorV2 = await AgentAnchorV2Factory.deploy();

    const traceHash = ethers.keccak256(ethers.toUtf8Bytes("test-trace-content"));
    const ipfsUri = "ipfs://QmTest123456789";
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-001"));
    const granularity = 0;

    return { agentAnchorV2, owner, user1, user2, traceHash, ipfsUri, agentId, granularity };
  }

  async function deployWithAnchorFixture() {
    const fixture = await deployAgentAnchorV2Fixture();
    const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } = fixture;

    await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

    return fixture;
  }

  describe("T046: setContribution stores percentages", function () {
    it("should store human and AI percentages", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setContribution(traceHash, 70, 30, "");

      const [humanPercent, aiPercent, hasContribution] =
        await agentAnchorV2.getContribution(traceHash);

      expect(humanPercent).to.equal(70);
      expect(aiPercent).to.equal(30);
      expect(hasContribution).to.be.true;
    });

    it("should emit ContributionSet event", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setContribution(traceHash, 80, 20, "Designed architecture"))
        .to.emit(agentAnchorV2, "ContributionSet")
        .withArgs(traceHash, 80, 20, "Designed architecture");
    });

    it("should return true on success", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const result = await agentAnchorV2.setContribution.staticCall(traceHash, 50, 50, "");
      expect(result).to.be.true;
    });
  });

  describe("T047: getContribution returns human/ai split", function () {
    it("should return correct percentages", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setContribution(traceHash, 60, 40, "");

      const [humanPercent, aiPercent, hasContribution] =
        await agentAnchorV2.getContribution(traceHash);

      expect(humanPercent).to.equal(60);
      expect(aiPercent).to.equal(40);
      expect(hasContribution).to.be.true;
    });

    it("should return hasContribution=false before setting", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const [humanPercent, aiPercent, hasContribution] =
        await agentAnchorV2.getContribution(traceHash);

      expect(humanPercent).to.equal(0);
      expect(aiPercent).to.equal(0);
      expect(hasContribution).to.be.false;
    });
  });

  describe("T048: Percentages not summing to 100 reverts", function () {
    it("should revert when sum is less than 100", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setContribution(traceHash, 30, 30, ""))
        .to.be.revertedWithCustomError(agentAnchorV2, "ContributionMustSumTo100")
        .withArgs(30, 30);
    });

    it("should revert when sum is greater than 100", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setContribution(traceHash, 60, 60, ""))
        .to.be.revertedWithCustomError(agentAnchorV2, "ContributionMustSumTo100")
        .withArgs(60, 60);
    });

    it("should revert when humanPercent > 100", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setContribution(traceHash, 101, 0, ""))
        .to.be.revertedWithCustomError(agentAnchorV2, "InvalidContributionRatio")
        .withArgs(101);
    });

    it("should revert when aiPercent > 100", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setContribution(traceHash, 0, 101, ""))
        .to.be.revertedWithCustomError(agentAnchorV2, "InvalidContributionRatio")
        .withArgs(101);
    });
  });

  describe("T049: 0% human (fully AI) is valid", function () {
    it("should accept 0% human, 100% AI", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setContribution(traceHash, 0, 100, "Fully AI generated");

      const [humanPercent, aiPercent, hasContribution] =
        await agentAnchorV2.getContribution(traceHash);

      expect(humanPercent).to.equal(0);
      expect(aiPercent).to.equal(100);
      expect(hasContribution).to.be.true;
    });

    it("should accept 100% human, 0% AI", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setContribution(traceHash, 100, 0, "Fully human written");

      const [humanPercent, aiPercent, hasContribution] =
        await agentAnchorV2.getContribution(traceHash);

      expect(humanPercent).to.equal(100);
      expect(aiPercent).to.equal(0);
      expect(hasContribution).to.be.true;
    });
  });

  describe("T050: Update contribution emits new event", function () {
    it("should allow updating contribution ratio", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      // Set initial
      await agentAnchorV2.setContribution(traceHash, 70, 30, "Initial estimate");

      // Update
      await expect(agentAnchorV2.setContribution(traceHash, 50, 50, "Revised estimate"))
        .to.emit(agentAnchorV2, "ContributionSet")
        .withArgs(traceHash, 50, 50, "Revised estimate");

      const [humanPercent, aiPercent] = await agentAnchorV2.getContribution(traceHash);
      expect(humanPercent).to.equal(50);
      expect(aiPercent).to.equal(50);
    });
  });

  describe("Access Control", function () {
    it("should only allow trace creator to set contribution", async function () {
      const { agentAnchorV2, user1, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(
        agentAnchorV2.connect(user1).setContribution(traceHash, 70, 30, "")
      ).to.be.revertedWithCustomError(agentAnchorV2, "NotTraceCreator");
    });

    it("should revert if trace does not exist", async function () {
      const { agentAnchorV2 } = await loadFixture(deployAgentAnchorV2Fixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        agentAnchorV2.setContribution(nonExistentHash, 70, 30, "")
      ).to.be.revertedWithCustomError(agentAnchorV2, "TraceNotFound");
    });
  });

  describe("Integration with getOwnershipRecord", function () {
    it("should include contribution in ownership record", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setContribution(traceHash, 75, 25, "");

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.humanPercent).to.equal(75);
      expect(record.aiPercent).to.equal(25);
    });
  });

  describe("Notes field", function () {
    it("should accept empty notes", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setContribution(traceHash, 50, 50, "")).to.not.be.reverted;
    });

    it("should emit notes in event", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const notes = "Based on line count analysis: 750 lines human, 250 lines AI";

      await expect(agentAnchorV2.setContribution(traceHash, 75, 25, notes))
        .to.emit(agentAnchorV2, "ContributionSet")
        .withArgs(traceHash, 75, 25, notes);
    });

    it("should accept long notes", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const longNotes = "A".repeat(500);

      await expect(agentAnchorV2.setContribution(traceHash, 50, 50, longNotes)).to.not.be.reverted;
    });
  });
});
