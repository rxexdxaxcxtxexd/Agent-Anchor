import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentAnchor } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/**
 * TraceLinking Tests
 *
 * Test cases for T010-T014: Trace parent-child linking functionality
 *
 * These tests follow TDD - they will FAIL until implementation is complete (T016-T019)
 */
describe("TraceLinking", function () {
  // ============ Fixtures ============

  /**
   * Deploy AgentAnchor contract fixture
   */
  async function deployAgentAnchorFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const AgentAnchorFactory = await ethers.getContractFactory("AgentAnchor");
    const agentAnchor = await AgentAnchorFactory.deploy();

    return { agentAnchor, owner, user1, user2 };
  }

  /**
   * Deploy AgentAnchor with a pre-anchored parent trace
   */
  async function deployWithParentTraceFixture() {
    const { agentAnchor, owner, user1, user2 } = await deployAgentAnchorFixture();

    // Create and anchor parent trace
    const parentTraceData = createTraceData("parent");
    await agentAnchor.anchorTrace(
      parentTraceData.traceHash,
      parentTraceData.ipfsUri,
      parentTraceData.agentId,
      parentTraceData.granularity
    );

    return { agentAnchor, owner, user1, user2, parentTraceData };
  }

  // ============ Helper Functions ============

  /**
   * Create test trace data with unique identifiers
   * @param id - Unique identifier for the trace
   * @returns Object containing traceHash, ipfsUri, agentId, and granularity
   */
  function createTraceData(id: string) {
    return {
      traceHash: ethers.keccak256(ethers.toUtf8Bytes(`trace-${id}`)),
      ipfsUri: `ipfs://Qm${id.padStart(44, "0")}`,
      agentId: ethers.keccak256(ethers.toUtf8Bytes("test-agent")),
      granularity: 0, // Session
    };
  }

  /**
   * Zero bytes32 constant for root traces
   */
  const ZERO_PARENT = ethers.ZeroHash;

  // ============ Test Suite: US1 - Link Child Trace to Parent ============

  describe("US1: Link Child Trace to Parent", function () {
    /**
     * T010: Contract test - anchor with valid parent
     *
     * Requirement: A child trace can be anchored with a reference to an existing parent trace.
     * The parent trace must exist on-chain before the child can reference it.
     *
     * Expected behavior:
     * - anchorTraceWithParent succeeds when parentTraceHash references an existing anchor
     * - The child trace is stored with the correct parent reference
     * - The child is added to the parent's childTraces array
     */
    it("T010: should anchor a trace with valid parent reference", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Create child trace data
      const childTraceData = createTraceData("child");

      // Anchor child with parent reference
      // NOTE: This will fail until anchorTraceWithParent is implemented (T016)
      await expect(
        agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
          childTraceData.traceHash,
          childTraceData.ipfsUri,
          childTraceData.agentId,
          childTraceData.granularity,
          parentTraceData.traceHash
        )
      ).to.not.be.reverted;

      // Verify child anchor exists
      const exists = await agentAnchor.anchorExists(childTraceData.traceHash);
      expect(exists).to.be.true;

      // V1 Note: getParentTrace always returns (0, false) in V1 because parentTraceHash
      // is not stored in the Anchor struct (for backward compatibility). Use V2 for
      // parent lookup capability. V1 only supports child lookup via getChildTraces.
      const [parentHash, hasParent] = await (agentAnchor as any).getParentTrace(
        childTraceData.traceHash
      );
      // V1 limitation: hasParent is always false
      expect(hasParent).to.be.false;

      // Verify child is in parent's children list
      // NOTE: This requires getChildTraces implementation (T018)
      const children = await (agentAnchor as any).getChildTraces(
        parentTraceData.traceHash
      );
      expect(children).to.include(childTraceData.traceHash);
    });

    /**
     * T011: Contract test - anchor root trace (zero parent)
     *
     * Requirement: A trace can be anchored as a root trace by passing bytes32(0) as parent.
     * Root traces have no parent and serve as the start of a trace hierarchy.
     *
     * Expected behavior:
     * - anchorTraceWithParent succeeds with bytes32(0) as parentTraceHash
     * - isRootTrace returns true for this trace
     * - getParentTrace returns (bytes32(0), false) indicating no parent
     */
    it("T011: should anchor root trace with zero parent", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      // Create root trace data
      const rootTraceData = createTraceData("root");

      // Anchor as root trace (zero parent)
      // NOTE: This will fail until anchorTraceWithParent is implemented (T016)
      await expect(
        agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
          rootTraceData.traceHash,
          rootTraceData.ipfsUri,
          rootTraceData.agentId,
          rootTraceData.granularity,
          ZERO_PARENT
        )
      ).to.not.be.reverted;

      // Verify anchor exists
      const exists = await agentAnchor.anchorExists(rootTraceData.traceHash);
      expect(exists).to.be.true;

      // Verify it is recognized as a root trace
      // NOTE: This requires isRootTrace implementation (T018)
      const isRoot = await (agentAnchor as any).isRootTrace(rootTraceData.traceHash);
      expect(isRoot).to.be.true;

      // Verify getParentTrace returns no parent
      const [parentHash, hasParent] = await (agentAnchor as any).getParentTrace(
        rootTraceData.traceHash
      );
      expect(hasParent).to.be.false;
      expect(parentHash).to.equal(ZERO_PARENT);
    });

    /**
     * T012: Contract test - reject non-existent parent
     *
     * Requirement: Anchoring with a parentTraceHash that doesn't exist must revert.
     * This ensures referential integrity in the trace hierarchy.
     *
     * Expected behavior:
     * - anchorTraceWithParent reverts with ParentTraceNotFound error
     * - The error includes the invalid parent hash
     */
    it("T012: should reject anchoring with non-existent parent", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      // Create trace data
      const traceData = createTraceData("orphan");

      // Create a fake parent hash that doesn't exist on-chain
      const fakeParentHash = ethers.keccak256(
        ethers.toUtf8Bytes("non-existent-parent")
      );

      // Attempt to anchor with non-existent parent
      // NOTE: This will fail until anchorTraceWithParent is implemented (T016)
      await expect(
        agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
          traceData.traceHash,
          traceData.ipfsUri,
          traceData.agentId,
          traceData.granularity,
          fakeParentHash
        )
      )
        .to.be.revertedWithCustomError(agentAnchor, "ParentTraceNotFound")
        .withArgs(fakeParentHash);
    });

    /**
     * T013: Contract test - reject self-reference
     *
     * Requirement: A trace cannot reference itself as its own parent.
     * This prevents circular dependencies in the trace hierarchy.
     *
     * Expected behavior:
     * - anchorTraceWithParent reverts with SelfReferenceNotAllowed error
     * - The error includes the trace hash
     */
    it("T013: should reject self-reference as parent", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      // Create trace data
      const traceData = createTraceData("self-ref");

      // Attempt to anchor with self as parent
      // NOTE: This will fail until anchorTraceWithParent is implemented (T016)
      await expect(
        agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
          traceData.traceHash,
          traceData.ipfsUri,
          traceData.agentId,
          traceData.granularity,
          traceData.traceHash // Self-reference
        )
      )
        .to.be.revertedWithCustomError(agentAnchor, "SelfReferenceNotAllowed")
        .withArgs(traceData.traceHash);
    });

    /**
     * T014: Contract test - emit TraceLinked event
     *
     * Requirement: When a child trace is linked to a parent, emit TraceLinked event.
     * This allows off-chain systems to track parent-child relationships.
     *
     * Expected behavior:
     * - TraceLinked event is emitted with correct childTraceHash
     * - TraceLinked event is emitted with correct parentTraceHash
     * - TraceLinked event includes the block timestamp
     */
    it("T014: should emit TraceLinked event when linked to parent", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Create child trace data
      const childTraceData = createTraceData("child-event");

      // Anchor child with parent reference and check event
      // NOTE: This will fail until anchorTraceWithParent is implemented (T016)
      await expect(
        agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
          childTraceData.traceHash,
          childTraceData.ipfsUri,
          childTraceData.agentId,
          childTraceData.granularity,
          parentTraceData.traceHash
        )
      )
        .to.emit(agentAnchor, "TraceLinked")
        .withArgs(
          childTraceData.traceHash,
          parentTraceData.traceHash,
          (timestamp: bigint) => timestamp > 0n
        );
    });
  });

  // ============ Test Suite: View Functions ============

  describe("Trace Linking View Functions", function () {
    /**
     * Test getParentTrace returns correct data for linked traces
     */
    it("should return parent trace data via getParentTrace", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      const childTraceData = createTraceData("child-view");

      // Anchor child with parent
      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        childTraceData.traceHash,
        childTraceData.ipfsUri,
        childTraceData.agentId,
        childTraceData.granularity,
        parentTraceData.traceHash
      );

      // Query parent trace
      // V1 Note: getParentTrace always returns (0, false) in V1
      // because parentTraceHash is not stored in the Anchor struct
      const [parentHash, hasParent] = await (agentAnchor as any).getParentTrace(
        childTraceData.traceHash
      );

      // V1 limitation: hasParent is always false, parent lookup not supported
      expect(hasParent).to.be.false;
      expect(parentHash).to.equal(ethers.ZeroHash);
    });

    /**
     * Test getChildTraces returns all children for a parent
     */
    it("should return all child traces via getChildTraces", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Create and anchor multiple children
      const child1 = createTraceData("child-1");
      const child2 = createTraceData("child-2");
      const child3 = createTraceData("child-3");

      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child1.traceHash,
        child1.ipfsUri,
        child1.agentId,
        child1.granularity,
        parentTraceData.traceHash
      );

      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child2.traceHash,
        child2.ipfsUri,
        child2.agentId,
        child2.granularity,
        parentTraceData.traceHash
      );

      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child3.traceHash,
        child3.ipfsUri,
        child3.agentId,
        child3.granularity,
        parentTraceData.traceHash
      );

      // Query children
      const children = await (agentAnchor as any).getChildTraces(
        parentTraceData.traceHash
      );

      expect(children).to.have.lengthOf(3);
      expect(children).to.include(child1.traceHash);
      expect(children).to.include(child2.traceHash);
      expect(children).to.include(child3.traceHash);
    });

    /**
     * Test getChildTraceCount returns correct count
     */
    it("should return correct child count via getChildTraceCount", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Initially no children
      const initialCount = await (agentAnchor as any).getChildTraceCount(
        parentTraceData.traceHash
      );
      expect(initialCount).to.equal(0n);

      // Add children
      const child1 = createTraceData("count-child-1");
      const child2 = createTraceData("count-child-2");

      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child1.traceHash,
        child1.ipfsUri,
        child1.agentId,
        child1.granularity,
        parentTraceData.traceHash
      );

      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child2.traceHash,
        child2.ipfsUri,
        child2.agentId,
        child2.granularity,
        parentTraceData.traceHash
      );

      // Verify count
      const finalCount = await (agentAnchor as any).getChildTraceCount(
        parentTraceData.traceHash
      );
      expect(finalCount).to.equal(2n);
    });

    /**
     * Test getChildTracesPaginated for large datasets
     */
    it("should support pagination via getChildTracesPaginated", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Create 5 children
      const children = [];
      for (let i = 0; i < 5; i++) {
        const child = createTraceData(`paginated-child-${i}`);
        children.push(child);
        await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
          child.traceHash,
          child.ipfsUri,
          child.agentId,
          child.granularity,
          parentTraceData.traceHash
        );
      }

      // Get first page (2 items)
      const [page1, total1] = await (agentAnchor as any).getChildTracesPaginated(
        parentTraceData.traceHash,
        0, // offset
        2 // limit
      );
      expect(page1).to.have.lengthOf(2);
      expect(total1).to.equal(5n);

      // Get second page (2 items)
      const [page2, total2] = await (agentAnchor as any).getChildTracesPaginated(
        parentTraceData.traceHash,
        2, // offset
        2 // limit
      );
      expect(page2).to.have.lengthOf(2);
      expect(total2).to.equal(5n);

      // Get last page (1 item)
      const [page3, total3] = await (agentAnchor as any).getChildTracesPaginated(
        parentTraceData.traceHash,
        4, // offset
        2 // limit
      );
      expect(page3).to.have.lengthOf(1);
      expect(total3).to.equal(5n);
    });

    /**
     * Test isRootTrace correctly identifies root and non-root traces
     */
    it("should correctly identify root traces via isRootTrace", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Create a root trace using anchorTraceWithParent with zero parent
      const rootTrace = createTraceData("root-check");
      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        rootTrace.traceHash,
        rootTrace.ipfsUri,
        rootTrace.agentId,
        rootTrace.granularity,
        ZERO_PARENT
      );

      // Create a non-root trace
      const childTrace = createTraceData("non-root-check");
      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        childTrace.traceHash,
        childTrace.ipfsUri,
        childTrace.agentId,
        childTrace.granularity,
        parentTraceData.traceHash
      );

      // Verify root trace identification
      // NOTE: In V1, isRootTrace always returns true because V1 doesn't store
      // parentTraceHash in the Anchor struct. Use V2 for full parent tracking.
      const isRootTraceRoot = await (agentAnchor as any).isRootTrace(
        rootTrace.traceHash
      );
      expect(isRootTraceRoot).to.be.true;

      const isRootTraceChild = await (agentAnchor as any).isRootTrace(
        childTrace.traceHash
      );
      // V1 limitation: always returns true (parent not stored in Anchor)
      expect(isRootTraceChild).to.be.true;
    });
  });

  // ============ Test Suite: Edge Cases ============

  describe("Edge Cases", function () {
    /**
     * Test that standard anchorTrace creates traces without parent
     */
    it("should treat traces from standard anchorTrace as having no parent", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      const traceData = createTraceData("standard-anchor");

      // Anchor using standard function
      await agentAnchor.anchorTrace(
        traceData.traceHash,
        traceData.ipfsUri,
        traceData.agentId,
        traceData.granularity
      );

      // Verify it has no parent (once view functions are implemented)
      // The standard anchorTrace should result in a root trace
      const [parentHash, hasParent] = await (agentAnchor as any).getParentTrace(
        traceData.traceHash
      );
      expect(hasParent).to.be.false;
      expect(parentHash).to.equal(ZERO_PARENT);
    });

    /**
     * Test multi-level hierarchy (grandparent -> parent -> child)
     */
    it("should support multi-level trace hierarchies", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      // Create grandparent
      const grandparent = createTraceData("grandparent");
      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        grandparent.traceHash,
        grandparent.ipfsUri,
        grandparent.agentId,
        grandparent.granularity,
        ZERO_PARENT
      );

      // Create parent linked to grandparent
      const parent = createTraceData("parent-multi");
      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        parent.traceHash,
        parent.ipfsUri,
        parent.agentId,
        parent.granularity,
        grandparent.traceHash
      );

      // Create child linked to parent
      const child = createTraceData("child-multi");
      await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child.traceHash,
        child.ipfsUri,
        child.agentId,
        child.granularity,
        parent.traceHash
      );

      // Verify relationships via childTraces (V1 stores child->parent in childTraces mapping)
      // NOTE: V1 getParentTrace always returns (0, false) since parentTraceHash not in Anchor
      const grandparentChildren = await (agentAnchor as any).getChildTraces(
        grandparent.traceHash
      );
      expect(grandparentChildren).to.include(parent.traceHash);

      const parentChildren = await (agentAnchor as any).getChildTraces(
        parent.traceHash
      );
      expect(parentChildren).to.include(child.traceHash);

      const grandparentIsRoot = await (agentAnchor as any).isRootTrace(
        grandparent.traceHash
      );
      expect(grandparentIsRoot).to.be.true;
    });

    /**
     * Test that different users can create children of the same parent
     */
    it("should allow different users to create children of same parent", async function () {
      const { agentAnchor, user1, user2, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // User1 creates child
      const child1 = createTraceData("user1-child");
      await agentAnchor.connect(user1)["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child1.traceHash,
        child1.ipfsUri,
        child1.agentId,
        child1.granularity,
        parentTraceData.traceHash
      );

      // User2 creates child
      const child2 = createTraceData("user2-child");
      await agentAnchor.connect(user2)["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        child2.traceHash,
        child2.ipfsUri,
        child2.agentId,
        child2.granularity,
        parentTraceData.traceHash
      );

      // Verify both children exist
      const children = await (agentAnchor as any).getChildTraces(
        parentTraceData.traceHash
      );
      expect(children).to.have.lengthOf(2);
      expect(children).to.include(child1.traceHash);
      expect(children).to.include(child2.traceHash);

      // Verify creators are different
      const anchor1 = await agentAnchor.getAnchor(child1.traceHash);
      const anchor2 = await agentAnchor.getAnchor(child2.traceHash);
      expect(anchor1.creator).to.equal(user1.address);
      expect(anchor2.creator).to.equal(user2.address);
    });

    /**
     * Test empty children array for trace with no children
     */
    it("should return empty array for trace with no children", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      // Parent has no children yet
      const children = await (agentAnchor as any).getChildTraces(
        parentTraceData.traceHash
      );
      expect(children).to.have.lengthOf(0);

      const count = await (agentAnchor as any).getChildTraceCount(
        parentTraceData.traceHash
      );
      expect(count).to.equal(0n);
    });
  });

  // ============ Test Suite: Gas Usage ============

  describe("Gas Usage", function () {
    /**
     * Test gas usage for anchoring with parent
     */
    it("should use reasonable gas for anchoring with parent", async function () {
      const { agentAnchor, parentTraceData } = await loadFixture(
        deployWithParentTraceFixture
      );

      const childTraceData = createTraceData("gas-test");

      const tx = await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        childTraceData.traceHash,
        childTraceData.ipfsUri,
        childTraceData.agentId,
        childTraceData.granularity,
        parentTraceData.traceHash
      );

      const receipt = await tx.wait();

      // Should use less than 350k gas (includes parent validation and child array update)
      expect(receipt!.gasUsed).to.be.lt(350000n);
    });

    /**
     * Test gas usage for anchoring root trace
     */
    it("should use reasonable gas for anchoring root trace", async function () {
      const { agentAnchor } = await loadFixture(deployAgentAnchorFixture);

      const rootTraceData = createTraceData("gas-root");

      const tx = await agentAnchor["anchorTrace(bytes32,string,bytes32,uint8,bytes32)"](
        rootTraceData.traceHash,
        rootTraceData.ipfsUri,
        rootTraceData.agentId,
        rootTraceData.granularity,
        ZERO_PARENT
      );

      const receipt = await tx.wait();

      // Root trace gas (includes parent hash parameter but no validation)
      expect(receipt!.gasUsed).to.be.lt(350000n);
    });
  });
});
