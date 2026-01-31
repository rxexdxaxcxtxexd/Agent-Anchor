import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchorV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchorV2 - Git Metadata (US2)", function () {
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

    // Git test data
    const commitSha = ethers.keccak256(ethers.toUtf8Bytes("abc123def456"));
    const branch = "main";
    const repository = "github.com/org/repo";

    return {
      agentAnchorV2,
      owner,
      user1,
      user2,
      traceHash,
      ipfsUri,
      agentId,
      granularity,
      commitSha,
      branch,
      repository,
    };
  }

  // Helper to create an anchor first
  async function deployWithAnchorFixture() {
    const fixture = await deployAgentAnchorV2Fixture();
    const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } = fixture;

    await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

    return fixture;
  }

  describe("T023: setGitMetadata stores commitSha", function () {
    it("should store commit SHA on-chain", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository);

      const [storedSha, hasMetadata] = await agentAnchorV2.getGitMetadata(traceHash);
      expect(storedSha).to.equal(commitSha);
      expect(hasMetadata).to.be.true;
    });

    it("should emit GitMetadataSet event", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository))
        .to.emit(agentAnchorV2, "GitMetadataSet")
        .withArgs(traceHash, commitSha, branch, repository);
    });

    it("should return true on success", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      const result = await agentAnchorV2.setGitMetadata.staticCall(
        traceHash,
        commitSha,
        branch,
        repository
      );
      expect(result).to.be.true;
    });
  });

  describe("T024: getGitMetadata returns stored values", function () {
    it("should return commitSha and hasMetadata=true after setting", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository);

      const [storedSha, hasMetadata] = await agentAnchorV2.getGitMetadata(traceHash);
      expect(storedSha).to.equal(commitSha);
      expect(hasMetadata).to.be.true;
    });

    it("should return zero and hasMetadata=false before setting", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const [storedSha, hasMetadata] = await agentAnchorV2.getGitMetadata(traceHash);
      expect(storedSha).to.equal(ethers.ZeroHash);
      expect(hasMetadata).to.be.false;
    });

    it("should allow updating git metadata", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      // Set initial
      await agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository);

      // Update with new commit
      const newCommitSha = ethers.keccak256(ethers.toUtf8Bytes("new-commit-789"));
      await agentAnchorV2.setGitMetadata(traceHash, newCommitSha, "feature/new", repository);

      const [storedSha, hasMetadata] = await agentAnchorV2.getGitMetadata(traceHash);
      expect(storedSha).to.equal(newCommitSha);
      expect(hasMetadata).to.be.true;
    });
  });

  describe("T025: Zero commitSha reverts with InvalidCommitSha", function () {
    it("should revert when commitSha is zero", async function () {
      const { agentAnchorV2, traceHash, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      await expect(
        agentAnchorV2.setGitMetadata(traceHash, ethers.ZeroHash, branch, repository)
      ).to.be.revertedWithCustomError(agentAnchorV2, "InvalidCommitSha");
    });
  });

  describe("T026: Extended git event includes branch and repo", function () {
    it("should include branch name in event", async function () {
      const { agentAnchorV2, traceHash, commitSha, repository } =
        await loadFixture(deployWithAnchorFixture);

      const branch = "feature/my-branch";

      await expect(agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository))
        .to.emit(agentAnchorV2, "GitMetadataSet")
        .withArgs(traceHash, commitSha, branch, repository);
    });

    it("should include repository in event", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch } =
        await loadFixture(deployWithAnchorFixture);

      const repository = "https://github.com/anthropics/agent-anchor";

      await expect(agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository))
        .to.emit(agentAnchorV2, "GitMetadataSet")
        .withArgs(traceHash, commitSha, branch, repository);
    });

    it("should allow empty branch and repository", async function () {
      const { agentAnchorV2, traceHash, commitSha } = await loadFixture(deployWithAnchorFixture);

      await expect(agentAnchorV2.setGitMetadata(traceHash, commitSha, "", ""))
        .to.emit(agentAnchorV2, "GitMetadataSet")
        .withArgs(traceHash, commitSha, "", "");

      const [storedSha, hasMetadata] = await agentAnchorV2.getGitMetadata(traceHash);
      expect(storedSha).to.equal(commitSha);
      expect(hasMetadata).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("should only allow trace creator to set git metadata", async function () {
      const { agentAnchorV2, user1, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      // user1 is not the creator (owner is)
      await expect(
        agentAnchorV2.connect(user1).setGitMetadata(traceHash, commitSha, branch, repository)
      ).to.be.revertedWithCustomError(agentAnchorV2, "NotTraceCreator");
    });

    it("should revert if trace does not exist", async function () {
      const { agentAnchorV2, commitSha, branch, repository } =
        await loadFixture(deployAgentAnchorV2Fixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        agentAnchorV2.setGitMetadata(nonExistentHash, commitSha, branch, repository)
      ).to.be.revertedWithCustomError(agentAnchorV2, "TraceNotFound");
    });
  });

  describe("Integration with getOwnershipRecord", function () {
    it("should include git metadata in ownership record", async function () {
      const { agentAnchorV2, traceHash, commitSha, branch, repository } =
        await loadFixture(deployWithAnchorFixture);

      await agentAnchorV2.setGitMetadata(traceHash, commitSha, branch, repository);

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.hasGitMetadata).to.be.true;
      expect(record.commitSha).to.equal(commitSha);
    });

    it("should show hasGitMetadata=false before setting", async function () {
      const { agentAnchorV2, traceHash } = await loadFixture(deployWithAnchorFixture);

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.hasGitMetadata).to.be.false;
      expect(record.commitSha).to.equal(ethers.ZeroHash);
    });
  });

  describe("Multiple traces with different git data", function () {
    it("should store different git metadata for different traces", async function () {
      const { agentAnchorV2, ipfsUri, agentId, granularity } =
        await loadFixture(deployWithAnchorFixture);

      // Create second trace
      const traceHash2 = ethers.keccak256(ethers.toUtf8Bytes("trace-2"));
      await agentAnchorV2.anchorTrace(traceHash2, ipfsUri, agentId, granularity);

      const commit1 = ethers.keccak256(ethers.toUtf8Bytes("commit-1"));
      const commit2 = ethers.keccak256(ethers.toUtf8Bytes("commit-2"));

      // Set git metadata for first trace (from fixture)
      const traceHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-trace-content"));
      await agentAnchorV2.setGitMetadata(traceHash1, commit1, "main", "repo1");
      await agentAnchorV2.setGitMetadata(traceHash2, commit2, "develop", "repo2");

      const [sha1] = await agentAnchorV2.getGitMetadata(traceHash1);
      const [sha2] = await agentAnchorV2.getGitMetadata(traceHash2);

      expect(sha1).to.equal(commit1);
      expect(sha2).to.equal(commit2);
    });
  });
});
