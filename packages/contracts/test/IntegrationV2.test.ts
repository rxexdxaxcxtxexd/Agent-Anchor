import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchorV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchorV2 - Integration Tests (Phase 6)", function () {
  // Test fixtures
  async function deployAgentAnchorV2Fixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const AgentAnchorV2Factory = await ethers.getContractFactory("AgentAnchorV2");
    const agentAnchorV2 = await AgentAnchorV2Factory.deploy();

    const traceHash = ethers.keccak256(ethers.toUtf8Bytes("integration-test-trace"));
    const ipfsUri = "ipfs://QmIntegrationTest123456789";
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-integration"));
    const granularity = 0;

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const contractAddress = await agentAnchorV2.getAddress();

    return {
      agentAnchorV2,
      owner,
      user1,
      user2,
      traceHash,
      ipfsUri,
      agentId,
      granularity,
      chainId,
      contractAddress,
    };
  }

  async function deployWithAnchorFixture() {
    const fixture = await deployAgentAnchorV2Fixture();
    const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } = fixture;

    await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

    return fixture;
  }

  // Helper to create EIP-712 signature
  async function createIdentitySignature(
    signer: SignerWithAddress,
    traceHash: string,
    timestamp: bigint,
    chainId: bigint,
    contractAddress: string
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
      traceHash,
      initiator: signer.address,
      timestamp,
      purpose: "code-authorship",
    };

    return await signer.signTypedData(domain, types, value);
  }

  describe("T058: anchorTraceV2() with all optional ownership data", function () {
    it("should anchor trace and set all ownership data in sequence", async function () {
      const { agentAnchorV2, owner, traceHash, ipfsUri, agentId, granularity, chainId, contractAddress } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Step 1: Anchor trace
      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      // Step 2: Get anchor timestamp for signature
      const anchor = await agentAnchorV2.getAnchor(traceHash);
      const timestamp = anchor.timestamp;

      // Step 3: Bind identity
      const signature = await createIdentitySignature(
        owner,
        traceHash,
        timestamp,
        chainId,
        contractAddress
      );
      await agentAnchorV2.bindIdentity(traceHash, signature);

      // Step 4: Set git metadata
      const commitSha = ethers.keccak256(ethers.toUtf8Bytes("abc123commit"));
      await agentAnchorV2.setGitMetadata(traceHash, commitSha, "main", "org/repo");

      // Step 5: Declare authorship
      await agentAnchorV2.declareAuthorship(traceHash, 0); // SoleAuthorship

      // Step 6: Set contribution
      await agentAnchorV2.setContribution(traceHash, 70, 30, "Designed architecture");

      // Verify all data is set
      const record = await agentAnchorV2.getOwnershipRecord(traceHash);

      expect(record.traceHash).to.equal(traceHash);
      expect(record.creator).to.equal(owner.address);
      expect(record.hasIdentity).to.be.true;
      expect(record.identitySigner).to.equal(owner.address);
      expect(record.hasGitMetadata).to.be.true;
      expect(record.commitSha).to.equal(commitSha);
      expect(record.hasOwnership).to.be.true;
      expect(record.claimant).to.equal(owner.address);
      expect(record.declarationType).to.equal(0); // SoleAuthorship
      expect(record.humanPercent).to.equal(70);
      expect(record.aiPercent).to.equal(30);
    });

    it("should allow partial ownership data", async function () {
      const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Only anchor and set contribution
      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      await agentAnchorV2.setContribution(traceHash, 50, 50, "");

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);

      expect(record.hasIdentity).to.be.false;
      expect(record.hasGitMetadata).to.be.false;
      expect(record.hasOwnership).to.be.false;
      expect(record.humanPercent).to.equal(50);
      expect(record.aiPercent).to.equal(50);
    });

    it("should emit all relevant events", async function () {
      const { agentAnchorV2, owner, traceHash, ipfsUri, agentId, granularity, chainId, contractAddress } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Anchor
      await expect(agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity))
        .to.emit(agentAnchorV2, "TraceAnchored");

      // Get timestamp and bind identity
      const anchor = await agentAnchorV2.getAnchor(traceHash);
      const signature = await createIdentitySignature(
        owner,
        traceHash,
        anchor.timestamp,
        chainId,
        contractAddress
      );
      await expect(agentAnchorV2.bindIdentity(traceHash, signature))
        .to.emit(agentAnchorV2, "IdentityBound");

      // Git metadata
      const commitSha = ethers.keccak256(ethers.toUtf8Bytes("commit"));
      await expect(agentAnchorV2.setGitMetadata(traceHash, commitSha, "main", ""))
        .to.emit(agentAnchorV2, "GitMetadataSet");

      // Authorship
      await expect(agentAnchorV2.declareAuthorship(traceHash, 1))
        .to.emit(agentAnchorV2, "AuthorshipClaimed");

      // Contribution
      await expect(agentAnchorV2.setContribution(traceHash, 80, 20, "Notes"))
        .to.emit(agentAnchorV2, "ContributionSet");
    });
  });

  describe("T059: getOwnershipRecord() returns combined view struct", function () {
    it("should return empty record for non-existent trace", async function () {
      const { agentAnchorV2 } = await loadFixture(deployAgentAnchorV2Fixture);

      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const record = await agentAnchorV2.getOwnershipRecord(nonExistentHash);

      expect(record.creator).to.equal(ethers.ZeroAddress);
      expect(record.anchorTimestamp).to.equal(0);
      expect(record.hasIdentity).to.be.false;
      expect(record.hasOwnership).to.be.false;
      expect(record.hasGitMetadata).to.be.false;
    });

    it("should return complete record with all ownership data", async function () {
      const { agentAnchorV2, owner, traceHash, ipfsUri, agentId, granularity, chainId, contractAddress } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Setup complete ownership
      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      const anchor = await agentAnchorV2.getAnchor(traceHash);
      const signature = await createIdentitySignature(
        owner,
        traceHash,
        anchor.timestamp,
        chainId,
        contractAddress
      );

      await agentAnchorV2.bindIdentity(traceHash, signature);

      const commitSha = ethers.keccak256(ethers.toUtf8Bytes("full-commit"));
      await agentAnchorV2.setGitMetadata(traceHash, commitSha, "develop", "org/repo");
      await agentAnchorV2.declareAuthorship(traceHash, 2); // CoAuthorship
      await agentAnchorV2.setContribution(traceHash, 40, 60, "");

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);

      expect(record.traceHash).to.equal(traceHash);
      expect(record.creator).to.equal(owner.address);
      expect(record.anchorTimestamp).to.be.gt(0);
      expect(record.identitySigner).to.equal(owner.address);
      expect(record.identityVerified).to.be.true;
      expect(record.claimant).to.equal(owner.address);
      expect(record.declarationType).to.equal(2);
      expect(record.humanPercent).to.equal(40);
      expect(record.aiPercent).to.equal(60);
      expect(record.commitSha).to.equal(commitSha);
      expect(record.hasIdentity).to.be.true;
      expect(record.hasOwnership).to.be.true;
      expect(record.hasGitMetadata).to.be.true;
    });

    it("should correctly reflect partial ownership state", async function () {
      const { agentAnchorV2, owner, traceHash, ipfsUri, agentId, granularity, chainId, contractAddress } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Only anchor and identity
      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      const anchor = await agentAnchorV2.getAnchor(traceHash);
      const signature = await createIdentitySignature(
        owner,
        traceHash,
        anchor.timestamp,
        chainId,
        contractAddress
      );
      await agentAnchorV2.bindIdentity(traceHash, signature);

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);

      expect(record.hasIdentity).to.be.true;
      expect(record.hasOwnership).to.be.false;
      expect(record.hasGitMetadata).to.be.false;
      expect(record.humanPercent).to.equal(0);
      expect(record.aiPercent).to.equal(0);
    });
  });

  describe("T061: Full flow from trace creation to ownership verification", function () {
    it("should complete full E2E flow", async function () {
      const { agentAnchorV2, owner, agentId, granularity, chainId, contractAddress } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Create a unique trace
      const traceContent = "E2E test trace content " + Date.now();
      const traceHash = ethers.keccak256(ethers.toUtf8Bytes(traceContent));
      const ipfsUri = "ipfs://QmE2ETest" + Date.now();

      // Step 1: Anchor trace
      const anchorTx = await agentAnchorV2.anchorTrace(
        traceHash,
        ipfsUri,
        agentId,
        granularity
      );
      await anchorTx.wait();

      // Verify anchor exists
      const anchorExists = await agentAnchorV2.anchorExists(traceHash);
      expect(anchorExists).to.be.true;

      // Step 2: Verify trace
      const [exists, storedIpfsUri, creator, timestamp] = await agentAnchorV2.verifyTrace(traceHash);
      expect(exists).to.be.true;
      expect(storedIpfsUri).to.equal(ipfsUri);
      expect(creator).to.equal(owner.address);
      expect(timestamp).to.be.gt(0);

      // Step 3: Bind identity with signature
      const anchor = await agentAnchorV2.getAnchor(traceHash);
      const signature = await createIdentitySignature(
        owner,
        traceHash,
        anchor.timestamp,
        chainId,
        contractAddress
      );

      await agentAnchorV2.bindIdentity(traceHash, signature);

      // Verify identity
      const [identityVerified, identitySigner] = await agentAnchorV2.verifyIdentity(traceHash);
      expect(identityVerified).to.be.true;
      expect(identitySigner).to.equal(owner.address);

      // Step 4: Set git metadata
      const commitSha = ethers.keccak256(ethers.toUtf8Bytes("e2e-commit-sha"));
      await agentAnchorV2.setGitMetadata(traceHash, commitSha, "feature/e2e", "org/e2e-repo");

      // Verify git metadata
      const [storedCommitSha, hasGitMetadata] = await agentAnchorV2.getGitMetadata(traceHash);
      expect(storedCommitSha).to.equal(commitSha);
      expect(hasGitMetadata).to.be.true;

      // Step 5: Declare authorship
      await agentAnchorV2.declareAuthorship(traceHash, 0); // SoleAuthorship

      // Verify authorship
      const [claimant, declarationType, claimTimestamp, hasClaim] =
        await agentAnchorV2.getAuthorship(traceHash);
      expect(claimant).to.equal(owner.address);
      expect(declarationType).to.equal(0);
      expect(claimTimestamp).to.be.gt(0);
      expect(hasClaim).to.be.true;

      // Step 6: Set contribution
      await agentAnchorV2.setContribution(traceHash, 75, 25, "E2E test contribution");

      // Verify contribution
      const [humanPercent, aiPercent, hasContribution] =
        await agentAnchorV2.getContribution(traceHash);
      expect(humanPercent).to.equal(75);
      expect(aiPercent).to.equal(25);
      expect(hasContribution).to.be.true;

      // Step 7: Get complete ownership record
      const record = await agentAnchorV2.getOwnershipRecord(traceHash);

      // Verify complete record
      expect(record.traceHash).to.equal(traceHash);
      expect(record.creator).to.equal(owner.address);
      expect(record.anchorTimestamp).to.equal(timestamp);
      expect(record.identitySigner).to.equal(owner.address);
      expect(record.identityVerified).to.be.true;
      expect(record.claimant).to.equal(owner.address);
      expect(record.declarationType).to.equal(0);
      expect(record.humanPercent).to.equal(75);
      expect(record.aiPercent).to.equal(25);
      expect(record.commitSha).to.equal(commitSha);
      expect(record.hasIdentity).to.be.true;
      expect(record.hasOwnership).to.be.true;
      expect(record.hasGitMetadata).to.be.true;
    });

    it("should track multiple traces for the same agent", async function () {
      const { agentAnchorV2, owner, agentId, granularity } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Create multiple traces for same agent
      const traces = [];
      for (let i = 0; i < 3; i++) {
        const traceHash = ethers.keccak256(ethers.toUtf8Bytes(`multi-trace-${i}`));
        const ipfsUri = `ipfs://QmMulti${i}`;

        await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);
        traces.push(traceHash);
      }

      // Verify all traces are tracked
      const agentTraces = await agentAnchorV2.getTracesByAgent(agentId);
      expect(agentTraces.length).to.equal(3);

      for (const traceHash of traces) {
        expect(agentTraces).to.include(traceHash);
      }

      // Set contribution for each trace
      for (let i = 0; i < traces.length; i++) {
        const humanPercent = 50 + i * 10; // 50, 60, 70
        await agentAnchorV2.setContribution(
          traces[i],
          humanPercent,
          100 - humanPercent,
          `Trace ${i}`
        );
      }

      // Verify each trace has correct contribution
      for (let i = 0; i < traces.length; i++) {
        const [humanPercent] = await agentAnchorV2.getContribution(traces[i]);
        expect(humanPercent).to.equal(50 + i * 10);
      }
    });

    it("should track multiple traces for the same creator", async function () {
      const { agentAnchorV2, owner, granularity } = await loadFixture(deployAgentAnchorV2Fixture);

      // Create traces with different agents but same creator
      const traces = [];
      for (let i = 0; i < 3; i++) {
        const traceHash = ethers.keccak256(ethers.toUtf8Bytes(`creator-trace-${i}`));
        const ipfsUri = `ipfs://QmCreator${i}`;
        const agentId = ethers.keccak256(ethers.toUtf8Bytes(`agent-${i}`));

        await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);
        traces.push(traceHash);
      }

      // Verify all traces are tracked for creator
      const creatorTraces = await agentAnchorV2.getTracesByCreator(owner.address);
      expect(creatorTraces.length).to.equal(3);

      for (const traceHash of traces) {
        expect(creatorTraces).to.include(traceHash);
      }
    });
  });

  describe("Access control across ownership operations", function () {
    it("should enforce creator-only for all ownership operations", async function () {
      const { agentAnchorV2, owner, user1, traceHash, ipfsUri, agentId, granularity, chainId, contractAddress } =
        await loadFixture(deployAgentAnchorV2Fixture);

      // Owner anchors trace
      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);

      // User1 cannot set git metadata
      const commitSha = ethers.keccak256(ethers.toUtf8Bytes("commit"));
      await expect(
        agentAnchorV2.connect(user1).setGitMetadata(traceHash, commitSha, "", "")
      ).to.be.revertedWithCustomError(agentAnchorV2, "NotTraceCreator");

      // User1 cannot declare authorship
      await expect(
        agentAnchorV2.connect(user1).declareAuthorship(traceHash, 0)
      ).to.be.revertedWithCustomError(agentAnchorV2, "NotTraceCreator");

      // User1 cannot set contribution
      await expect(
        agentAnchorV2.connect(user1).setContribution(traceHash, 50, 50, "")
      ).to.be.revertedWithCustomError(agentAnchorV2, "NotTraceCreator");
    });
  });

  describe("Edge cases and boundary conditions", function () {
    it("should handle 100% human contribution", async function () {
      const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorV2Fixture);

      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      await agentAnchorV2.setContribution(traceHash, 100, 0, "Fully human");

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.humanPercent).to.equal(100);
      expect(record.aiPercent).to.equal(0);
    });

    it("should handle 100% AI contribution", async function () {
      const { agentAnchorV2, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorV2Fixture);

      await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      await agentAnchorV2.setContribution(traceHash, 0, 100, "Fully AI");

      const record = await agentAnchorV2.getOwnershipRecord(traceHash);
      expect(record.humanPercent).to.equal(0);
      expect(record.aiPercent).to.equal(100);
    });

    it("should handle all declaration types", async function () {
      const { agentAnchorV2, granularity, ipfsUri, agentId } =
        await loadFixture(deployAgentAnchorV2Fixture);

      const declarationTypes = [0, 1, 2]; // SoleAuthorship, JointAuthorship, CoAuthorship

      for (const declType of declarationTypes) {
        const traceHash = ethers.keccak256(ethers.toUtf8Bytes(`decl-type-${declType}`));
        await agentAnchorV2.anchorTrace(traceHash, ipfsUri, agentId, granularity);
        await agentAnchorV2.declareAuthorship(traceHash, declType);

        const record = await agentAnchorV2.getOwnershipRecord(traceHash);
        expect(record.declarationType).to.equal(declType);
      }
    });
  });
});
