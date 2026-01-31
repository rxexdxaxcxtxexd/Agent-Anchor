import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchorV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchorV2 - Authorship (US3)", function () {
  // Declaration types
  const DeclarationType = {
    Individual: 0,
    Organization: 1,
    WorkForHire: 2,
  };

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

  describe("T035: declareAuthorship stores claim", function () {
    it("should store claimant address", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Individual);

      const [claimant, , , hasClaim] = await agentAnchorV2.getAuthorship(traceHash);
      expect(claimant).to.equal(owner.address);
      expect(hasClaim).to.be.true;
    });

    it("should store declaration type", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Organization);

      const [, declarationType] = await agentAnchorV2.getAuthorship(traceHash);
      expect(declarationType).to.equal(DeclarationType.Organization);
    });

    it("should store claim timestamp", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const tx = await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Individual);
      const block = await tx.getBlock();

      const [, , claimTimestamp] = await agentAnchorV2.getAuthorship(traceHash);
      expect(claimTimestamp).to.equal(block!.timestamp);
    });

    it("should return true on success", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const result = await agentAnchorV2.declareAuthorship.staticCall(
        traceHash,
        DeclarationType.Individual
      );
      expect(result).to.be.true;
    });

    it("should emit AuthorshipClaimed event", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.declareAuthorship(traceHash, DeclarationType.WorkForHire))
        .to.emit(agentAnchorV2, "AuthorshipClaimed")
        .withArgs(
          traceHash,
          owner.address,
          DeclarationType.WorkForHire,
          (timestamp: bigint) => timestamp > 0n
        );
    });
  });

  describe("T036: getAuthorship returns claimant and type", function () {
    it("should return all authorship data", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Organization);

      const [claimant, declarationType, claimTimestamp, hasClaim] =
        await agentAnchorV2.getAuthorship(traceHash);

      expect(claimant).to.equal(owner.address);
      expect(declarationType).to.equal(DeclarationType.Organization);
      expect(claimTimestamp).to.be.gt(0);
      expect(hasClaim).to.be.true;
    });

    it("should return hasClaim=false before declaring", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const [claimant, declarationType, claimTimestamp, hasClaim] =
        await agentAnchorV2.getAuthorship(traceHash);

      expect(claimant).to.equal(ethers.ZeroAddress);
      expect(declarationType).to.equal(0);
      expect(claimTimestamp).to.equal(0);
      expect(hasClaim).to.be.false;
    });
  });

  describe("T037: Duplicate claim reverts with AuthorshipAlreadyClaimed", function () {
    it("should revert when claiming twice", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Individual);

      await expect(agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Organization))
        .to.be.revertedWithCustomError(agentAnchorV2, "AuthorshipAlreadyClaimed")
        .withArgs(traceHash);
    });

    it("should revert even when same type is claimed again", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Individual);

      await expect(
        agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Individual)
      ).to.be.revertedWithCustomError(agentAnchorV2, "AuthorshipAlreadyClaimed");
    });
  });

  describe("T038: Only trace creator can declare (unless authorized)", function () {
    it("should only allow trace creator to declare", async function () {
      const { agentAnchorV2, user1, traceHash } = await loadFixture(deployWithAnchorFixture);

      // user1 is not the creator
      await expect(
        agentAnchorV2.connect(user1).declareAuthorship(traceHash, DeclarationType.Individual)
      ).to.be.revertedWithCustomError(agentAnchorV2, "NotTraceCreator");
    });

    it("should revert if trace does not exist", async function () {
      const { agentAnchorV2 } = await loadFixture(deployAgentAnchorV2Fixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        agentAnchorV2.declareAuthorship(nonExistentHash, DeclarationType.Individual)
      ).to.be.revertedWithCustomError(agentAnchorV2, "TraceNotFound");
    });
  });

  describe("Declaration Types", function () {
    it("should accept Individual type (0)", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Individual);

      const [, declarationType] = await agentAnchorV2.getAuthorship(traceHash);
      expect(declarationType).to.equal(0);
    });

    it("should accept Organization type (1)", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.Organization);

      const [, declarationType] = await agentAnchorV2.getAuthorship(traceHash);
      expect(declarationType).to.equal(1);
    });

    it("should accept WorkForHire type (2)", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.WorkForHire);

      const [, declarationType] = await agentAnchorV2.getAuthorship(traceHash);
      expect(declarationType).to.equal(2);
    });

    it("should revert for invalid type (3+)", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      // Solidity 0.8+ automatically reverts when converting out-of-range int to enum
      await expect(agentAnchorV2.declareAuthorship(traceHash, 3)).to.be.reverted;
    });
  });

  describe("Integration with getOwnershipRecord", function () {
    it("should include authorship in ownership record", async function () {
      const { agentAnchorV2, owner, traceHash } = await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.declareAuthorship(traceHash, DeclarationType.WorkForHire);

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.hasOwnership).to.be.true;
      expect(record.claimant).to.equal(owner.address);
      expect(record.declarationType).to.equal(DeclarationType.WorkForHire);
    });

    it("should show hasOwnership=false before declaring", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.hasOwnership).to.be.false;
      expect(record.claimant).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Multiple traces with different authorship", function () {
    it("should store different authorship for different traces", async function () {
      const { agentAnchorV2, owner, ipfsUri, agentId, granularity } =
        await loadFixture(deployWithAnchorFixture);

      const traceHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-trace-content"));
      const traceHash2 = ethers.keccak256(ethers.toUtf8Bytes("trace-2"));

      await agentAnchorV2.anchorTrace(traceHash2, ipfsUri, agentId, granularity);

      await agentAnchorV2.declareAuthorship(traceHash1, DeclarationType.Individual);
      await agentAnchorV2.declareAuthorship(traceHash2, DeclarationType.Organization);

      const [, type1] = await agentAnchorV2.getAuthorship(traceHash1);
      const [, type2] = await agentAnchorV2.getAuthorship(traceHash2);

      expect(type1).to.equal(DeclarationType.Individual);
      expect(type2).to.equal(DeclarationType.Organization);
    });
  });
});
