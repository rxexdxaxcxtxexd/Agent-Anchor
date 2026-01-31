import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchor } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentAnchor - Security Tests", function () {
  async function deployAgentAnchorFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    const AgentAnchorFactory = await ethers.getContractFactory("AgentAnchor");
    const agentAnchor = await AgentAnchorFactory.deploy();

    const traceHash = ethers.keccak256(ethers.toUtf8Bytes("test-trace-content"));
    const ipfsUri = "ipfs://QmTest123456789";
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-001"));
    const granularity = 0;

    return { agentAnchor, owner, user1, user2, user3, traceHash, ipfsUri, agentId, granularity };
  }

  describe("SEC-001: IPFS URI Length Limit", function () {
    it("should accept URI at maximum length (256 bytes)", async function () {
      const { agentAnchor, traceHash, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      // Create a 256-byte URI (ipfs:// = 7 chars + 249 chars)
      const maxUri = "ipfs://Qm" + "x".repeat(247);
      expect(maxUri.length).to.equal(256);

      await expect(agentAnchor.anchorTrace(traceHash, maxUri, agentId, granularity)).to.not.be
        .reverted;
    });

    it("should reject URI exceeding maximum length (257 bytes)", async function () {
      const { agentAnchor, traceHash, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const tooLongUri = "ipfs://Qm" + "x".repeat(248); // 257 bytes
      expect(tooLongUri.length).to.equal(257);

      await expect(agentAnchor.anchorTrace(traceHash, tooLongUri, agentId, granularity))
        .to.be.revertedWithCustomError(agentAnchor, "IpfsUriTooLong")
        .withArgs(257, 256);
    });

    it("should reject very long URI", async function () {
      const { agentAnchor, traceHash, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const veryLongUri = "ipfs://Qm" + "x".repeat(1000);

      await expect(agentAnchor.anchorTrace(traceHash, veryLongUri, agentId, granularity))
        .to.be.revertedWithCustomError(agentAnchor, "IpfsUriTooLong");
    });

    it("should expose MAX_IPFS_URI_LENGTH constant", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      const maxLength = await agentAnchor.MAX_IPFS_URI_LENGTH();
      expect(maxLength).to.equal(256n);
    });
  });

  describe("SEC-002: Pagination Functions", function () {
    async function deployWithManyAnchors() {
      const { agentAnchor, owner, user1, agentId, granularity, ...rest } =
        await loadFixture(deployAgentAnchorFixture);

      // Create 25 anchors
      const hashes: string[] = [];
      for (let i = 0; i < 25; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`trace-${i}`));
        hashes.push(hash);
        await agentAnchor.anchorTrace(hash, `ipfs://Qm${i}`, agentId, granularity);
      }

      return { agentAnchor, owner, user1, agentId, granularity, hashes, ...rest };
    }

    describe("getTracesByAgentPaginated", function () {
      it("should return first page correctly", async function () {
        const { agentAnchor, agentId, hashes } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByAgentPaginated(agentId, 0, 10);

        expect(traces).to.have.lengthOf(10);
        expect(total).to.equal(25n);
        expect(traces[0]).to.equal(hashes[0]);
        expect(traces[9]).to.equal(hashes[9]);
      });

      it("should return middle page correctly", async function () {
        const { agentAnchor, agentId, hashes } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByAgentPaginated(agentId, 10, 10);

        expect(traces).to.have.lengthOf(10);
        expect(total).to.equal(25n);
        expect(traces[0]).to.equal(hashes[10]);
      });

      it("should return partial last page correctly", async function () {
        const { agentAnchor, agentId, hashes } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByAgentPaginated(agentId, 20, 10);

        expect(traces).to.have.lengthOf(5); // Only 5 remaining
        expect(total).to.equal(25n);
        expect(traces[4]).to.equal(hashes[24]);
      });

      it("should return empty array for offset beyond total", async function () {
        const { agentAnchor, agentId } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByAgentPaginated(agentId, 100, 10);

        expect(traces).to.have.lengthOf(0);
        expect(total).to.equal(25n);
      });

      it("should return empty for non-existent agent", async function () {
        const { agentAnchor } = await deployWithManyAnchors();
        const nonExistentAgent = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

        const [traces, total] = await agentAnchor.getTracesByAgentPaginated(nonExistentAgent, 0, 10);

        expect(traces).to.have.lengthOf(0);
        expect(total).to.equal(0n);
      });
    });

    describe("getTracesByCreatorPaginated", function () {
      it("should return paginated results for creator", async function () {
        const { agentAnchor, owner } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByCreatorPaginated(owner.address, 0, 10);

        expect(traces).to.have.lengthOf(10);
        expect(total).to.equal(25n);
      });

      it("should handle offset correctly", async function () {
        const { agentAnchor, owner, hashes } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByCreatorPaginated(
          owner.address,
          5,
          5
        );

        expect(traces).to.have.lengthOf(5);
        expect(total).to.equal(25n);
        expect(traces[0]).to.equal(hashes[5]);
      });

      it("should return empty for non-existent creator", async function () {
        const { agentAnchor, user1 } = await deployWithManyAnchors();

        const [traces, total] = await agentAnchor.getTracesByCreatorPaginated(
          user1.address,
          0,
          10
        );

        expect(traces).to.have.lengthOf(0);
        expect(total).to.equal(0n);
      });
    });
  });

  describe("SEC-003: Optional Allowlist", function () {
    it("should default to permissionless mode", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      expect(await agentAnchor.permissionless()).to.be.true;
    });

    it("should allow anyone to anchor in permissionless mode", async function () {
      const { agentAnchor, user1, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const hash = ethers.keccak256(ethers.toUtf8Bytes("user1-trace"));

      await expect(agentAnchor.connect(user1).anchorTrace(hash, ipfsUri, agentId, granularity)).to
        .not.be.reverted;
    });

    describe("Restricted mode", function () {
      it("should allow owner to disable permissionless mode", async function () {
        const { agentAnchor, owner } = await loadFixture(deployAgentAnchorFixture);

        await expect(agentAnchor.connect(owner).setPermissionless(false))
          .to.emit(agentAnchor, "PermissionlessChanged")
          .withArgs(false);

        expect(await agentAnchor.permissionless()).to.be.false;
      });

      it("should reject non-allowlisted users in restricted mode", async function () {
        const { agentAnchor, owner, user1, ipfsUri, agentId, granularity } =
          await loadFixture(deployAgentAnchorFixture);

        await agentAnchor.connect(owner).setPermissionless(false);

        const hash = ethers.keccak256(ethers.toUtf8Bytes("user1-trace"));

        await expect(
          agentAnchor.connect(user1).anchorTrace(hash, ipfsUri, agentId, granularity)
        )
          .to.be.revertedWithCustomError(agentAnchor, "NotAllowed")
          .withArgs(user1.address);
      });

      it("should allow allowlisted users in restricted mode", async function () {
        const { agentAnchor, owner, user1, ipfsUri, agentId, granularity } =
          await loadFixture(deployAgentAnchorFixture);

        await agentAnchor.connect(owner).setPermissionless(false);
        await agentAnchor.connect(owner).setAllowlist(user1.address, true);

        const hash = ethers.keccak256(ethers.toUtf8Bytes("user1-trace"));

        await expect(agentAnchor.connect(user1).anchorTrace(hash, ipfsUri, agentId, granularity)).to
          .not.be.reverted;
      });

      it("should emit AllowlistUpdated event", async function () {
        const { agentAnchor, owner, user1 } = await loadFixture(deployAgentAnchorFixture);

        await expect(agentAnchor.connect(owner).setAllowlist(user1.address, true))
          .to.emit(agentAnchor, "AllowlistUpdated")
          .withArgs(user1.address, true);
      });

      it("should allow batch allowlist updates", async function () {
        const { agentAnchor, owner, user1, user2, user3 } =
          await loadFixture(deployAgentAnchorFixture);

        await agentAnchor.connect(owner).setPermissionless(false);

        const tx = await agentAnchor
          .connect(owner)
          .setAllowlistBatch([user1.address, user2.address, user3.address], true);

        await expect(tx)
          .to.emit(agentAnchor, "AllowlistUpdated")
          .withArgs(user1.address, true);
        await expect(tx)
          .to.emit(agentAnchor, "AllowlistUpdated")
          .withArgs(user2.address, true);
        await expect(tx)
          .to.emit(agentAnchor, "AllowlistUpdated")
          .withArgs(user3.address, true);

        expect(await agentAnchor.allowlist(user1.address)).to.be.true;
        expect(await agentAnchor.allowlist(user2.address)).to.be.true;
        expect(await agentAnchor.allowlist(user3.address)).to.be.true;
      });

      it("should allow removing from allowlist", async function () {
        const { agentAnchor, owner, user1, ipfsUri, agentId, granularity } =
          await loadFixture(deployAgentAnchorFixture);

        await agentAnchor.connect(owner).setPermissionless(false);
        await agentAnchor.connect(owner).setAllowlist(user1.address, true);
        await agentAnchor.connect(owner).setAllowlist(user1.address, false);

        const hash = ethers.keccak256(ethers.toUtf8Bytes("user1-trace"));

        await expect(
          agentAnchor.connect(user1).anchorTrace(hash, ipfsUri, agentId, granularity)
        ).to.be.revertedWithCustomError(agentAnchor, "NotAllowed");
      });
    });

    describe("Access control", function () {
      it("should only allow owner to change permissionless", async function () {
        const { agentAnchor, user1 } = await loadFixture(deployAgentAnchorFixture);

        await expect(
          agentAnchor.connect(user1).setPermissionless(false)
        ).to.be.revertedWithCustomError(agentAnchor, "OwnableUnauthorizedAccount");
      });

      it("should only allow owner to update allowlist", async function () {
        const { agentAnchor, user1, user2 } = await loadFixture(deployAgentAnchorFixture);

        await expect(
          agentAnchor.connect(user1).setAllowlist(user2.address, true)
        ).to.be.revertedWithCustomError(agentAnchor, "OwnableUnauthorizedAccount");
      });

      it("should only allow owner to batch update allowlist", async function () {
        const { agentAnchor, user1, user2, user3 } = await loadFixture(deployAgentAnchorFixture);

        await expect(
          agentAnchor.connect(user1).setAllowlistBatch([user2.address, user3.address], true)
        ).to.be.revertedWithCustomError(agentAnchor, "OwnableUnauthorizedAccount");
      });

      it("should allow owner to re-enable permissionless mode", async function () {
        const { agentAnchor, owner, user1, ipfsUri, agentId, granularity } =
          await loadFixture(deployAgentAnchorFixture);

        await agentAnchor.connect(owner).setPermissionless(false);
        await agentAnchor.connect(owner).setPermissionless(true);

        const hash = ethers.keccak256(ethers.toUtf8Bytes("user1-trace"));

        // Non-allowlisted user should be able to anchor again
        await expect(agentAnchor.connect(user1).anchorTrace(hash, ipfsUri, agentId, granularity)).to
          .not.be.reverted;
      });
    });
  });

  describe("Gas impact of security changes", function () {
    it("should have acceptable gas overhead for security checks", async function () {
      const { agentAnchor, traceHash, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      const tx = await agentAnchor.anchorTrace(traceHash, ipfsUri, agentId, granularity);
      const receipt = await tx.wait();

      // Gas should still be under 300k even with security checks
      expect(receipt!.gasUsed).to.be.lt(300000n);
    });

    it("should have minimal overhead in restricted mode", async function () {
      const { agentAnchor, owner, user1, ipfsUri, agentId, granularity } =
        await loadFixture(deployAgentAnchorFixture);

      // Enable restricted mode and allowlist user
      await agentAnchor.connect(owner).setPermissionless(false);
      await agentAnchor.connect(owner).setAllowlist(user1.address, true);

      const hash = ethers.keccak256(ethers.toUtf8Bytes("restricted-trace"));

      const tx = await agentAnchor.connect(user1).anchorTrace(hash, ipfsUri, agentId, granularity);
      const receipt = await tx.wait();

      // Additional storage read should add ~2,100 gas, keeping total under 305k
      expect(receipt!.gasUsed).to.be.lt(305000n);
    });
  });
});
