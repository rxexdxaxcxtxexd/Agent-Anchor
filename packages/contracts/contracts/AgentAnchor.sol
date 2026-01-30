// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentAnchor
 * @author Agent Anchor Team
 * @notice On-chain trace anchoring for AI agent verification
 * @dev Stores trace hashes and IPFS URIs for verifiable AI agent actions
 */
contract AgentAnchor {
    // ============ Enums ============

    /**
     * @notice Granularity level for trace anchoring
     * @dev Session = entire session, Task = single task, Step = individual step
     */
    enum Granularity {
        Session,
        Task,
        Step
    }

    // ============ Structs ============

    /**
     * @notice On-chain anchor data structure
     * @param traceHash Keccak256 hash of the trace content
     * @param ipfsUri IPFS URI where full trace is stored
     * @param agentId Identifier of the agent that created the trace
     * @param granularity Level of granularity for this anchor
     * @param creator Address that anchored this trace
     * @param timestamp Block timestamp when anchored
     * @param blockNumber Block number when anchored
     */
    struct Anchor {
        bytes32 traceHash;
        string ipfsUri;
        bytes32 agentId;
        Granularity granularity;
        address creator;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ============ State Variables ============

    /// @notice Mapping from trace hash to anchor data
    mapping(bytes32 => Anchor) public anchors;

    /// @notice Mapping from agent ID to array of trace hashes
    mapping(bytes32 => bytes32[]) public agentAnchors;

    /// @notice Mapping from creator address to array of trace hashes
    mapping(address => bytes32[]) public creatorAnchors;

    /// @notice Total number of anchors created
    uint256 public totalAnchors;

    // ============ Events ============

    /**
     * @notice Emitted when a trace is anchored
     * @param traceHash The hash of the anchored trace
     * @param agentId The agent identifier
     * @param creator The address that created the anchor
     * @param ipfsUri The IPFS URI of the full trace
     * @param granularity The granularity level
     * @param timestamp The block timestamp
     */
    event TraceAnchored(
        bytes32 indexed traceHash,
        bytes32 indexed agentId,
        address indexed creator,
        string ipfsUri,
        Granularity granularity,
        uint256 timestamp
    );

    // ============ Errors ============

    /// @notice Thrown when trace hash is zero
    error InvalidTraceHash();

    /// @notice Thrown when IPFS URI is empty
    error InvalidIpfsUri();

    /// @notice Thrown when agent ID is zero
    error InvalidAgentId();

    /// @notice Thrown when anchor already exists
    error AnchorAlreadyExists(bytes32 traceHash);

    /// @notice Thrown when anchor does not exist
    error AnchorNotFound(bytes32 traceHash);

    // ============ External Functions ============

    /**
     * @notice Anchor a trace to the blockchain
     * @param traceHash Keccak256 hash of the trace content
     * @param ipfsUri IPFS URI where full trace is stored
     * @param agentId Identifier of the agent
     * @param granularity Granularity level of the trace
     * @return success True if anchoring succeeded
     */
    function anchorTrace(
        bytes32 traceHash,
        string calldata ipfsUri,
        bytes32 agentId,
        Granularity granularity
    ) external returns (bool success) {
        // Input validation
        if (traceHash == bytes32(0)) revert InvalidTraceHash();
        if (bytes(ipfsUri).length == 0) revert InvalidIpfsUri();
        if (agentId == bytes32(0)) revert InvalidAgentId();

        // Check for duplicate
        if (anchors[traceHash].timestamp != 0) {
            revert AnchorAlreadyExists(traceHash);
        }

        // Store anchor
        anchors[traceHash] = Anchor({
            traceHash: traceHash,
            ipfsUri: ipfsUri,
            agentId: agentId,
            granularity: granularity,
            creator: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        // Update indexes
        agentAnchors[agentId].push(traceHash);
        creatorAnchors[msg.sender].push(traceHash);
        totalAnchors++;

        // Emit event
        emit TraceAnchored(
            traceHash,
            agentId,
            msg.sender,
            ipfsUri,
            granularity,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Verify if a trace anchor exists
     * @param traceHash The trace hash to verify
     * @return exists Whether the anchor exists
     * @return ipfsUri The IPFS URI (empty if not found)
     * @return creator The creator address (zero if not found)
     * @return timestamp The anchor timestamp (0 if not found)
     */
    function verifyTrace(bytes32 traceHash)
        external
        view
        returns (
            bool exists,
            string memory ipfsUri,
            address creator,
            uint256 timestamp
        )
    {
        Anchor storage anchor = anchors[traceHash];

        if (anchor.timestamp == 0) {
            return (false, "", address(0), 0);
        }

        return (true, anchor.ipfsUri, anchor.creator, anchor.timestamp);
    }

    /**
     * @notice Check if an anchor exists
     * @param traceHash The trace hash to check
     * @return exists True if anchor exists
     */
    function anchorExists(bytes32 traceHash) external view returns (bool exists) {
        return anchors[traceHash].timestamp != 0;
    }

    /**
     * @notice Get full anchor data
     * @param traceHash The trace hash to query
     * @return anchor The full anchor struct
     */
    function getAnchor(bytes32 traceHash) external view returns (Anchor memory anchor) {
        if (anchors[traceHash].timestamp == 0) {
            revert AnchorNotFound(traceHash);
        }
        return anchors[traceHash];
    }

    /**
     * @notice Get all trace hashes for an agent
     * @param agentId The agent identifier
     * @return hashes Array of trace hashes
     */
    function getTracesByAgent(bytes32 agentId) external view returns (bytes32[] memory hashes) {
        return agentAnchors[agentId];
    }

    /**
     * @notice Get all trace hashes for a creator
     * @param creator The creator address
     * @return hashes Array of trace hashes
     */
    function getTracesByCreator(address creator) external view returns (bytes32[] memory hashes) {
        return creatorAnchors[creator];
    }

    /**
     * @notice Get count of traces for an agent
     * @param agentId The agent identifier
     * @return count Number of traces
     */
    function getAgentTraceCount(bytes32 agentId) external view returns (uint256 count) {
        return agentAnchors[agentId].length;
    }

    /**
     * @notice Get count of traces for a creator
     * @param creator The creator address
     * @return count Number of traces
     */
    function getCreatorTraceCount(address creator) external view returns (uint256 count) {
        return creatorAnchors[creator].length;
    }
}
